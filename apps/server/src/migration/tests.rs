use super::*;
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

use argon2::{Algorithm, Argon2, Params, PasswordHasher, Version, password_hash::SaltString};
use sqlx::{
    ConnectOptions, SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

use crate::{
    identity::{BootstrapSecret, LoginName, Password, TEST_HASH_SERIAL},
    storage::StorageError,
};

type TestResult = Result<(), Box<dyn std::error::Error>>;
const PASSWORD: &str = "test migration password 123";

/// Earlier schema is created using its actual immutable SQL, not a down migration.
async fn fixture(
    source: &Path,
    administrator: Option<bool>,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let storage = ServerStorage::open_initialized(source).await?;
    let owner = if let Some(administrator) = administrator {
        let id = uuid::Uuid::now_v7().to_string();
        let salt = SaltString::encode_b64(b"migration-salt01")?;
        let verifier = Argon2::new(
            Algorithm::Argon2id,
            Version::V0x13,
            Params::new(19456, 2, 1, Some(32))?,
        )
        .hash_password(PASSWORD.as_bytes(), &salt)?
        .to_string();
        sqlx::query("INSERT INTO users VALUES (?, 'alice', ?, ?, 1234, '2026-10-05T00:00:00Z')")
            .bind(&id)
            .bind(verifier)
            .bind(administrator)
            .execute(storage.pool())
            .await?;
        let folder = uuid::Uuid::now_v7().to_string();
        sqlx::query("INSERT INTO folders VALUES (?, ?, '迁移文件夹', 7, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z')")
            .bind(&folder).bind(&id).execute(storage.pool()).await?;
        sqlx::query("INSERT INTO notes VALUES (?, ?, ?, '标题', ?, 9007199254740993, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z', '2026-10-05T01:00:00Z')")
            .bind(uuid::Uuid::now_v7().to_string()).bind(&id).bind(&folder)
            .bind("# 保留原文\r\n\r\n未知 [^内容] 和空格  \r\n").execute(storage.pool()).await?;
        sqlx::query("UPDATE server_policy SET default_quota_bytes = 2345")
            .execute(storage.pool())
            .await?;
        Some(id)
    } else {
        None
    };
    storage.close().await;
    Ok(owner)
}

async fn read_pool(source: &Path) -> Result<SqlitePool, sqlx::Error> {
    // Unlike standalone backups, interrupted active databases may have WAL.
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(source.join("server.sqlite3"))
                .read_only(true)
                .disable_statement_logging(),
        )
        .await
}

async fn saved_rows(pool: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    let mut rows = Vec::new();
    for query in [
        "SELECT json_object('id',id,'login',login,'password',password_verifier,'admin',is_admin,'quota',quota_bytes,'created',created_at) FROM users ORDER BY id",
        "SELECT json_object('id',id,'owner',owner_id,'name',name,'revision',revision,'created',created_at,'updated',updated_at) FROM folders ORDER BY id",
        "SELECT json_object('id',id,'owner',owner_id,'folder',folder_id,'title',title,'markdown',markdown,'revision',revision,'created',created_at,'updated',updated_at,'trashed',trashed_at) FROM notes ORDER BY id",
        "SELECT json_object('singleton',singleton,'limit',attachment_limit_bytes,'quota',default_quota_bytes,'history',note_history_limit,'public',public_registration,'purge',purge_tombstones) FROM server_policy ORDER BY singleton",
        "SELECT json_object('singleton',singleton,'version',version,'sql',migration_sql) FROM schema_metadata ORDER BY singleton",
    ] {
        let values: Vec<String> = sqlx::query_scalar(query).fetch_all(pool).await?;
        rows.extend(values);
    }
    Ok(rows)
}
fn recovery_id(source: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let record: serde_json::Value =
        serde_json::from_slice(&std::fs::read(source.join(MIGRATION_MARKER))?)?;
    assert_eq!(record["formatVersion"], 1);
    assert_eq!(record["sourceSchema"], 1);
    assert_eq!(record["targetSchema"], 2);
    assert_eq!(record["applicationVersion"], env!("CARGO_PKG_VERSION"));
    let id = record["recoveryBackupId"]
        .as_str()
        .ok_or("missing test recovery identifier")?;
    crate::repository::EntityId::parse(id)?;
    Ok(id.into())
}

