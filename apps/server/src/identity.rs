//! Credential checking and one-time bootstrap only; no HTTP/session issuance.
use argon2::{
    Algorithm, Argon2, Params, PasswordHash, PasswordHasher, PasswordVerifier, Version,
    password_hash::SaltString,
};
use rand_core::{OsRng, RngCore};
use subtle::ConstantTimeEq;
use tokio::sync::Semaphore;
use zeroize::Zeroizing;

use crate::{repository::EntityId, storage::ServerStorage};

static HASH_SLOTS: Semaphore = Semaphore::const_new(2);
const MIN_NEW_PASSWORD_CHARS: usize = 15;
const MAX_PASSWORD_BYTES: usize = 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum IdentityError {
    InvalidInput,
    Rejected,
    Busy,
    Unavailable,
}
impl std::fmt::Display for IdentityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidInput => "invalid_identity_input",
            Self::Rejected => "authentication_rejected",
            Self::Busy => "identity_busy",
            Self::Unavailable => "identity_unavailable",
        })
    }
}
impl std::error::Error for IdentityError {}

// No Debug/Serialize for passwords, verifiers, bootstrap secrets or login names.
pub struct Password(Zeroizing<String>);
impl Password {
    pub fn for_creation(value: String) -> Result<Self, IdentityError> {
        let value = Zeroizing::new(value);
        if value.len() > MAX_PASSWORD_BYTES || value.chars().count() < MIN_NEW_PASSWORD_CHARS {
            return Err(IdentityError::InvalidInput);
        }
        Ok(Self(value))
    }
    pub fn for_verification(value: String) -> Result<Self, IdentityError> {
        let value = Zeroizing::new(value);
        if value.is_empty() || value.len() > MAX_PASSWORD_BYTES {
            return Err(IdentityError::Rejected);
        }
        Ok(Self(value))
    }
}

pub struct LoginName(String);
impl LoginName {
    /// ASCII account identifiers avoid locale/case/Unicode normalization ambiguity.
    pub fn parse(value: &str) -> Result<Self, IdentityError> {
        if !(3..=64).contains(&value.len())
            || !value
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
        {
            return Err(IdentityError::InvalidInput);
        }
        Ok(Self(value.to_owned()))
    }
}

pub struct BootstrapSecret(Zeroizing<String>);
impl BootstrapSecret {
    /// 32 random bytes encoded as 64 lowercase hex characters. Entropy must be
    /// provided by the operator; shape validation cannot prove randomness.
    pub fn parse(value: String) -> Result<Self, IdentityError> {
        let value = Zeroizing::new(value);
        if value.len() != 64
            || !value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(IdentityError::InvalidInput);
        }
        Ok(Self(value))
    }
}

fn algorithm() -> Result<Argon2<'static>, IdentityError> {
    let params = Params::new(19456, 2, 1, Some(32)).map_err(|_| IdentityError::Unavailable)?;
    Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
}

async fn hash(password: Password) -> Result<Zeroizing<String>, IdentityError> {
    let permit = HASH_SLOTS.try_acquire().map_err(|_| IdentityError::Busy)?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit; // Retained until blocking work ends, even if caller cancels.
        let mut bytes = Zeroizing::new([0_u8; 16]);
        OsRng
            .try_fill_bytes(&mut *bytes)
            .map_err(|_| IdentityError::Unavailable)?;
        let salt = SaltString::encode_b64(&*bytes).map_err(|_| IdentityError::Unavailable)?;
        algorithm()?
            .hash_password(password.0.as_bytes(), &salt)
            .map(|value| Zeroizing::new(value.to_string()))
            .map_err(|_| IdentityError::Unavailable)
    })
    .await
    .map_err(|_| IdentityError::Unavailable)?
}

