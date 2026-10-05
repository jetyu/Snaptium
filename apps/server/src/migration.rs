//! Explicit offline upgrades only. Normal startup never migrates existing data.
use std::{io::Write, path::Path};

use serde::Serialize;
use sqlx::SqliteConnection;

use crate::{
    backup::{self, BackupError, BackupInfo},
    schema,
    storage::ServerStorage,
};

pub(crate) const MIGRATION_MARKER: &str = "migration.in-progress";

#[derive(Debug, PartialEq, Eq)]
pub enum MigrationError {
    SourceUnavailable,
    OwnershipUnavailable,
    IncompatibleDatabase,
    IncompleteMigration,
    AdministratorRequired,
    RecoveryPointUnavailable,
    Failed,
}
impl std::fmt::Display for MigrationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::SourceUnavailable => "migration_source_unavailable",
            Self::OwnershipUnavailable => "storage_ownership_unavailable",
            Self::IncompatibleDatabase => "incompatible_database",
            Self::IncompleteMigration => "incomplete_migration",
            Self::AdministratorRequired => "migration_administrator_required",
            Self::RecoveryPointUnavailable => "migration_recovery_point_unavailable",
            Self::Failed => "migration_failed",
        })
    }
}
impl std::error::Error for MigrationError {}

pub enum MigrationOutcome {
    AlreadyCurrent,
    Migrated { recovery_backup: BackupInfo },
}

/// No paths or account/content values; the operator retains the backup root.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryRecord<'a> {
    format_version: u32,
    application_version: &'a str,
    source_schema: u32,
    target_schema: u32,
    recovery_backup_id: &'a str,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    BeforeTransaction,
    AfterDdl,
    AfterBackfill,
    BeforeCommit,
    AfterCommit,
}

#[derive(Clone, Copy)]
enum Step {
    Identity,
    Notes,
}
impl Step {
    fn source(self) -> u32 {
        match self {
            Self::Identity => 1,
            Self::Notes => 2,
        }
    }
    fn target(self) -> u32 {
        self.source() + 1
    }
    fn sql(self) -> &'static str {
        match self {
            Self::Identity => schema::IDENTITY_SQL,
            Self::Notes => schema::NOTE_STORAGE_SQL,
        }
    }
}
#[derive(Clone, Copy)]
enum Interruption {
    None,
    #[cfg(test)]
    ErrorAt(Stage),
    #[cfg(test)]
    ExitAt(Stage),
}
fn checkpoint(_stage: Stage, _interruption: Interruption) -> Result<(), MigrationError> {
    #[cfg(test)]
    match _interruption {
        Interruption::ErrorAt(stage) if stage == _stage => return Err(MigrationError::Failed),
        // Test executable only: emulate abrupt termination without Rust/SQLite
        // destructors, without shipping a production failure environment flag.
        Interruption::ExitAt(stage) if stage == _stage => std::process::exit(91),
        _ => (),
    }
    Ok(())
}

pub async fn run(source: &Path, backup_root: &Path) -> Result<MigrationOutcome, MigrationError> {
    run_interrupted(source, backup_root, Interruption::None).await
}

/// Explicit adjacent schema-2 to schema-3 step. Never skips identity migration.
pub async fn run_notes(
    source: &Path,
    backup_root: &Path,
) -> Result<MigrationOutcome, MigrationError> {
    run_step_interrupted(source, backup_root, Step::Notes, Interruption::None).await
}

async fn run_interrupted(
    source: &Path,
    backup_root: &Path,
    interruption: Interruption,
) -> Result<MigrationOutcome, MigrationError> {
    run_step_interrupted(source, backup_root, Step::Identity, interruption).await
}

async fn run_step_interrupted(
    source: &Path,
    backup_root: &Path,
    step: Step,
    interruption: Interruption,
) -> Result<MigrationOutcome, MigrationError> {
    let storage = backup::open_existing(source)
        .await
        .map_err(|error| match error {
            BackupError::OwnershipUnavailable => MigrationError::OwnershipUnavailable,
            BackupError::IncompatibleBackup => MigrationError::IncompatibleDatabase,
            BackupError::IncompleteMigration => MigrationError::IncompleteMigration,
            _ => MigrationError::SourceUnavailable,
        })?;
    let result = migrate_owned(&storage, backup_root, step, interruption).await;
    // Retain ownership until all SQLite work is closed, including on failure.
    storage.close().await;
    result
}

async fn check_database(connection: &mut SqliteConnection) -> Result<(), MigrationError> {
    schema::verify_connection(connection)
        .await
        .map_err(|_| MigrationError::IncompatibleDatabase)?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check(1)")
        .fetch_one(&mut *connection)
        .await
        .map_err(|_| MigrationError::Failed)?;
    if integrity != "ok" {
        return Err(MigrationError::IncompatibleDatabase);
    }
    if sqlx::query("PRAGMA foreign_key_check")
        .fetch_optional(&mut *connection)
        .await
        .map_err(|_| MigrationError::Failed)?
        .is_some()
    {
        return Err(MigrationError::IncompatibleDatabase);
    }
    Ok(())
}