#[tokio::test]
async fn populated_upgrade_preserves_all_existing_rows_and_closes_bootstrap() -> TestResult {
    let _guard = TEST_HASH_SERIAL.lock().await;
    let temporary = tempfile::tempdir()?;
    let source = temporary.path().join("source");
    let root = temporary.path().join("备份's 文件");
    std::fs::create_dir(&root)?;
    let owner = fixture(&source, Some(true))
        .await?
        .ok_or("missing test owner")?;
    let pool = read_pool(&source).await?;
    let before = saved_rows(&pool).await?;
    pool.close().await;
    let MigrationOutcome::Migrated { recovery_backup } = run(&source, &root).await? else {
        return Err("migration unexpectedly skipped".into());
    };
    assert_eq!(recovery_backup.schema_version, 1);
    assert!(!source.join(MIGRATION_MARKER).exists());
    let storage = ServerStorage::open_identity(&source).await?;
    assert!(
        saved_rows(storage.pool()).await? == before,
        "migration changed existing rows"
    );
    assert!(!storage.bootstrap_required().await?);
    let account = storage
        .verify_credentials(
            LoginName::parse("alice")?,
            Password::for_verification(PASSWORD.into())?,
        )
        .await?;
    assert_eq!(account.id.canonical(), owner);
    assert!(account.is_admin);
    let secret = BootstrapSecret::parse("ab".repeat(32))?;
    assert!(
        storage
            .bootstrap_admin(
                &secret,
                &secret,
                LoginName::parse("other")?,
                Password::for_creation(PASSWORD.into())?
            )
            .await
            .is_err()
    );
    storage.close().await;
    let restored = temporary.path().join("restored-v1");
    backup::restore(&root.join(recovery_backup.backup_id), &restored).await?;
    let pool = read_pool(&restored).await?;
    assert!(
        saved_rows(&pool).await? == before,
        "recovery changed existing rows"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("PRAGMA user_version")
            .fetch_one(&pool)
            .await?,
        1
    );
    pool.close().await;
    assert!(matches!(
        ServerStorage::open_identity(&restored).await,
        Err(StorageError::IncompatibleDatabase)
    ));
    Ok(())
}

#[tokio::test]
async fn empty_upgrade_allows_first_bootstrap_and_missing_admin_is_never_promoted() -> TestResult {
    let _guard = TEST_HASH_SERIAL.lock().await;
    let temporary = tempfile::tempdir()?;
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    let empty = temporary.path().join("empty");
    fixture(&empty, None).await?;
    run(&empty, &root).await?;
    let storage = ServerStorage::open_identity(&empty).await?;
    assert!(storage.bootstrap_required().await?);
    let secret = BootstrapSecret::parse("ab".repeat(32))?;
    storage
        .bootstrap_admin(
            &secret,
            &secret,
            LoginName::parse("first")?,
            Password::for_creation(PASSWORD.into())?,
        )
        .await?;
    assert!(!storage.bootstrap_required().await?);
    storage.close().await;
    let unowned = temporary.path().join("without-admin");
    fixture(&unowned, Some(false)).await?;
    let before_count = std::fs::read_dir(&root)?.count();
    assert!(matches!(
        run(&unowned, &root).await,
        Err(MigrationError::AdministratorRequired)
    ));
    assert_eq!(std::fs::read_dir(&root)?.count(), before_count);
    assert!(!unowned.join(MIGRATION_MARKER).exists());
    let pool = read_pool(&unowned).await?;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT is_admin FROM users")
            .fetch_one(&pool)
            .await?,
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("PRAGMA user_version")
            .fetch_one(&pool)
            .await?,
        1
    );
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn current_schema_is_a_no_op_and_never_reopens_bootstrap() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    for closed in [0_i64, 1] {
        let source = temporary.path().join(format!("current-{closed}"));
        let storage = ServerStorage::open_identity(&source).await?;
        sqlx::query("UPDATE bootstrap_state SET closed = ?")
            .bind(closed)
            .execute(storage.pool())
            .await?;
        storage.close().await;
        for _ in 0..2 {
            assert!(matches!(
                run(&source, &root).await?,
                MigrationOutcome::AlreadyCurrent
            ));
        }
        let pool = read_pool(&source).await?;
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT closed FROM bootstrap_state")
                .fetch_one(&pool)
                .await?,
            closed
        );
        pool.close().await;
        assert!(!source.join(MIGRATION_MARKER).exists());
    }
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    Ok(())
}