async fn verify(password: Password, verifier: Zeroizing<String>) -> Result<(), IdentityError> {
    if verifier.len() > 256 {
        return Err(IdentityError::Rejected);
    }
    let permit = HASH_SLOTS.try_acquire().map_err(|_| IdentityError::Busy)?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let parsed = PasswordHash::new(&verifier).map_err(|_| IdentityError::Rejected)?;
        // Refuse unrecognized or oversized cost parameters before allocating memory.
        if parsed.algorithm.as_str() != "argon2id"
            || parsed.version != Some(19)
            || parsed.params.to_string() != "m=19456,t=2,p=1"
            || parsed.hash.map(|value| value.len()) != Some(32)
            || parsed.salt.map(|value| value.as_str().len()) != Some(22)
        {
            return Err(IdentityError::Rejected);
        }
        algorithm()?
            .verify_password(password.0.as_bytes(), &parsed)
            .map_err(|_| IdentityError::Rejected)
    })
    .await
    .map_err(|_| IdentityError::Unavailable)?
}

pub struct AuthenticatedAccount {
    pub id: EntityId,
    pub is_admin: bool,
}

impl ServerStorage {
    /// Trusted caller supplies configured authority and validated candidate secret.
    /// No secrets or credential hashes are returned. Bootstrap does not issue a session.
    pub async fn bootstrap_admin(
        &self,
        authority: &BootstrapSecret,
        candidate: &BootstrapSecret,
        login: LoginName,
        password: Password,
    ) -> Result<EntityId, IdentityError> {
        if password.0.chars().count() < MIN_NEW_PASSWORD_CHARS {
            return Err(IdentityError::InvalidInput);
        }
        if !bool::from(authority.0.as_bytes().ct_eq(candidate.0.as_bytes())) {
            return Err(IdentityError::Rejected);
        }
        let verifier = hash(password).await?;
        let id = uuid::Uuid::now_v7().to_string();
        let entity_id = EntityId::parse(&id).map_err(|_| IdentityError::Unavailable)?;
        let mut tx = self
            .pool()
            .begin()
            .await
            .map_err(|_| IdentityError::Unavailable)?;
        // The first statement acquires the SQLite writer lock. Account insert and
        // irreversible closure are committed together; competing callers recheck.
        let result = async {
            let claimed = sqlx::query("UPDATE bootstrap_state SET closed = 1 WHERE singleton = 1 AND closed = 0 AND NOT EXISTS (SELECT 1 FROM users)")
                .execute(&mut *tx).await.map_err(|_| IdentityError::Unavailable)?;
            if claimed.rows_affected() != 1 { return Err(IdentityError::Rejected); }
            sqlx::query("INSERT INTO users (id, login, password_verifier, is_admin, quota_bytes, created_at) SELECT ?, ?, ?, 1, default_quota_bytes, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM server_policy WHERE singleton = 1")
                .bind(&id).bind(&login.0).bind(verifier.as_str()).execute(&mut *tx).await.map_err(|_| IdentityError::Unavailable)?;
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE id = ?").bind(&id).fetch_one(&mut *tx).await.map_err(|_| IdentityError::Unavailable)?;
            if count != 1 { return Err(IdentityError::Unavailable); }
            Ok(())
        }.await;
        if let Err(error) = result {
            tx.rollback()
                .await
                .map_err(|_| IdentityError::Unavailable)?;
            return Err(error);
        }
        tx.commit().await.map_err(|_| IdentityError::Unavailable)?;
        Ok(entity_id)
    }

