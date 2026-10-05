//! Trusted operator recovery for exact schemas 1/2; never a native-client store.
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{
    ConnectOptions,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

use crate::{repository::EntityId, storage::ServerStorage};

const DATABASE: &str = "server.sqlite3";
const MANIFEST: &str = "manifest.json";
pub(crate) const RESTORE_MARKER: &str = "restore.in-progress";
const MANIFEST_LIMIT: u64 = 4096;
// Operational bound for this initial profile, not an account storage quota.
const DATABASE_LIMIT: u64 = 64 * 1024 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum BackupError {
    InvalidInput,
    Unavailable,
    InvalidBackup,
    IncompatibleBackup,
    UnsupportedData,
    TargetExists,
    OwnershipUnavailable,
}
impl std::fmt::Display for BackupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidInput => "invalid_maintenance_input",
            Self::Unavailable => "backup_unavailable",
            Self::InvalidBackup => "invalid_backup",
            Self::IncompatibleBackup => "incompatible_backup",
            Self::UnsupportedData => "unsupported_backup_data",
            Self::TargetExists => "restore_target_exists",
            Self::OwnershipUnavailable => "storage_ownership_unavailable",
        })
    }
}
impl std::error::Error for BackupError {}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    format_version: u32,
    storage_kind: StorageKind,
    profile: Profile,
    application_version: String,
    schema_version: u32,
    backup_id: String,
    created_at_unix_seconds: u64,
    database: DatabaseFile,
    attachment_count: u32,
}
#[derive(Serialize, Deserialize)]
enum StorageKind {
    #[serde(rename = "server-sqlite")]
    ServerSqlite,
}
#[derive(Serialize, Deserialize)]
enum Profile {
    #[serde(rename = "core-database-only")]
    CoreDatabaseOnly,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DatabaseFile {
    path: String,
    bytes: u64,
    sha256: String,
}

/// Safe metadata only. No path, credentials, account identity or note content.
pub struct BackupInfo {
    pub backup_id: String,
    pub schema_version: u32,
}
impl Manifest {
    fn validate(&self) -> Result<(), BackupError> {
        if self.format_version != 1
            || !matches!(self.schema_version, 1 | 2)
            || self.application_version != env!("CARGO_PKG_VERSION")
            || self.attachment_count != 0
        {
            return Err(BackupError::IncompatibleBackup);
        }
        if EntityId::parse(&self.backup_id).is_err()
            || self.created_at_unix_seconds == 0
            || self.database.path != DATABASE
            || !(512..=DATABASE_LIMIT).contains(&self.database.bytes)
            || self.database.sha256.len() != 64
            || !self
                .database
                .sha256
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(BackupError::InvalidBackup);
        }
        Ok(())
    }
    fn info(&self) -> BackupInfo {
        BackupInfo {
            backup_id: self.backup_id.clone(),
            schema_version: self.schema_version,
        }
    }
}

async fn blocking<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, BackupError> + Send + 'static,
) -> Result<T, BackupError> {
    tokio::task::spawn_blocking(operation)
        .await
        .map_err(|_| BackupError::Unavailable)?
}

fn directory(path: &Path) -> Result<PathBuf, BackupError> {
    if path.as_os_str().is_empty() {
        return Err(BackupError::InvalidInput);
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::Unavailable)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::InvalidInput);
    }
    fs::canonicalize(path).map_err(|_| BackupError::Unavailable)
}
fn regular_file(path: &Path) -> Result<(), BackupError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::InvalidBackup)?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(BackupError::InvalidBackup);
    }
    Ok(())
}
fn check_entries(path: &Path, allowed: &[&str]) -> Result<(), BackupError> {
    for entry in fs::read_dir(path).map_err(|_| BackupError::Unavailable)? {
        let entry = entry.map_err(|_| BackupError::Unavailable)?;
        let name = entry.file_name();
        if !name.to_str().is_some_and(|name| allowed.contains(&name)) {
            return Err(BackupError::UnsupportedData);
        }
        regular_file(&entry.path())?;
    }
    Ok(())
}
fn private_directory(path: &Path) -> Result<(), BackupError> {
    let builder = fs::DirBuilder::new();
    #[cfg(unix)]
    let builder = {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = builder;
        builder.mode(0o700);
        builder
    };
    builder.create(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            BackupError::TargetExists
        } else {
            BackupError::Unavailable
        }
    })
}
fn private_file(path: &Path) -> Result<File, BackupError> {
    let mut options = OpenOptions::new();
    options.read(true).write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path).map_err(|_| BackupError::Unavailable)
}
fn sync_directory(path: &Path) -> Result<(), BackupError> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|file| file.sync_all())
            .map_err(|_| BackupError::Unavailable)?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