#[tokio::test]
async fn unavailable_recovery_point_never_begins_schema_changes() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let source = temporary.path().join("source");
    fixture(&source, None).await?;
    let file = temporary.path().join("not-a-directory");
    std::fs::write(&file, "existing file")?;
    for root in [&file, &source, &temporary.path().join("missing-root")] {
        assert!(matches!(
            run(&source, root).await,
            Err(MigrationError::RecoveryPointUnavailable)
        ));
        assert!(!source.join(MIGRATION_MARKER).exists());
        let pool = read_pool(&source).await?;
        assert_eq!(
            sqlx::query_scalar::<_, i64>("PRAGMA user_version")
                .fetch_one(&pool)
                .await?,
            1
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT count(*) FROM sqlite_schema WHERE name = 'bootstrap_state'"
            )
            .fetch_one(&pool)
            .await?,
            0
        );
        pool.close().await;
    }
    assert_eq!(std::fs::read(&file)?, b"existing file");
    let root = temporary.path().join("valid-backup-root");
    std::fs::create_dir(&root)?;
    std::fs::create_dir(source.join("attachments"))?;
    std::fs::write(
        source.join("attachments/keep"),
        "unimplemented attachment data",
    )?;
    assert!(matches!(
        run(&source, &root).await,
        Err(MigrationError::RecoveryPointUnavailable)
    ));
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    assert_eq!(
        std::fs::read(source.join("attachments/keep"))?,
        b"unimplemented attachment data"
    );
    assert!(!source.join(MIGRATION_MARKER).exists());
    Ok(())
}

#[tokio::test]
async fn foreign_key_corruption_is_refused_even_for_already_current_schema() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    for identity in [false, true] {
        let source = temporary.path().join(if identity {
            "invalid-two"
        } else {
            "invalid-one"
        });
        let storage = if identity {
            ServerStorage::open_identity(&source).await?
        } else {
            ServerStorage::open_initialized(&source).await?
        };
        let mut connection = storage.pool().acquire().await?;
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *connection)
            .await?;
        sqlx::query("INSERT INTO notes VALUES ('orphan', 'missing', NULL, 'test', 'test', 1, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z', NULL)")
            .execute(&mut *connection).await?;
        drop(connection);
        storage.close().await;
        let before = std::fs::read(source.join("server.sqlite3"))?;
        assert!(matches!(
            run(&source, &root).await,
            Err(MigrationError::IncompatibleDatabase)
        ));
        assert!(
            before == std::fs::read(source.join("server.sqlite3"))?,
            "corruption refusal changed database"
        );
        assert!(!source.join(MIGRATION_MARKER).exists());
    }
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    Ok(())
}

#[tokio::test]
async fn missing_empty_future_and_owned_sources_are_refused_before_backup() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    let missing = temporary.path().join("missing-source");
    assert!(matches!(
        run(&missing, &root).await,
        Err(MigrationError::SourceUnavailable)
    ));
    assert!(!missing.exists());
    let empty = temporary.path().join("schema-zero");
    ServerStorage::open(&empty).await?.close().await;
    assert!(matches!(
        run(&empty, &root).await,
        Err(MigrationError::IncompatibleDatabase)
    ));
    let owned = temporary.path().join("owned");
    let storage = ServerStorage::open_initialized(&owned).await?;
    assert!(matches!(
        run(&owned, &root).await,
        Err(MigrationError::OwnershipUnavailable)
    ));
    sqlx::query("PRAGMA user_version = 999")
        .execute(storage.pool())
        .await?;
    storage.close().await;
    let before = std::fs::read(owned.join("server.sqlite3"))?;
    assert!(matches!(
        run(&owned, &root).await,
        Err(MigrationError::IncompatibleDatabase)
    ));
    assert!(
        before == std::fs::read(owned.join("server.sqlite3"))?,
        "future-schema refusal changed database"
    );
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    Ok(())
}

