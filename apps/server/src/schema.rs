//! Exact server schema definitions; existing-data upgrades require recovery.
use sqlx::{SqliteConnection, SqlitePool};

use crate::storage::StorageError;

pub(crate) const INITIAL_SQL: &str = include_str!("../migrations/0001_core.sql");
pub(crate) const IDENTITY_SQL: &str = include_str!("../migrations/0002_identity.sql");
pub(crate) const NOTE_STORAGE_SQL: &str = include_str!("../migrations/0003_note_storage.sql");

pub(crate) async fn verify(pool: &SqlitePool) -> Result<(), StorageError> {
    let mut connection = pool
        .acquire()
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)?;
    verify_connection(&mut connection).await
}

pub(crate) async fn verify_connection(
    connection: &mut SqliteConnection,
) -> Result<(), StorageError> {
    // File/restore boundaries may contain hostile metadata. Bound stored text
    // before decoding it into Rust Strings or collecting schema objects.
    let (objects, largest_sql): (i64, i64) = sqlx::query_as(
        "SELECT count(*), coalesce(max(length(CAST(sql AS BLOB))), 0) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
    ).fetch_one(&mut *connection).await.map_err(|_| StorageError::IncompatibleDatabase)?;
    if objects > 64 || largest_sql > 8192 {
        return Err(StorageError::IncompatibleDatabase);
    }
    let record_bytes: Option<i64> = sqlx::query_scalar(
        "SELECT length(CAST(migration_sql AS BLOB)) FROM schema_metadata WHERE singleton = 1",
    )
    .fetch_optional(&mut *connection)
    .await
    .map_err(|_| StorageError::IncompatibleDatabase)?;
    if !matches!(record_bytes, Some(1..=8192)) {
        return Err(StorageError::IncompatibleDatabase);
    }
    let record: Option<(i64, String)> =
        sqlx::query_as("SELECT version, migration_sql FROM schema_metadata WHERE singleton = 1")
            .fetch_optional(&mut *connection)
            .await
            .map_err(|_| StorageError::IncompatibleDatabase)?;
    let canonical_sql = INITIAL_SQL.replace("\r\n", "\n");
    if record != Some((1, canonical_sql.clone())) {
        return Err(StorageError::IncompatibleDatabase);
    }
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *connection)
        .await
        .map_err(|_| StorageError::IncompatibleDatabase)?;
    if !matches!(version, 1..=3) {
        return Err(StorageError::IncompatibleDatabase);
    }
    if version >= 2 {
        let record_bytes: Option<i64> = sqlx::query_scalar(
            "SELECT length(CAST(migration_sql AS BLOB)) FROM bootstrap_state WHERE singleton = 1",
        )
        .fetch_optional(&mut *connection)
        .await
        .map_err(|_| StorageError::IncompatibleDatabase)?;
        if !matches!(record_bytes, Some(1..=8192)) {
            return Err(StorageError::IncompatibleDatabase);
        }
        let state: Option<(i64, String)> =
            sqlx::query_as("SELECT closed, migration_sql FROM bootstrap_state WHERE singleton = 1")
                .fetch_optional(&mut *connection)
                .await
                .map_err(|_| StorageError::IncompatibleDatabase)?;
        if !matches!(state, Some((0 | 1, ref sql)) if sql == &IDENTITY_SQL.replace("\r\n", "\n")) {
            return Err(StorageError::IncompatibleDatabase);
        }
    }
    if version == 3 {
        let record_bytes: Option<i64> = sqlx::query_scalar(
            "SELECT length(CAST(migration_sql AS BLOB)) FROM note_storage_metadata WHERE singleton = 1",
        ).fetch_optional(&mut *connection).await.map_err(|_| StorageError::IncompatibleDatabase)?;
        if !matches!(record_bytes, Some(1..=8192)) {
            return Err(StorageError::IncompatibleDatabase);
        }
        let record: Option<(i64, String)> = sqlx::query_as(
            "SELECT version, migration_sql FROM note_storage_metadata WHERE singleton = 1",
        )
        .fetch_optional(&mut *connection)
        .await
        .map_err(|_| StorageError::IncompatibleDatabase)?;
        if record != Some((3, NOTE_STORAGE_SQL.replace("\r\n", "\n"))) {
            return Err(StorageError::IncompatibleDatabase);
        }
    }
    // Compare actual schema objects with a fresh reference, not merely a version
    // marker. Missing constraints, extra objects, and altered columns fail closed.
    let reference = SqlitePool::connect("sqlite::memory:")
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)?;
    let result = async {
        sqlx::raw_sql(&canonical_sql).execute(&reference).await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        if version >= 2 {
            sqlx::raw_sql(&IDENTITY_SQL.replace("\r\n", "\n")).execute(&reference).await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
        }
        if version == 3 {
            sqlx::raw_sql(&NOTE_STORAGE_SQL.replace("\r\n", "\n")).execute(&reference).await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
        }
        let query = "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";
        let actual: Vec<(String, String, String, Option<String>)> = sqlx::query_as(query)
            .fetch_all(&mut *connection).await.map_err(|_| StorageError::IncompatibleDatabase)?;
        let expected: Vec<(String, String, String, Option<String>)> = sqlx::query_as(query)
            .fetch_all(&reference).await.map_err(|_| StorageError::DatabaseUnavailable)?;
        if actual != expected { return Err(StorageError::IncompatibleDatabase); }
        Ok(())
    }.await;
    reference.close().await;
    result
}

