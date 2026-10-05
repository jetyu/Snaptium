use super::*;

type TestResult = Result<(), Box<dyn std::error::Error>>;

async fn fixture(
    directory: &Path,
    identity: bool,
) -> Result<ServerStorage, Box<dyn std::error::Error>> {
    let storage = if identity {
        ServerStorage::open_identity(directory).await?
    } else {
        ServerStorage::open_initialized(directory).await?
    };
    sqlx::query("INSERT INTO users VALUES ('owner', 'alice', 'test-only-verifier', 1, 5368709120, '2026-10-05T00:00:00Z')")
        .execute(storage.pool()).await?;
    sqlx::query("INSERT INTO notes VALUES ('note', 'owner', NULL, '原文', '# 原文\n\n未规范化  \n', 1, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z', NULL)")
        .execute(storage.pool()).await?;
    if identity {
        sqlx::query("UPDATE bootstrap_state SET closed = 1")
            .execute(storage.pool())
            .await?;
    }
    Ok(storage)
}

fn rewrite_manifest(
    bundle: &Path,
    change: impl FnOnce(&mut Manifest),
) -> Result<(), Box<dyn std::error::Error>> {
    let path = bundle.join(MANIFEST);
    let mut manifest: Manifest = serde_json::from_slice(&fs::read(&path)?)?;
    change(&mut manifest);
    fs::write(path, serde_json::to_vec(&manifest)?)?;
    Ok(())
}

#[tokio::test]
async fn restores_both_supported_schemas_without_changing_source_or_bootstrap() -> TestResult {
    for identity in [false, true] {
        let temporary = tempfile::tempdir()?;
        let storage = fixture(&temporary.path().join("source"), identity).await?;
        let root = temporary.path().join("backups");
        fs::create_dir(&root)?;
        let info = create(&storage, &root).await?;
        let bundle = root.join(&info.backup_id);
        let before = fs::read(bundle.join(DATABASE))?;
        assert_eq!(info.schema_version, if identity { 2 } else { 1 });
        verify(&bundle).await?;
        let target = temporary.path().join("restored");
        restore(&bundle, &target).await?;
        assert!(!target.join(RESTORE_MARKER).exists());
        assert!(!target.join("database.partial").exists());
        assert_eq!(before, fs::read(target.join(DATABASE))?);
        let restored = ServerStorage::open_initialized(&target).await?;
        let content: String = sqlx::query_scalar("SELECT markdown FROM notes WHERE id = 'note'")
            .fetch_one(restored.pool())
            .await?;
        assert_eq!(content, "# 原文\n\n未规范化  \n");
        if identity {
            let closed: i64 = sqlx::query_scalar("SELECT closed FROM bootstrap_state")
                .fetch_one(restored.pool())
                .await?;
            assert_eq!(closed, 1);
        } else {
            restored.close().await;
            assert!(matches!(
                ServerStorage::open_identity(&target).await,
                Err(crate::storage::StorageError::IncompatibleDatabase)
            ));
            storage.close().await;
            continue;
        }
        assert_eq!(before, fs::read(bundle.join(DATABASE))?);
        restored.close().await;
        storage.close().await;
    }
    Ok(())
}