fn digest(path: &Path) -> Result<DatabaseFile, BackupError> {
    regular_file(path)?;
    let file = File::open(path).map_err(|_| BackupError::Unavailable)?;
    let length = file.metadata().map_err(|_| BackupError::Unavailable)?.len();
    if !(512..=DATABASE_LIMIT).contains(&length) {
        return Err(BackupError::InvalidBackup);
    }
    let mut reader = file.take(length + 1);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut bytes = 0_u64;
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|_| BackupError::Unavailable)?;
        if count == 0 {
            break;
        }
        bytes += count as u64;
        hasher.update(&buffer[..count]);
    }
    if bytes != length {
        return Err(BackupError::InvalidBackup);
    }
    Ok(DatabaseFile {
        path: DATABASE.into(),
        bytes,
        sha256: format!("{:x}", hasher.finalize()),
    })
}

/// Only read immutable standalone snapshots: never call on a live WAL database.
async fn inspect_database(path: &Path) -> Result<u32, BackupError> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(
            SqliteConnectOptions::new()
                .filename(path)
                .read_only(true)
                .immutable(true)
                .pragma("trusted_schema", "OFF")
                .pragma("query_only", "ON")
                .disable_statement_logging(),
        )
        .await
        .map_err(|_| BackupError::InvalidBackup)?;
    let result = async {
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&pool)
            .await
            .map_err(|_| BackupError::InvalidBackup)?;
        if !matches!(version, 1 | 2) {
            return Err(BackupError::IncompatibleBackup);
        }
        crate::schema::verify(&pool)
            .await
            .map_err(|_| BackupError::IncompatibleBackup)?;
        let integrity: String = sqlx::query_scalar("PRAGMA integrity_check(1)")
            .fetch_one(&pool)
            .await
            .map_err(|_| BackupError::InvalidBackup)?;
        if integrity != "ok" {
            return Err(BackupError::InvalidBackup);
        }
        if sqlx::query("PRAGMA foreign_key_check")
            .fetch_optional(&pool)
            .await
            .map_err(|_| BackupError::InvalidBackup)?
            .is_some()
        {
            return Err(BackupError::InvalidBackup);
        }
        u32::try_from(version).map_err(|_| BackupError::IncompatibleBackup)
    }
    .await;
    pool.close().await;
    result
}

/// Root must exist, be operator-private, and be outside the data directory.
/// SQLite owns snapshot consistency, including committed pages still in WAL.
pub async fn create(storage: &ServerStorage, root: &Path) -> Result<BackupInfo, BackupError> {
    let source = storage.directory().to_path_buf();
    let root = root.to_path_buf();
    let id = uuid::Uuid::now_v7().to_string();
    let backup_id = id.clone();
    let bundle = blocking(move || {
        check_entries(
            &source,
            &[
                DATABASE,
                "server.lock",
                "server.sqlite3-wal",
                "server.sqlite3-shm",
            ],
        )?;
        let root = directory(&root)?;
        if root.starts_with(&source) {
            return Err(BackupError::InvalidInput);
        }
        let bundle = root.join(id);
        private_directory(&bundle)?;
        private_file(&bundle.join(DATABASE))?;
        sync_directory(&root)?;
        Ok(bundle)
    })
    .await?;
    let filename = bundle.join(DATABASE);
    let filename_text = filename.to_str().ok_or(BackupError::InvalidInput)?;
    sqlx::query("VACUUM INTO ?")
        .bind(filename_text)
        .execute(storage.pool())
        .await
        .map_err(|_| BackupError::Unavailable)?;
    let schema_version = inspect_database(&filename).await?;
    let publication = bundle.clone();
    blocking(move || {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(&filename)
            .and_then(|file| file.sync_all())
            .map_err(|_| BackupError::Unavailable)?;
        let manifest = Manifest {
            format_version: 1,
            storage_kind: StorageKind::ServerSqlite,
            profile: Profile::CoreDatabaseOnly,
            application_version: env!("CARGO_PKG_VERSION").into(),
            schema_version,
            backup_id,
            created_at_unix_seconds: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| BackupError::Unavailable)?
                .as_secs(),
            database: digest(&filename)?,
            attachment_count: 0,
        };
        manifest.validate()?;
        let encoded = serde_json::to_vec_pretty(&manifest).map_err(|_| BackupError::Unavailable)?;
        let pending = publication.join("manifest.partial");
        let mut file = private_file(&pending)?;
        file.write_all(&encoded)
            .and_then(|()| file.sync_all())
            .map_err(|_| BackupError::Unavailable)?;
        drop(file);
        fs::hard_link(&pending, publication.join(MANIFEST))
            .map_err(|_| BackupError::Unavailable)?;
        sync_directory(&publication)?;
        fs::remove_file(pending).map_err(|_| BackupError::Unavailable)?;
        sync_directory(&publication)?;
        Ok(manifest.info())
    })
    .await
}

