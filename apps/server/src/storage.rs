//! Server-only storage. Never share this pool or database with native clients.
use std::{
    fs::{File, OpenOptions},
    path::Path,
    time::Duration,
};

use sqlx::{
    ConnectOptions, SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
};

/// Stable, content-free errors: do not expose SQL, database paths, or row values.
#[derive(Debug, PartialEq, Eq)]
pub enum StorageError {
    InvalidDirectory,
    DirectoryUnavailable,
    OwnershipUnavailable,
    DatabaseUnavailable,
    IncompatibleDatabase,
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidDirectory => "invalid_storage_directory",
            Self::DirectoryUnavailable => "storage_directory_unavailable",
            Self::OwnershipUnavailable => "storage_ownership_unavailable",
            Self::DatabaseUnavailable => "database_unavailable",
            Self::IncompatibleDatabase => "incompatible_database",
        })
    }
}

impl std::error::Error for StorageError {}

/// Owns the advisory OS lock for the entire pool lifetime. No public pool clones.
/// The lock file must not be deleted while any instance is running.
pub struct ServerStorage {
    pool: SqlitePool,
    _ownership: File,
}

impl ServerStorage {
    /// Accept empty schema zero or an exact supported schema one. No upgrades.
    pub async fn open(directory: &Path) -> Result<Self, StorageError> {
        if directory.as_os_str().is_empty() {
            return Err(StorageError::InvalidDirectory);
        }
        let directory = directory.to_path_buf();
        let (directory, ownership) = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(&directory).map_err(|_| StorageError::DirectoryUnavailable)?;
            let directory =
                std::fs::canonicalize(directory).map_err(|_| StorageError::DirectoryUnavailable)?;
            let ownership = OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(false)
                .open(directory.join("server.lock"))
                .map_err(|_| StorageError::OwnershipUnavailable)?;
            ownership
                .try_lock()
                .map_err(|_| StorageError::OwnershipUnavailable)?;
            Ok::<_, StorageError>((directory, ownership))
        })
        .await
        .map_err(|_| StorageError::DirectoryUnavailable)??;

        let filename = directory.join("server.sqlite3");
        // Probe without setting persistent PRAGMAs or creating files. Refuse a
        // nonempty/future database before WAL can mutate it.
        if filename.exists() {
            let probe = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(
                    SqliteConnectOptions::new()
                        .filename(&filename)
                        .read_only(true)
                        .disable_statement_logging(),
                )
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
            let result = async {
                let version: i64 = sqlx::query_scalar("PRAGMA user_version")
                    .fetch_one(&probe)
                    .await
                    .map_err(|_| StorageError::DatabaseUnavailable)?;
                let tables: i64 = sqlx::query_scalar(
                    "SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
                )
                .fetch_one(&probe)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
                match version {
                    0 if tables == 0 => Ok(()),
                    1 => crate::schema::verify(&probe).await,
                    _ => Err(StorageError::IncompatibleDatabase),
                }
            }
            .await;
            probe.close().await;
            result?;
        }

        let options = SqliteConnectOptions::new()
            .filename(filename)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(5))
            .synchronous(SqliteSynchronous::Full)
            .disable_statement_logging();
        let pool = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(options)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        Ok(Self {
            pool,
            _ownership: ownership,
        })
    }

    pub async fn check(&self) -> Result<(), StorageError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        Ok(())
    }

    /// Explicitly initialize only an empty database. Never upgrade existing data.
    pub async fn open_initialized(directory: &Path) -> Result<Self, StorageError> {
        let storage = Self::open(directory).await?;
        let result = async {
            let version: i64 = sqlx::query_scalar("PRAGMA user_version")
                .fetch_one(&storage.pool)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
            if version == 0 {
                crate::schema::initialize(&storage.pool).await?;
            }
            crate::schema::verify(&storage.pool).await
        }
        .await;
        if let Err(error) = result {
            storage.close().await;
            return Err(error);
        }
        Ok(storage)
    }

    #[cfg(test)]
    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Drain connections before releasing ownership. Call on graceful shutdown.
    pub async fn close(self) {
        self.pool.close().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn every_connection_has_durable_bounded_configuration()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open(directory.path()).await?;
        let mut held = Vec::new();
        for _ in 0..4 {
            let mut connection = storage.pool.acquire().await?;
            let mode: String = sqlx::query_scalar("PRAGMA journal_mode")
                .fetch_one(&mut *connection)
                .await?;
            assert_eq!(mode, "wal");
            for (pragma, expected) in [
                ("PRAGMA foreign_keys", 1_i64),
                ("PRAGMA busy_timeout", 5000),
                ("PRAGMA synchronous", 2),
            ] {
                let actual: i64 = sqlx::query_scalar(pragma)
                    .fetch_one(&mut *connection)
                    .await?;
                assert_eq!(actual, expected);
            }
            held.push(connection);
        }
        assert_eq!(storage.pool.size(), 4);
        assert!(storage.pool.try_acquire().is_none());
        drop(held);
        storage.check().await?;
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn competing_instance_cannot_open_or_modify_database()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let first = ServerStorage::open(directory.path()).await?;
        let before = std::fs::read(directory.path().join("server.sqlite3"))?;
        assert!(matches!(
            ServerStorage::open(directory.path()).await,
            Err(StorageError::OwnershipUnavailable)
        ));
        assert_eq!(
            before,
            std::fs::read(directory.path().join("server.sqlite3"))?
        );
        first.close().await;
        let reopened = ServerStorage::open(directory.path()).await?;
        reopened.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn incompatible_database_is_not_modified() -> Result<(), Box<dyn std::error::Error>> {
        for statement in [
            "PRAGMA user_version = 99",
            "CREATE TABLE user_data (value TEXT)",
        ] {
            let directory = tempfile::tempdir()?;
            let filename = directory.path().join("server.sqlite3");
            let pool = SqlitePool::connect_with(
                SqliteConnectOptions::new()
                    .filename(&filename)
                    .create_if_missing(true),
            )
            .await?;
            sqlx::query(statement).execute(&pool).await?;
            pool.close().await;
            let before = std::fs::read(&filename)?;
            assert!(matches!(
                ServerStorage::open(directory.path()).await,
                Err(StorageError::IncompatibleDatabase)
            ));
            assert_eq!(before, std::fs::read(&filename)?);
            assert!(!directory.path().join("server.sqlite3-wal").exists());
        }
        Ok(())
    }

    #[tokio::test]
    async fn ownership_is_enforced_across_processes() -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open(directory.path()).await?;
        let executable = std::env::current_exe()?;
        let path = directory.path().to_path_buf();
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new(executable)
                .args(["--exact", "storage::tests::ownership_child_probe"])
                .env("SNAPTIUM_TEST_LOCK_DIRECTORY", path)
                .output()
        })
        .await??;
        assert!(output.status.success(), "child ownership assertion failed");
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn ownership_child_probe() -> Result<(), Box<dyn std::error::Error>> {
        if let Some(directory) = std::env::var_os("SNAPTIUM_TEST_LOCK_DIRECTORY") {
            assert!(matches!(
                ServerStorage::open(Path::new(&directory)).await,
                Err(StorageError::OwnershipUnavailable)
            ));
        }
        Ok(())
    }

    #[tokio::test]
    async fn invalid_paths_fail_without_panicking() -> Result<(), Box<dyn std::error::Error>> {
        assert!(matches!(
            ServerStorage::open(Path::new("")).await,
            Err(StorageError::InvalidDirectory)
        ));
        let directory = tempfile::tempdir()?;
        let file = directory.path().join("file");
        std::fs::write(&file, b"not a directory")?;
        assert!(matches!(
            ServerStorage::open(&file).await,
            Err(StorageError::DirectoryUnavailable)
        ));
        Ok(())
    }
}
