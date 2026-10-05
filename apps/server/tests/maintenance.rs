//! Real maintenance processes; all paths and credentials are disposable.
use std::{
    path::Path,
    process::{Command, Output},
};

use snaptium_server::{
    identity::{BootstrapSecret, LoginName, Password},
    storage::ServerStorage,
};

fn run(arguments: &[&std::ffi::OsStr]) -> Result<Output, std::io::Error> {
    Command::new(env!("CARGO_BIN_EXE_snaptium-server"))
        .args(arguments)
        // Maintenance must not depend on Web assets or HTTP identity settings.
        .env("SNAPTIUM_WEB_DIR", "missing-web-build")
        .env("SNAPTIUM_PUBLIC_ORIGIN", "invalid-configuration")
        .env_remove("SNAPTIUM_BOOTSTRAP_SECRET_FILE")
        .output()
}

#[tokio::test]
async fn commands_restore_login_and_refuse_live_or_existing_data()
-> Result<(), Box<dyn std::error::Error>> {
    let temporary = tempfile::tempdir()?;
    let source = temporary.path().join("data");
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    let storage = ServerStorage::open_identity(&source).await?;
    let secret = BootstrapSecret::parse("ab".repeat(32))?;
    let password = "disposable test password 123";
    let id = storage
        .bootstrap_admin(
            &secret,
            &secret,
            LoginName::parse("alice")?,
            Password::for_creation(password.into())?,
        )
        .await?;
    let refused = run(&["backup".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(!refused.status.success());
    assert!(String::from_utf8(refused.stderr)?.contains("storage_ownership_unavailable"));
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    storage.close().await;
    let created = run(&["backup".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(created.status.success(), "maintenance backup failed");
    let stdout = String::from_utf8(created.stdout)?;
    let backup_id = stdout
        .trim()
        .strip_prefix("backup_created ")
        .ok_or("invalid maintenance output")?;
    let bundle = root.join(backup_id);
    let before = std::fs::read(source.join("server.sqlite3"))?;
    let verified = run(&["verify-backup".as_ref(), bundle.as_os_str()])?;
    assert!(verified.status.success());
    assert_eq!(verified.stdout, b"backup_verified\n");
    let overwrite = run(&["restore".as_ref(), bundle.as_os_str(), source.as_os_str()])?;
    assert!(!overwrite.status.success());
    assert_eq!(before, std::fs::read(source.join("server.sqlite3"))?);
    let target = temporary.path().join("restored");
    let restored = run(&["restore".as_ref(), bundle.as_os_str(), target.as_os_str()])?;
    assert!(restored.status.success());
    assert_eq!(restored.stdout, b"backup_restored\n");
    let storage = ServerStorage::open_identity(&target).await?;
    let account = storage
        .verify_credentials(
            LoginName::parse("alice")?,
            Password::for_verification(password.into())?,
        )
        .await?;
    assert_eq!(account.id.canonical(), id.canonical());
    assert!(account.is_admin);
    assert!(
        storage
            .bootstrap_admin(
                &secret,
                &secret,
                LoginName::parse("other")?,
                Password::for_creation(password.into())?
            )
            .await
            .is_err()
    );
    storage.close().await;
    for output in [
        created.stderr,
        verified.stderr,
        overwrite.stderr,
        restored.stderr,
    ] {
        let output = String::from_utf8(output)?;
        assert!(!output.contains(password));
        assert!(!output.contains("abababab"));
        assert!(!output.contains("$argon2"));
        assert!(!output.contains(&source.to_string_lossy().to_string()));
    }
    Ok(())
}

#[test]
fn invalid_arguments_and_missing_source_do_not_create_data()
-> Result<(), Box<dyn std::error::Error>> {
    let temporary = tempfile::tempdir()?;
    let missing = temporary.path().join("must-not-exist");
    for arguments in [
        vec!["unknown-sensitive-argument".as_ref()],
        vec!["backup".as_ref()],
        vec!["migrate".as_ref()],
        vec!["restore".as_ref(), Path::new("missing-backup").as_os_str()],
        vec![
            "backup".as_ref(),
            missing.as_os_str(),
            temporary.path().as_os_str(),
        ],
    ] {
        let output = run(&arguments)?;
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        let error = String::from_utf8(output.stderr)?;
        assert!(!error.contains("unknown-sensitive-argument"));
        assert!(!error.contains("must-not-exist"));
    }
    assert!(!missing.exists());
    Ok(())
}

#[tokio::test]
async fn offline_migrate_command_creates_recovery_once_and_blocks_interrupted_startup()
-> Result<(), Box<dyn std::error::Error>> {
    let temporary = tempfile::tempdir()?;
    let source = temporary.path().join("schema-one");
    let root = temporary.path().join("backups");
    std::fs::create_dir(&root)?;
    let storage = ServerStorage::open_initialized(&source).await?;
    let refused = run(&["migrate".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(!refused.status.success());
    assert!(String::from_utf8(refused.stderr)?.contains("storage_ownership_unavailable"));
    assert_eq!(std::fs::read_dir(&root)?.count(), 0);
    storage.close().await;
    let migrated = run(&["migrate".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(
        migrated.status.success(),
        "offline migration command failed"
    );
    let output = String::from_utf8(migrated.stdout)?;
    let lines: Vec<&str> = output.lines().collect();
    assert_eq!(lines.len(), 2);
    let id = lines[0]
        .strip_prefix("recovery_point_created ")
        .ok_or("missing test recovery output")?;
    assert_eq!(lines[1], "schema_migrated 1 2");
    let verified = run(&["verify-backup".as_ref(), root.join(id).as_os_str()])?;
    assert!(verified.status.success());
    let already_current = run(&["migrate".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(already_current.status.success());
    assert_eq!(already_current.stdout, b"schema_already_current\n");
    assert_eq!(std::fs::read_dir(&root)?.count(), 1);
    let restored = temporary.path().join("restored-schema-one");
    assert!(
        run(&[
            "restore".as_ref(),
            root.join(id).as_os_str(),
            restored.as_os_str()
        ])?
        .status
        .success()
    );
    assert!(matches!(
        ServerStorage::open_identity(&restored).await,
        Err(snaptium_server::storage::StorageError::IncompatibleDatabase)
    ));

    // A partial/corrupt marker is itself sufficient to fail closed; no production
    // failure-injection environment variable or arbitrary SQL command is shipped.
    std::fs::write(source.join("migration.in-progress"), "interrupted marker")?;
    let refused = run(&["migrate".as_ref(), source.as_os_str(), root.as_os_str()])?;
    assert!(!refused.status.success());
    assert!(String::from_utf8(refused.stderr)?.contains("incomplete_migration"));
    let before = std::fs::read(source.join("server.sqlite3"))?;
    let web = temporary.path().join("web");
    std::fs::create_dir(&web)?;
    std::fs::write(web.join("index.html"), "<!doctype html><div id=app></div>")?;
    let startup = Command::new(env!("CARGO_BIN_EXE_snaptium-server"))
        .env("SNAPTIUM_DATA_DIR", &source)
        .env("SNAPTIUM_WEB_DIR", &web)
        .env("SNAPTIUM_LISTEN", "127.0.0.1:0")
        .env("SNAPTIUM_PUBLIC_ORIGIN", "http://127.0.0.1:3000")
        .env("SNAPTIUM_ALLOW_HTTP_LOOPBACK", "true")
        .env_remove("SNAPTIUM_BOOTSTRAP_SECRET_FILE")
        .output()?;
    assert!(
        !startup.status.success(),
        "interrupted store started an HTTP service"
    );
    assert!(String::from_utf8(startup.stderr)?.contains("IncompleteMigration"));
    assert!(
        before == std::fs::read(source.join("server.sqlite3"))?,
        "interrupted startup modified database"
    );
    assert!(source.join("migration.in-progress").exists());
    assert_eq!(std::fs::read_dir(&root)?.count(), 1);
    Ok(())
}