async fn verified_manifest(bundle: &Path) -> Result<(PathBuf, Manifest), BackupError> {
    let bundle = bundle.to_path_buf();
    let (bundle, manifest) = blocking(move || {
        let bundle = directory(&bundle)?;
        check_entries(&bundle, &[DATABASE, MANIFEST])?;
        regular_file(&bundle.join(MANIFEST))?;
        let mut encoded = Vec::new();
        File::open(bundle.join(MANIFEST))
            .map_err(|_| BackupError::InvalidBackup)?
            .take(MANIFEST_LIMIT + 1)
            .read_to_end(&mut encoded)
            .map_err(|_| BackupError::InvalidBackup)?;
        if encoded.len() as u64 > MANIFEST_LIMIT {
            return Err(BackupError::InvalidBackup);
        }
        let manifest: Manifest =
            serde_json::from_slice(&encoded).map_err(|_| BackupError::InvalidBackup)?;
        manifest.validate()?;
        let actual = digest(&bundle.join(DATABASE))?;
        if actual.bytes != manifest.database.bytes || actual.sha256 != manifest.database.sha256 {
            return Err(BackupError::InvalidBackup);
        }
        Ok((bundle, manifest))
    })
    .await?;
    if inspect_database(&bundle.join(DATABASE)).await? != manifest.schema_version {
        return Err(BackupError::IncompatibleBackup);
    }
    Ok((bundle, manifest))
}

pub async fn verify(bundle: &Path) -> Result<BackupInfo, BackupError> {
    Ok(verified_manifest(bundle).await?.1.info())
}

/// Never replaces an existing directory, even if empty. Failed/interrupted
/// destinations retain their startup-blocking marker and must not be reused.
pub async fn restore(bundle: &Path, target: &Path) -> Result<BackupInfo, BackupError> {
    let (bundle, manifest) = verified_manifest(bundle).await?;
    let requested_target = target.to_path_buf();
    let expected_bytes = manifest.database.bytes;
    let expected_hash = manifest.database.sha256.clone();
    let (target, ownership) = blocking(move || {
        let name = requested_target
            .file_name()
            .ok_or(BackupError::InvalidInput)?;
        let parent = requested_target
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        let parent = directory(parent)?;
        let target = parent.join(name);
        if target.starts_with(&bundle) {
            return Err(BackupError::InvalidInput);
        }
        private_directory(&target)?;
        // Persist the guard before creating any database file.
        private_file(&target.join(RESTORE_MARKER))?
            .sync_all()
            .map_err(|_| BackupError::Unavailable)?;
        sync_directory(&target)?;
        sync_directory(&parent)?;
        let ownership = private_file(&target.join("server.lock"))?;
        ownership
            .try_lock()
            .map_err(|_| BackupError::OwnershipUnavailable)?;
        let mut source = File::open(bundle.join(DATABASE))
            .map_err(|_| BackupError::Unavailable)?
            .take(expected_bytes + 1);
        let staging = target.join("database.partial");
        let mut destination = private_file(&staging)?;
        let copied =
            std::io::copy(&mut source, &mut destination).map_err(|_| BackupError::Unavailable)?;
        destination
            .sync_all()
            .map_err(|_| BackupError::Unavailable)?;
        let actual = digest(&staging)?;
        if copied != expected_bytes
            || actual.bytes != expected_bytes
            || actual.sha256 != expected_hash
        {
            return Err(BackupError::InvalidBackup);
        }
        Ok((target, ownership))
    })
    .await?;
    if inspect_database(&target.join("database.partial")).await? != manifest.schema_version {
        return Err(BackupError::IncompatibleBackup);
    }
    blocking(move || {
        // hard_link atomically publishes a name without overwriting an existing
        // file, unlike rename on Unix. Both names remain within the new target.
        fs::hard_link(target.join("database.partial"), target.join(DATABASE))
            .map_err(|_| BackupError::Unavailable)?;
        sync_directory(&target)?;
        fs::remove_file(target.join("database.partial")).map_err(|_| BackupError::Unavailable)?;
        sync_directory(&target)?;
        fs::remove_file(target.join(RESTORE_MARKER)).map_err(|_| BackupError::Unavailable)?;
        sync_directory(&target)?;
        drop(ownership);
        Ok(manifest.info())
    })
    .await
}

/// Exact positional arguments only. Errors never echo paths or argument values.
/// Returns false only for ordinary no-argument server startup.
pub async fn maintenance(arguments: Vec<std::ffi::OsString>) -> Result<bool, BackupError> {
    if arguments.is_empty() {
        return Ok(false);
    }
    match arguments.as_slice() {
        [command, source, root] if command == "backup" => {
            let source = PathBuf::from(source);
            let checked = source.clone();
            blocking(move || {
                directory(&checked)?;
                regular_file(&checked.join(DATABASE))
            })
            .await?;
            let storage = ServerStorage::open(&source)
                .await
                .map_err(|error| match error {
                    crate::storage::StorageError::OwnershipUnavailable => {
                        BackupError::OwnershipUnavailable
                    }
                    crate::storage::StorageError::IncompatibleDatabase => {
                        BackupError::IncompatibleBackup
                    }
                    _ => BackupError::Unavailable,
                })?;
            let result = create(&storage, Path::new(root)).await;
            storage.close().await;
            let info = result?;
            println!("backup_created {}", info.backup_id);
        }
        [command, bundle] if command == "verify-backup" => {
            verify(Path::new(bundle)).await?;
            println!("backup_verified");
        }
        [command, bundle, target] if command == "restore" => {
            restore(Path::new(bundle), Path::new(target)).await?;
            println!("backup_restored");
        }
        _ => return Err(BackupError::InvalidInput),
    }
    Ok(true)
}

#[cfg(test)]
mod tests;