async fn check_accounts(connection: &mut SqliteConnection) -> Result<(), MigrationError> {
    let (populated, administrator): (bool, bool) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users), EXISTS(SELECT 1 FROM users WHERE is_admin = 1)",
    )
    .fetch_one(connection)
    .await
    .map_err(|_| MigrationError::Failed)?;
    if populated && !administrator {
        return Err(MigrationError::AdministratorRequired);
    }
    Ok(())
}

async fn migrate_owned(
    storage: &ServerStorage,
    backup_root: &Path,
    step: Step,
    interruption: Interruption,
) -> Result<MigrationOutcome, MigrationError> {
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(storage.pool())
        .await
        .map_err(|_| MigrationError::SourceUnavailable)?;
    if version != i64::from(step.source()) && version != i64::from(step.target()) {
        return Err(MigrationError::IncompatibleDatabase);
    }
    {
        let mut connection = storage
            .pool()
            .acquire()
            .await
            .map_err(|_| MigrationError::Failed)?;
        check_database(&mut connection).await?;
        if version == 1 {
            check_accounts(&mut connection).await?;
        }
    }
    if version == i64::from(step.target()) {
        return Ok(MigrationOutcome::AlreadyCurrent);
    }

    // A newly generated point, not an arbitrary old backup supplied by a user.
    // This phase owns its pool exclusively; no HTTP traffic or cooperating writer.
    let recovery = backup::create(storage, backup_root)
        .await
        .map_err(|_| MigrationError::RecoveryPointUnavailable)?;
    let verified = backup::verify(&backup_root.join(&recovery.backup_id))
        .await
        .map_err(|_| MigrationError::RecoveryPointUnavailable)?;
    if verified.backup_id != recovery.backup_id || verified.schema_version != step.source() {
        return Err(MigrationError::RecoveryPointUnavailable);
    }
    println!("recovery_point_created {}", recovery.backup_id);
    std::io::stdout()
        .flush()
        .map_err(|_| MigrationError::RecoveryPointUnavailable)?;
    let directory = storage.directory().to_path_buf();
    let backup_id = recovery.backup_id.clone();
    backup::blocking(move || {
        let record = RecoveryRecord {
            format_version: 1,
            application_version: env!("CARGO_PKG_VERSION"),
            source_schema: step.source(),
            target_schema: step.target(),
            recovery_backup_id: &backup_id,
        };
        let encoded = serde_json::to_vec(&record).map_err(|_| BackupError::Unavailable)?;
        let mut marker = backup::private_file(&directory.join(MIGRATION_MARKER))?;
        marker
            .write_all(&encoded)
            .and_then(|()| marker.sync_all())
            .map_err(|_| BackupError::Unavailable)?;
        backup::sync_directory(&directory)
    })
    .await
    .map_err(|_| MigrationError::Failed)?;
    checkpoint(Stage::BeforeTransaction, interruption)?;

    let mut transaction = storage
        .pool()
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(|_| MigrationError::Failed)?;
    let result = async {
        let current: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut *transaction)
            .await.map_err(|_| MigrationError::Failed)?;
        if current != i64::from(step.source()) { return Err(MigrationError::IncompatibleDatabase); }
        check_database(&mut transaction).await?;
        if current == 1 { check_accounts(&mut transaction).await?; }
        sqlx::raw_sql(&step.sql().replace("\r\n", "\n")).execute(&mut *transaction)
            .await.map_err(|_| MigrationError::Failed)?;
        checkpoint(Stage::AfterDdl, interruption)?;
        match step {
            Step::Identity => {
                sqlx::query("INSERT INTO bootstrap_state SELECT 1, CASE WHEN EXISTS(SELECT 1 FROM users) THEN 1 ELSE 0 END, ?")
                    .bind(schema::IDENTITY_SQL.replace("\r\n", "\n")).execute(&mut *transaction)
                    .await.map_err(|_| MigrationError::Failed)?;
                sqlx::query("PRAGMA user_version = 2").execute(&mut *transaction).await
                    .map_err(|_| MigrationError::Failed)?;
            }
            Step::Notes => {
                schema::backfill_notes(&mut transaction).await.map_err(|_| MigrationError::Failed)?;
                checkpoint(Stage::AfterBackfill, interruption)?;
            }
        }
        check_database(&mut transaction).await?;
        checkpoint(Stage::BeforeCommit, interruption)
    }.await;
    if let Err(error) = result {
        transaction
            .rollback()
            .await
            .map_err(|_| MigrationError::Failed)?;
        return Err(error);
    }
    transaction
        .commit()
        .await
        .map_err(|_| MigrationError::Failed)?;
    checkpoint(Stage::AfterCommit, interruption)?;
    {
        let mut connection = storage
            .pool()
            .acquire()
            .await
            .map_err(|_| MigrationError::Failed)?;
        check_database(&mut connection).await?;
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&mut *connection)
            .await
            .map_err(|_| MigrationError::Failed)?;
        if version != i64::from(step.target()) {
            return Err(MigrationError::IncompatibleDatabase);
        }
    }
    let directory = storage.directory().to_path_buf();
    backup::blocking(move || {
        std::fs::remove_file(directory.join(MIGRATION_MARKER))
            .map_err(|_| BackupError::Unavailable)?;
        backup::sync_directory(&directory)
    })
    .await
    .map_err(|_| MigrationError::Failed)?;
    Ok(MigrationOutcome::Migrated {
        recovery_backup: recovery,
    })
}

#[cfg(test)]
mod tests;