#[tokio::test]
async fn snapshot_includes_committed_wal_but_not_uncommitted_transaction() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    sqlx::query("PRAGMA wal_autocheckpoint = 0")
        .execute(storage.pool())
        .await?;
    sqlx::query("UPDATE notes SET title = '已提交', revision = 2")
        .execute(storage.pool())
        .await?;
    assert!(
        storage
            .directory()
            .join("server.sqlite3-wal")
            .metadata()?
            .len()
            > 0
    );
    let mut transaction = storage.pool().begin().await?;
    sqlx::query("UPDATE notes SET title = '未提交', revision = 3")
        .execute(&mut *transaction)
        .await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    transaction.rollback().await?;
    let target = temporary.path().join("restored");
    restore(&root.join(info.backup_id), &target).await?;
    let restored = ServerStorage::open_identity(&target).await?;
    let row: (String, i64) = sqlx::query_as("SELECT title, revision FROM notes")
        .fetch_one(restored.pool())
        .await?;
    assert_eq!(row, ("已提交".into(), 2));
    restored.close().await;
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn concurrent_commits_never_split_atomic_note_changes() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    sqlx::query("UPDATE notes SET title = '1', markdown = '1'")
        .execute(storage.pool())
        .await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let writes = async {
        for revision in 2..=40_i64 {
            sqlx::query("UPDATE notes SET title = ?, markdown = ?, revision = ?")
                .bind(revision.to_string())
                .bind(revision.to_string())
                .bind(revision)
                .execute(storage.pool())
                .await?;
            tokio::task::yield_now().await;
        }
        Ok::<_, sqlx::Error>(())
    };
    let snapshots = async {
        for index in 0..3 {
            let info = create(&storage, &root).await?;
            let target = temporary.path().join(format!("restored-{index}"));
            restore(&root.join(info.backup_id), &target).await?;
            let restored = ServerStorage::open_identity(&target).await?;
            let row: (String, String, i64) =
                sqlx::query_as("SELECT title, markdown, revision FROM notes")
                    .fetch_one(restored.pool())
                    .await?;
            assert_eq!(row.0, row.1);
            assert_eq!(row.0, row.2.to_string());
            restored.close().await;
        }
        Ok::<_, Box<dyn std::error::Error>>(())
    };
    let (written, snapshots) = tokio::join!(writes, snapshots);
    written?;
    snapshots?;
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn invalid_manifests_and_hashes_never_create_restore_target() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    let bundle = root.join(info.backup_id);
    let original = fs::read(bundle.join(MANIFEST))?;
    let mutations: [fn(&mut Manifest); 9] = [
        |m| m.format_version = 2,
        |m| m.schema_version = 999,
        |m| m.application_version = "999.0.0".into(),
        |m| m.attachment_count = 1,
        |m| m.database.path = "../server.sqlite3".into(),
        |m| m.database.bytes += 1,
        |m| m.database.sha256 = "0".repeat(64),
        |m| m.backup_id = "not-an-id".into(),
        |m| m.created_at_unix_seconds = 0,
    ];
    for change in mutations {
        fs::write(bundle.join(MANIFEST), &original)?;
        rewrite_manifest(&bundle, change)?;
        let target = temporary.path().join("refused");
        assert!(restore(&bundle, &target).await.is_err());
        assert!(!target.exists());
    }
    for encoded in [
        b"{}".to_vec(),
        vec![b' '; 4097],
        [original.as_slice(), b" trailing"].concat(),
        br#"{"formatVersion":1,"formatVersion":1}"#.to_vec(),
    ] {
        fs::write(bundle.join(MANIFEST), encoded)?;
        assert!(verify(&bundle).await.is_err());
    }
    fs::write(bundle.join(MANIFEST), &original)?;
    let mut value: serde_json::Value = serde_json::from_slice(&original)?;
    value["secret"] = "must-not-be-accepted".into();
    fs::write(bundle.join(MANIFEST), serde_json::to_vec(&value)?)?;
    assert!(matches!(
        verify(&bundle).await,
        Err(BackupError::InvalidBackup)
    ));
    fs::write(bundle.join(MANIFEST), &original)?;
    fs::write(bundle.join(DATABASE), "truncated database")?;
    assert!(matches!(
        verify(&bundle).await,
        Err(BackupError::InvalidBackup)
    ));
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn matching_hash_does_not_bypass_schema_or_foreign_key_validation() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    for (sql, incompatible) in [
        ("PRAGMA user_version = 999", true),
        ("CREATE TABLE unexpected (id INTEGER)", true),
        (
            "UPDATE schema_metadata SET migration_sql = 'tampered'",
            true,
        ),
        (
            "UPDATE schema_metadata SET migration_sql = printf('%.*c', 65536, 'x')",
            true,
        ),
        (
            "UPDATE bootstrap_state SET migration_sql = printf('%.*c', 65536, 'x')",
            true,
        ),
        (
            "PRAGMA foreign_keys = OFF; UPDATE notes SET owner_id = 'missing'",
            false,
        ),
    ] {
        let info = create(&storage, &root).await?;
        let bundle = root.join(info.backup_id);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(bundle.join(DATABASE))
                    .journal_mode(sqlx::sqlite::SqliteJournalMode::Delete)
                    .disable_statement_logging(),
            )
            .await?;
        sqlx::raw_sql(sql).execute(&pool).await?;
        pool.close().await;
        let updated = digest(&bundle.join(DATABASE))?;
        rewrite_manifest(&bundle, |m| m.database = updated)?;
        let result = verify(&bundle).await;
        if incompatible {
            assert!(matches!(result, Err(BackupError::IncompatibleBackup)));
        } else {
            assert!(matches!(result, Err(BackupError::InvalidBackup)));
        }
        assert!(
            restore(&bundle, &temporary.path().join("refused"))
                .await
                .is_err()
        );
        assert!(!temporary.path().join("refused").exists());
    }
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn existing_targets_and_unsupported_data_are_preserved() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    let bundle = root.join(info.backup_id);
    assert!(matches!(
        restore(&bundle, &bundle.join("nested-restore")).await,
        Err(BackupError::InvalidInput)
    ));
    verify(&bundle).await?;
    let existing = temporary.path().join("existing");
    fs::create_dir(&existing)?;
    fs::write(existing.join("keep"), "existing-user-data")?;
    assert!(matches!(
        restore(&bundle, &existing).await,
        Err(BackupError::TargetExists)
    ));
    assert_eq!(fs::read(existing.join("keep"))?, b"existing-user-data");
    assert_eq!(fs::read_dir(&existing)?.count(), 1);
    assert!(matches!(
        restore(&bundle, storage.directory()).await,
        Err(BackupError::TargetExists)
    ));
    fs::create_dir(storage.directory().join("attachments"))?;
    assert!(matches!(
        create(&storage, &root).await,
        Err(BackupError::UnsupportedData)
    ));
    fs::write(bundle.join("unexpected"), "extra-file")?;
    assert!(matches!(
        verify(&bundle).await,
        Err(BackupError::UnsupportedData)
    ));
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn missing_manifests_and_interrupted_restores_fail_closed() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let incomplete = temporary.path().join("incomplete-backup");
    fs::create_dir(&incomplete)?;
    fs::write(incomplete.join(DATABASE), "partial")?;
    assert!(verify(&incomplete).await.is_err());
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    let bundle = root.join(info.backup_id);
    fs::write(bundle.join("manifest.partial"), "interrupted-publication")?;
    assert!(verify(&bundle).await.is_err());
    storage.close().await;
    for stage in [0, 1, 2] {
        let target = temporary.path().join(format!("interrupted-{stage}"));
        fs::create_dir(&target)?;
        fs::write(target.join(RESTORE_MARKER), "")?;
        if stage > 0 {
            fs::write(target.join("database.partial"), "partial")?;
        }
        if stage > 1 {
            fs::write(target.join(DATABASE), "partial-published")?;
        }
        assert!(matches!(
            ServerStorage::open_identity(&target).await,
            Err(crate::storage::StorageError::IncompleteRestore)
        ));
        assert!(target.join(RESTORE_MARKER).exists());
        if stage == 0 {
            assert!(!target.join(DATABASE).exists());
        }
        if stage > 1 {
            assert_eq!(fs::read(target.join(DATABASE))?, b"partial-published");
        }
    }
    Ok(())
}