pub(crate) async fn initialize(pool: &SqlitePool) -> Result<(), StorageError> {
    initialize_sql(pool, INITIAL_SQL, 1).await
}

pub(crate) async fn initialize_identity(pool: &SqlitePool) -> Result<(), StorageError> {
    initialize_sql(pool, INITIAL_SQL, 2).await
}

pub(crate) async fn initialize_notes(pool: &SqlitePool) -> Result<(), StorageError> {
    initialize_sql(pool, INITIAL_SQL, 3).await
}

/// Called only after note-storage DDL, within the caller's initialization/migration
/// transaction. INSERT SELECT avoids decoding or normalizing existing content.
pub(crate) async fn backfill_notes(connection: &mut SqliteConnection) -> Result<(), StorageError> {
    for sql in [
        "INSERT INTO note_history (owner_id, note_id, revision, folder_id, title, markdown, created_at, updated_at, trashed_at) SELECT owner_id, id, revision, folder_id, title, markdown, created_at, updated_at, trashed_at FROM notes ORDER BY owner_id, id",
        "INSERT INTO change_log (owner_id, entity_kind, entity_id, revision, operation, occurred_at) SELECT owner_id, 'folder', id, revision, 'upsert', updated_at FROM folders ORDER BY owner_id, id",
        "INSERT INTO change_log (owner_id, entity_kind, entity_id, revision, operation, occurred_at) SELECT owner_id, 'note', id, revision, 'upsert', updated_at FROM notes ORDER BY owner_id, id",
    ] {
        sqlx::query(sql)
            .execute(&mut *connection)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
    }
    sqlx::query("INSERT INTO note_storage_metadata VALUES (1, 3, ?)")
        .bind(NOTE_STORAGE_SQL.replace("\r\n", "\n"))
        .execute(&mut *connection)
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)?;
    sqlx::query("PRAGMA user_version = 3")
        .execute(connection)
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)?;
    Ok(())
}