async fn assert_interrupted(source: &Path, root: &Path, stage: Stage) -> TestResult {
    let id = recovery_id(source)?;
    let bundle = root.join(id);
    backup::verify(&bundle).await?;
    let pool = read_pool(source).await?;
    let expected = if stage == Stage::AfterCommit { 2 } else { 1 };
    assert_eq!(
        sqlx::query_scalar::<_, i64>("PRAGMA user_version")
            .fetch_one(&pool)
            .await?,
        expected
    );
    schema::verify(&pool).await?;
    pool.close().await;
    for open in [
        ServerStorage::open(source).await,
        ServerStorage::open_identity(source).await,
    ] {
        assert!(matches!(open, Err(StorageError::IncompleteMigration)));
    }
    assert!(matches!(
        run(source, root).await,
        Err(MigrationError::IncompleteMigration)
    ));
    assert_eq!(std::fs::read_dir(root)?.count(), 1);
    // Preserve the failed source, restore the known-good point elsewhere, retry.
    let restored = source.with_file_name("restored-and-retried");
    backup::restore(&bundle, &restored).await?;
    assert!(matches!(
        run(&restored, root).await?,
        MigrationOutcome::Migrated { .. }
    ));
    let storage = ServerStorage::open_identity(&restored).await?;
    storage.close().await;
    assert!(source.join(MIGRATION_MARKER).exists());
    backup::verify(&bundle).await?;
    Ok(())
}

#[tokio::test]
async fn failed_steps_keep_recovery_marker_and_roll_back_until_commit() -> TestResult {
    for stage in [
        Stage::BeforeTransaction,
        Stage::AfterDdl,
        Stage::BeforeCommit,
        Stage::AfterCommit,
    ] {
        let temporary = tempfile::tempdir()?;
        let source = temporary.path().join("source");
        let root = temporary.path().join("backups");
        std::fs::create_dir(&root)?;
        fixture(&source, None).await?;
        assert!(matches!(
            run_interrupted(&source, &root, Interruption::ErrorAt(stage)).await,
            Err(MigrationError::Failed)
        ));
        assert_interrupted(&source, &root, stage).await?;
    }
    Ok(())
}

#[tokio::test]
async fn forced_exit_recovers_pre_and_post_commit_without_using_partial_state() -> TestResult {
    for (name, stage) in [
        ("before-transaction", Stage::BeforeTransaction),
        ("after-ddl", Stage::AfterDdl),
        ("before-commit", Stage::BeforeCommit),
        ("after-commit", Stage::AfterCommit),
    ] {
        let temporary = tempfile::tempdir()?;
        let source = temporary.path().join("source");
        let root = temporary.path().join("backups");
        std::fs::create_dir(&root)?;
        fixture(&source, None).await?;
        let mut child = Command::new(std::env::current_exe()?)
            .args(["--exact", "migration::tests::interruption_child"])
            .env("SNAPTIUM_TEST_MIGRATION_SOURCE", &source)
            .env("SNAPTIUM_TEST_MIGRATION_ROOT", &root)
            .env("SNAPTIUM_TEST_MIGRATION_STAGE", name)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        let deadline = Instant::now() + Duration::from_secs(15);
        let status = loop {
            if let Some(status) = child.try_wait()? {
                break status;
            }
            if Instant::now() >= deadline {
                child.kill()?;
                child.wait()?;
                return Err("migration test child timed out".into());
            }
            std::thread::sleep(Duration::from_millis(20));
        };
        assert_eq!(status.code(), Some(91));
        assert_interrupted(&source, &root, stage).await?;
    }
    Ok(())
}

/// Helper entry is compiled only into the unit-test executable, not the server.
#[tokio::test]
async fn interruption_child() -> TestResult {
    let Some(source) = std::env::var_os("SNAPTIUM_TEST_MIGRATION_SOURCE") else {
        return Ok(());
    };
    let root =
        PathBuf::from(std::env::var_os("SNAPTIUM_TEST_MIGRATION_ROOT").ok_or("missing test root")?);
    let stage = match std::env::var("SNAPTIUM_TEST_MIGRATION_STAGE")?.as_str() {
        "before-transaction" => Stage::BeforeTransaction,
        "after-ddl" => Stage::AfterDdl,
        "before-commit" => Stage::BeforeCommit,
        "after-commit" => Stage::AfterCommit,
        _ => return Err("invalid test interruption stage".into()),
    };
    run_interrupted(&PathBuf::from(source), &root, Interruption::ExitAt(stage)).await?;
    Err("test interruption did not occur".into())
}