#[tokio::test]
async fn checksum_matching_corruption_is_not_accepted_as_a_database() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    let bundle = root.join(info.backup_id);
    let mut content = fs::read(bundle.join(DATABASE))?;
    content[..16].fill(0);
    fs::write(bundle.join(DATABASE), content)?;
    let changed = digest(&bundle.join(DATABASE))?;
    rewrite_manifest(&bundle, |m| m.database = changed)?;
    assert!(matches!(
        verify(&bundle).await,
        Err(BackupError::InvalidBackup)
    ));
    let target = temporary.path().join("refused");
    assert!(restore(&bundle, &target).await.is_err());
    assert!(!target.exists());
    storage.close().await;
    Ok(())
}

#[tokio::test]
async fn backup_root_cannot_be_nested_under_source() -> TestResult {
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    assert!(matches!(
        create(&storage, storage.directory()).await,
        Err(BackupError::InvalidInput)
    ));
    storage.close().await;
    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn symlinks_are_refused_and_created_recovery_files_are_private() -> TestResult {
    use std::os::unix::fs::{PermissionsExt, symlink};
    let temporary = tempfile::tempdir()?;
    let storage = fixture(&temporary.path().join("source"), true).await?;
    let root = temporary.path().join("backups");
    fs::create_dir(&root)?;
    let info = create(&storage, &root).await?;
    let bundle = root.join(info.backup_id);
    assert_eq!(bundle.metadata()?.permissions().mode() & 0o777, 0o700);
    for name in [DATABASE, MANIFEST] {
        assert_eq!(
            bundle.join(name).metadata()?.permissions().mode() & 0o777,
            0o600
        );
    }
    let linked = temporary.path().join("linked-bundle");
    symlink(&bundle, &linked)?;
    assert!(verify(&linked).await.is_err());
    let saved = temporary.path().join("saved-manifest");
    fs::rename(bundle.join(MANIFEST), &saved)?;
    symlink(&saved, bundle.join(MANIFEST))?;
    assert!(verify(&bundle).await.is_err());
    storage.close().await;
    Ok(())
}