async fn initialize_sql(pool: &SqlitePool, sql: &str, version: u32) -> Result<(), StorageError> {
    let sql = sql.replace("\r\n", "\n");
    let mut transaction = pool
        .begin()
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)?;
    let result = async {
        sqlx::raw_sql(&sql)
            .execute(&mut *transaction)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        sqlx::query("INSERT INTO schema_metadata VALUES (1, 1, ?)")
            .bind(INITIAL_SQL.replace("\r\n", "\n"))
            .execute(&mut *transaction)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        sqlx::query("PRAGMA user_version = 1")
            .execute(&mut *transaction)
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        if version >= 2 {
            sqlx::raw_sql(&IDENTITY_SQL.replace("\r\n", "\n"))
                .execute(&mut *transaction)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
            sqlx::query("INSERT INTO bootstrap_state VALUES (1, 0, ?)")
                .bind(IDENTITY_SQL.replace("\r\n", "\n"))
                .execute(&mut *transaction)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
            sqlx::query("PRAGMA user_version = 2")
                .execute(&mut *transaction)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
        }
        if version == 3 {
            sqlx::raw_sql(&NOTE_STORAGE_SQL.replace("\r\n", "\n"))
                .execute(&mut *transaction)
                .await
                .map_err(|_| StorageError::DatabaseUnavailable)?;
            backfill_notes(&mut transaction).await?;
        }
        Ok(())
    }
    .await;
    if let Err(error) = result {
        transaction
            .rollback()
            .await
            .map_err(|_| StorageError::DatabaseUnavailable)?;
        return Err(error);
    }
    transaction
        .commit()
        .await
        .map_err(|_| StorageError::DatabaseUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::ServerStorage;

    #[tokio::test]
    async fn initial_schema_reopens_without_rewriting_data()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let policy: (i64, i64, i64, i64, i64) = sqlx::query_as("SELECT attachment_limit_bytes, default_quota_bytes, note_history_limit, public_registration, purge_tombstones FROM server_policy")
            .fetch_one(storage.pool()).await?;
        assert_eq!(policy, (20971520, 5368709120, 100, 0, 0));
        sqlx::query("INSERT INTO users VALUES ('user', 'alice', 'test-verifier', 1, 42, '2026-10-05T00:00:00Z')")
            .execute(storage.pool()).await?;
        storage.close().await;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let quota: i64 = sqlx::query_scalar("SELECT quota_bytes FROM users WHERE id = 'user'")
            .fetch_one(storage.pool())
            .await?;
        assert_eq!(quota, 42);
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn failed_initialization_rolls_back_all_objects_and_version()
    -> Result<(), Box<dyn std::error::Error>> {
        let pool = SqlitePool::connect("sqlite::memory:").await?;
        let broken = format!("{INITIAL_SQL}\nINSERT INTO missing_table VALUES (1);");
        assert_eq!(
            initialize_sql(&pool, &broken, 1).await,
            Err(StorageError::DatabaseUnavailable)
        );
        let objects: i64 =
            sqlx::query_scalar("SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'")
                .fetch_one(&pool)
                .await?;
        assert_eq!(objects, 0);
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&pool)
            .await?;
        assert_eq!(version, 0);
        initialize(&pool).await?;
        verify(&pool).await?;
        pool.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn failed_identity_initialization_rolls_back_core_and_retries()
    -> Result<(), Box<dyn std::error::Error>> {
        let pool = SqlitePool::connect("sqlite::memory:").await?;
        sqlx::query("CREATE TABLE bootstrap_state (placeholder INTEGER)")
            .execute(&pool)
            .await?;
        assert_eq!(
            initialize_identity(&pool).await,
            Err(StorageError::DatabaseUnavailable)
        );
        let objects: i64 =
            sqlx::query_scalar("SELECT count(*) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'")
                .fetch_one(&pool)
                .await?;
        assert_eq!(objects, 1);
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&pool)
            .await?;
        assert_eq!(version, 0);
        sqlx::query("DROP TABLE bootstrap_state")
            .execute(&pool)
            .await?;
        initialize_identity(&pool).await?;
        verify(&pool).await?;
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&pool)
            .await?;
        assert_eq!(version, 2);
        pool.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn folder_ownership_and_deletion_preserve_notes() -> Result<(), Box<dyn std::error::Error>>
    {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let pool = storage.pool();
        for id in ["alice", "bob"] {
            sqlx::query("INSERT INTO users VALUES (?, ?, 'test-verifier', 0, 5368709120, '2026-10-05T00:00:00Z')").bind(id).bind(id).execute(pool).await?;
        }
        sqlx::query("INSERT INTO folders VALUES ('folder', 'alice', '工作', 1, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z')").execute(pool).await?;
        let insert = "INSERT INTO notes VALUES (?, ?, 'folder', '笔记', '保留原文', 1, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z', NULL)";
        assert!(
            sqlx::query(insert)
                .bind("bad")
                .bind("bob")
                .execute(pool)
                .await
                .is_err()
        );
        sqlx::query(insert)
            .bind("note")
            .bind("alice")
            .execute(pool)
            .await?;
        assert!(
            sqlx::query("DELETE FROM folders WHERE id = 'folder'")
                .execute(pool)
                .await
                .is_err()
        );
        let mut tx = pool.begin().await?;
        sqlx::query(
            "UPDATE notes SET folder_id = NULL WHERE owner_id = 'alice' AND folder_id = 'folder'",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM folders WHERE owner_id = 'alice' AND id = 'folder'")
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        let note: (Option<String>, String) =
            sqlx::query_as("SELECT folder_id, markdown FROM notes WHERE id = 'note'")
                .fetch_one(pool)
                .await?;
        assert_eq!(note, (None, "保留原文".into()));
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn modified_schema_and_future_version_are_refused()
    -> Result<(), Box<dyn std::error::Error>> {
        for sql in [
            "ALTER TABLE notes ADD COLUMN extra TEXT",
            "PRAGMA user_version = 2",
            "UPDATE schema_metadata SET migration_sql = 'changed'",
        ] {
            let directory = tempfile::tempdir()?;
            let storage = ServerStorage::open_initialized(directory.path()).await?;
            sqlx::query(sql).execute(storage.pool()).await?;
            storage.close().await;
            let filename = directory.path().join("server.sqlite3");
            let before = std::fs::read(&filename)?;
            assert!(matches!(
                ServerStorage::open_initialized(directory.path()).await,
                Err(StorageError::IncompatibleDatabase)
            ));
            assert!(
                before == std::fs::read(filename)?,
                "refusal modified database bytes"
            );
        }
        Ok(())
    }
}