    /// Credential verification is not a Web session and must not be exposed until
    /// rate limits, CSRF/session policy and HTTPS requirements are implemented.
    pub async fn verify_credentials(
        &self,
        login: LoginName,
        password: Password,
    ) -> Result<AuthenticatedAccount, IdentityError> {
        let row: Option<(String, String, bool)> =
            sqlx::query_as("SELECT id, password_verifier, is_admin FROM users WHERE login = ?")
                .bind(&login.0)
                .fetch_optional(self.pool())
                .await
                .map_err(|_| IdentityError::Unavailable)?;
        let Some((id, verifier, is_admin)) = row else {
            // Perform the same policy's Argon2 work without manufacturing success.
            let _dummy = hash(password).await?;
            return Err(IdentityError::Rejected);
        };
        verify(password, Zeroizing::new(verifier)).await?;
        let id = EntityId::parse(&id).map_err(|_| IdentityError::Rejected)?;
        Ok(AuthenticatedAccount { id, is_admin })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::ConnectOptions;
    static TEST_HASH_SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    fn password() -> Result<Password, IdentityError> {
        Password::for_creation("test password 长度足够 123".into())
    }
    fn secret() -> Result<BootstrapSecret, IdentityError> {
        BootstrapSecret::parse("ab".repeat(32))
    }

    #[test]
    fn rejects_invalid_boundary_inputs() {
        assert!(Password::for_creation("short".into()).is_err());
        assert!(Password::for_creation("a".repeat(1025)).is_err());
        assert!(Password::for_verification(String::new()).is_err());
        assert!(BootstrapSecret::parse("secret".into()).is_err());
        for value in ["a", " Alice", "ALICE", "名字", "alice' OR 1=1"] {
            assert!(LoginName::parse(value).is_err());
        }
        assert!(LoginName::parse("alice-01").is_ok());
    }

    #[tokio::test]
    async fn salted_versioned_hashes_and_generic_failures() -> Result<(), Box<dyn std::error::Error>>
    {
        let _guard = TEST_HASH_SERIAL.lock().await;
        let first = hash(password()?).await?;
        let second = hash(password()?).await?;
        assert!(first.as_str() != second.as_str());
        assert!(first.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        verify(password()?, first.clone()).await?;
        assert_eq!(
            verify(Password::for_verification("wrong".into())?, first.clone()).await,
            Err(IdentityError::Rejected)
        );
        assert_eq!(
            verify(
                password()?,
                Zeroizing::new(first.replace("m=19456", "m=999999999"))
            )
            .await,
            Err(IdentityError::Rejected)
        );
        assert_eq!(
            verify(password()?, Zeroizing::new("malformed".into())).await,
            Err(IdentityError::Rejected)
        );
        Ok(())
    }

    #[tokio::test]
    async fn hash_capacity_is_bounded_without_waiting() -> Result<(), Box<dyn std::error::Error>> {
        let _guard = TEST_HASH_SERIAL.lock().await;
        let _first = HASH_SLOTS.acquire().await?;
        let _second = HASH_SLOTS.acquire().await?;
        assert!(matches!(hash(password()?).await, Err(IdentityError::Busy)));
        Ok(())
    }

    #[tokio::test]
    async fn bootstrap_is_atomic_and_permanently_closed_after_reopen()
    -> Result<(), Box<dyn std::error::Error>> {
        let _guard = TEST_HASH_SERIAL.lock().await;
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_identity(directory.path()).await?;
        // A verification input cannot bypass the new-account minimum length.
        assert!(matches!(
            storage
                .bootstrap_admin(
                    &secret()?,
                    &secret()?,
                    LoginName::parse("alice")?,
                    Password::for_verification("short".into())?
                )
                .await,
            Err(IdentityError::InvalidInput)
        ));
        let wrong = BootstrapSecret::parse("cd".repeat(32))?;
        assert!(matches!(
            storage
                .bootstrap_admin(&secret()?, &wrong, LoginName::parse("alice")?, password()?)
                .await,
            Err(IdentityError::Rejected)
        ));
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
            .fetch_one(storage.pool())
            .await?;
        assert_eq!(count, 0);
        let authority = secret()?;
        let candidate = secret()?;
        let (first, second) = tokio::join!(
            storage.bootstrap_admin(
                &authority,
                &candidate,
                LoginName::parse("alice")?,
                password()?
            ),
            storage.bootstrap_admin(
                &authority,
                &candidate,
                LoginName::parse("bob")?,
                password()?
            )
        );
        assert_eq!(usize::from(first.is_ok()) + usize::from(second.is_ok()), 1);
        assert!(matches!(
            first.as_ref().err().or(second.as_ref().err()),
            Some(IdentityError::Rejected)
        ));
        let login: String = sqlx::query_scalar("SELECT login FROM users")
            .fetch_one(storage.pool())
            .await?;
        let account = storage
            .verify_credentials(LoginName::parse(&login)?, password()?)
            .await?;
        assert!(account.is_admin);
        assert!(EntityId::parse(&account.id.canonical()).is_ok());
        assert!(matches!(
            storage
                .verify_credentials(
                    LoginName::parse(&login)?,
                    Password::for_verification("wrong".into())?
                )
                .await,
            Err(IdentityError::Rejected)
        ));
        assert!(matches!(
            storage
                .verify_credentials(LoginName::parse("missing")?, password()?)
                .await,
            Err(IdentityError::Rejected)
        ));
        storage.close().await;
        let storage = ServerStorage::open_identity(directory.path()).await?;
        // Simulated administrator removal must not reopen initialization.
        sqlx::query("DELETE FROM users")
            .execute(storage.pool())
            .await?;
        assert!(matches!(
            storage
                .bootstrap_admin(
                    &secret()?,
                    &secret()?,
                    LoginName::parse("later")?,
                    password()?
                )
                .await,
            Err(IdentityError::Rejected)
        ));
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn identity_refuses_schema_one_without_upgrade_or_data_loss()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let filename = directory.path().join("server.sqlite3");
        // Construct a valid old store in DELETE mode without racing a preceding
        // WAL pool's asynchronous connection teardown. Refuse before WAL setup.
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(&filename)
                    .create_if_missing(true)
                    .journal_mode(sqlx::sqlite::SqliteJournalMode::Delete)
                    .disable_statement_logging(),
            )
            .await?;
        crate::schema::initialize(&pool).await?;
        let mode: String = sqlx::query_scalar("PRAGMA journal_mode")
            .fetch_one(&pool)
            .await?;
        assert_eq!(mode, "delete");
        pool.close().await;
        let before = std::fs::read(&filename)?;
        assert!(matches!(
            ServerStorage::open_identity(directory.path()).await,
            Err(crate::storage::StorageError::IncompatibleDatabase)
        ));
        assert!(
            before == std::fs::read(filename)?,
            "refusal modified database bytes"
        );
        assert!(!directory.path().join("server.sqlite3-wal").exists());
        let reopened = ServerStorage::open_initialized(directory.path()).await?;
        reopened.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn identity_schema_markers_and_future_versions_fail_closed()
    -> Result<(), Box<dyn std::error::Error>> {
        for statement in [
            "UPDATE bootstrap_state SET migration_sql = 'changed'",
            "PRAGMA user_version = 3",
            "DELETE FROM bootstrap_state",
        ] {
            let directory = tempfile::tempdir()?;
            let storage = ServerStorage::open_identity(directory.path()).await?;
            sqlx::query(statement).execute(storage.pool()).await?;
            storage.close().await;
            let filename = directory.path().join("server.sqlite3");
            let before = std::fs::read(&filename)?;
            assert!(matches!(
                ServerStorage::open_identity(directory.path()).await,
                Err(crate::storage::StorageError::IncompatibleDatabase)
            ));
            assert!(
                before == std::fs::read(filename)?,
                "refusal modified identity database bytes"
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn failed_account_insert_rolls_back_bootstrap_claim()
    -> Result<(), Box<dyn std::error::Error>> {
        let _guard = TEST_HASH_SERIAL.lock().await;
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_identity(directory.path()).await?;
        sqlx::query("CREATE TRIGGER fail_user BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT, 'test'); END").execute(storage.pool()).await?;
        assert!(matches!(
            storage
                .bootstrap_admin(
                    &secret()?,
                    &secret()?,
                    LoginName::parse("alice")?,
                    password()?
                )
                .await,
            Err(IdentityError::Unavailable)
        ));
        let closed: i64 = sqlx::query_scalar("SELECT closed FROM bootstrap_state")
            .fetch_one(storage.pool())
            .await?;
        assert_eq!(closed, 0);
        sqlx::query("DROP TRIGGER fail_user")
            .execute(storage.pool())
            .await?;
        storage
            .bootstrap_admin(
                &secret()?,
                &secret()?,
                LoginName::parse("alice")?,
                password()?,
            )
            .await?;
        storage.close().await;
        Ok(())
    }
}
