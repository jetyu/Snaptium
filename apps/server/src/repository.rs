//! Server-only read models, not wire contracts or native database models.
use std::num::NonZeroU64;

use sqlx::Row;
use uuid::Uuid;

use crate::storage::ServerStorage;

/// Stable errors deliberately carry no SQL, paths, IDs, or note text.
#[derive(Debug, PartialEq, Eq)]
pub enum RepositoryError {
    InvalidInput,
    InvalidStoredData,
    Unavailable,
}

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidInput => "invalid_repository_input",
            Self::InvalidStoredData => "invalid_stored_data",
            Self::Unavailable => "repository_unavailable",
        })
    }
}
impl std::error::Error for RepositoryError {}

/// Validated canonical UUIDv7. Construction alone never proves authorization.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct EntityId(Uuid);

impl EntityId {
    pub fn parse(value: &str) -> Result<Self, RepositoryError> {
        if value.len() != 36 {
            return Err(RepositoryError::InvalidInput);
        }
        let id = Uuid::parse_str(value).map_err(|_| RepositoryError::InvalidInput)?;
        if id.get_version_num() != 7
            || id.get_variant() != uuid::Variant::RFC4122
            || id.hyphenated().to_string() != value
        {
            return Err(RepositoryError::InvalidInput);
        }
        Ok(Self(id))
    }

    pub fn canonical(self) -> String {
        self.0.hyphenated().to_string()
    }
}

/// Distinct owner type prevents accidentally using an entity ID as an owner.
/// Future handlers must obtain it from a verified session, never a request field.
#[derive(Clone, Copy)]
pub struct OwnerId(EntityId);

impl OwnerId {
    pub fn parse(value: &str) -> Result<Self, RepositoryError> {
        EntityId::parse(value).map(Self)
    }
}

pub struct FolderPageRequest {
    after: Option<EntityId>,
    limit: u16,
}

impl FolderPageRequest {
    pub fn new(after: Option<&str>, limit: u16) -> Result<Self, RepositoryError> {
        if !(1..=100).contains(&limit) {
            return Err(RepositoryError::InvalidInput);
        }
        Ok(Self {
            after: after.map(EntityId::parse).transpose()?,
            limit,
        })
    }
}

// Do not derive Debug/Serialize: note bodies and row models must not become logs
// or accidental API responses. HTTP DTOs belong in the protocol layer.
pub struct FolderRecord {
    pub id: EntityId,
    pub name: String,
    pub revision: NonZeroU64,
}

pub struct FolderPage {
    pub items: Vec<FolderRecord>,
    pub next_after: Option<EntityId>,
}

pub struct NoteRecord {
    pub id: EntityId,
    pub folder_id: Option<EntityId>,
    pub title: String,
    pub markdown: String,
    pub revision: NonZeroU64,
    pub is_trashed: bool,
}

/// A borrow, never a pool clone: storage ownership outlives every query.
pub struct ReadRepository<'a> {
    storage: &'a ServerStorage,
}

impl ServerStorage {
    pub fn reads(&self) -> ReadRepository<'_> {
        ReadRepository { storage: self }
    }
}

fn stored_id(value: &str) -> Result<EntityId, RepositoryError> {
    EntityId::parse(value).map_err(|_| RepositoryError::InvalidStoredData)
}

fn stored_revision(value: i64) -> Result<NonZeroU64, RepositoryError> {
    u64::try_from(value)
        .ok()
        .and_then(NonZeroU64::new)
        .ok_or(RepositoryError::InvalidStoredData)
}

impl ReadRepository<'_> {
    /// Foreign and nonexistent IDs both return None, without an existence probe.
    pub async fn note(
        &self,
        owner: OwnerId,
        id: EntityId,
    ) -> Result<Option<NoteRecord>, RepositoryError> {
        let row = sqlx::query("SELECT id, folder_id, title, markdown, revision, trashed_at IS NOT NULL AS is_trashed FROM notes WHERE owner_id = ? AND id = ?")
            .bind(owner.0.canonical()).bind(id.canonical())
            .fetch_optional(self.storage.pool()).await.map_err(|_| RepositoryError::Unavailable)?;
        let Some(row) = row else {
            return Ok(None);
        };
        let folder_id: Option<String> = row
            .try_get("folder_id")
            .map_err(|_| RepositoryError::InvalidStoredData)?;
        let id: String = row
            .try_get("id")
            .map_err(|_| RepositoryError::InvalidStoredData)?;
        Ok(Some(NoteRecord {
            id: stored_id(&id)?,
            folder_id: folder_id.as_deref().map(stored_id).transpose()?,
            title: row
                .try_get("title")
                .map_err(|_| RepositoryError::InvalidStoredData)?,
            markdown: row
                .try_get("markdown")
                .map_err(|_| RepositoryError::InvalidStoredData)?,
            revision: stored_revision(
                row.try_get("revision")
                    .map_err(|_| RepositoryError::InvalidStoredData)?,
            )?,
            is_trashed: row
                .try_get("is_trashed")
                .map_err(|_| RepositoryError::InvalidStoredData)?,
        }))
    }

    /// UUID keyset pagination: at most 100 items plus one lookahead row.
    /// Cursor UUIDs are ordering boundaries, not authority or an offline sync cursor.
    pub async fn folders(
        &self,
        owner: OwnerId,
        request: FolderPageRequest,
    ) -> Result<FolderPage, RepositoryError> {
        let rows = sqlx::query("SELECT id, name, revision FROM folders WHERE owner_id = ? AND id > ? ORDER BY id LIMIT ?")
            .bind(owner.0.canonical())
            .bind(request.after.map(EntityId::canonical).unwrap_or_default())
            .bind(i64::from(request.limit) + 1)
            .fetch_all(self.storage.pool()).await.map_err(|_| RepositoryError::Unavailable)?;
        let has_more = rows.len() > usize::from(request.limit);
        let mut items = Vec::with_capacity(usize::from(request.limit));
        for row in rows.into_iter().take(usize::from(request.limit)) {
            let id: String = row
                .try_get("id")
                .map_err(|_| RepositoryError::InvalidStoredData)?;
            let name: String = row
                .try_get("name")
                .map_err(|_| RepositoryError::InvalidStoredData)?;
            if name.trim().is_empty() {
                return Err(RepositoryError::InvalidStoredData);
            }
            items.push(FolderRecord {
                id: stored_id(&id)?,
                name,
                revision: stored_revision(
                    row.try_get("revision")
                        .map_err(|_| RepositoryError::InvalidStoredData)?,
                )?,
            });
        }
        let next_after = if has_more {
            items.last().map(|item| item.id)
        } else {
            None
        };
        Ok(FolderPage { items, next_after })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id() -> String {
        Uuid::now_v7().to_string()
    }

    async fn user(storage: &ServerStorage) -> Result<String, sqlx::Error> {
        let owner = id();
        sqlx::query("INSERT INTO users VALUES (?, ?, 'test-verifier', 0, 5368709120, '2026-10-05T00:00:00Z')")
            .bind(&owner).bind(&owner).execute(storage.pool()).await?;
        Ok(owner)
    }

    async fn folder(
        storage: &ServerStorage,
        owner: &str,
        name: &str,
    ) -> Result<String, sqlx::Error> {
        let folder = id();
        sqlx::query("INSERT INTO folders VALUES (?, ?, ?, 1, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z')")
            .bind(&folder).bind(owner).bind(name).execute(storage.pool()).await?;
        Ok(folder)
    }

    #[test]
    fn validates_ids_and_page_limits() {
        for invalid in [
            "",
            "' OR 1=1 --",
            "00000000-0000-0000-0000-000000000000",
            "019a1234-5678-7000-0000-123456789abc",
            "019A1234-5678-7000-8000-123456789ABC",
        ] {
            assert!(EntityId::parse(invalid).is_err());
            assert!(OwnerId::parse(invalid).is_err());
            assert!(FolderPageRequest::new(Some(invalid), 10).is_err());
        }
        for limit in [0, 101, u16::MAX] {
            assert!(FolderPageRequest::new(None, limit).is_err());
        }
        assert!(EntityId::parse(&id()).is_ok());
        assert!(FolderPageRequest::new(None, 100).is_ok());
        assert!(stored_revision(0).is_err());
        assert!(stored_revision(-1).is_err());
        assert!(stored_revision(i64::MAX).is_ok());
    }

    #[tokio::test]
    async fn note_reads_hide_other_owners_and_preserve_raw_source()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let alice = user(&storage).await?;
        let bob = user(&storage).await?;
        let folder_id = folder(&storage, &alice, "工作").await?;
        let note_id = id();
        let markdown = "# 原文\r\n<script>source only</script>\r\n";
        sqlx::query("INSERT INTO notes VALUES (?, ?, ?, '中文标题', ?, 9223372036854775807, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z', NULL)")
            .bind(&note_id).bind(&alice).bind(&folder_id).bind(markdown).execute(storage.pool()).await?;
        let repository = storage.reads();
        let note = repository
            .note(OwnerId::parse(&alice)?, EntityId::parse(&note_id)?)
            .await?
            .ok_or("note missing")?;
        assert_eq!(note.markdown, markdown);
        assert_eq!(note.title, "中文标题");
        assert_eq!(note.revision.get(), i64::MAX as u64);
        assert!(!note.is_trashed);
        assert!(note.folder_id == Some(EntityId::parse(&folder_id)?));
        assert!(note.id == EntityId::parse(&note_id)?);
        sqlx::query("UPDATE notes SET trashed_at = '2026-10-05T01:00:00Z' WHERE id = ?")
            .bind(&note_id)
            .execute(storage.pool())
            .await?;
        assert!(
            repository
                .note(OwnerId::parse(&alice)?, EntityId::parse(&note_id)?)
                .await?
                .ok_or("trashed note missing")?
                .is_trashed
        );
        assert!(
            repository
                .note(OwnerId::parse(&bob)?, EntityId::parse(&note_id)?)
                .await?
                .is_none()
        );
        assert!(
            repository
                .note(OwnerId::parse(&bob)?, EntityId::parse(&id())?)
                .await?
                .is_none()
        );
        storage.close().await;
        let reopened = ServerStorage::open_initialized(directory.path()).await?;
        assert_eq!(
            reopened
                .reads()
                .note(OwnerId::parse(&alice)?, EntityId::parse(&note_id)?)
                .await?
                .ok_or("reopen missing")?
                .markdown,
            markdown
        );
        reopened.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn folders_paginate_without_cross_owner_rows_or_duplicate_items()
    -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let alice = user(&storage).await?;
        let bob = user(&storage).await?;
        let mut expected = Vec::new();
        for _ in 0..5 {
            expected.push(folder(&storage, &alice, "工作").await?);
        }
        folder(&storage, &bob, "私密").await?;
        expected.sort();
        let mut cursor = None;
        let mut actual = Vec::new();
        loop {
            let page = storage
                .reads()
                .folders(
                    OwnerId::parse(&alice)?,
                    FolderPageRequest::new(cursor.as_deref(), 2)?,
                )
                .await?;
            assert!(page.items.len() <= 2);
            for item in page.items {
                assert_eq!(item.name, "工作");
                assert_eq!(item.revision.get(), 1);
                actual.push(item.id.canonical());
            }
            cursor = page.next_after.map(EntityId::canonical);
            if cursor.is_none() {
                break;
            }
        }
        assert_eq!(actual, expected);
        let empty = storage
            .reads()
            .folders(OwnerId::parse(&id())?, FolderPageRequest::new(None, 100)?)
            .await?;
        assert!(empty.items.is_empty());
        assert!(empty.next_after.is_none());
        storage.close().await;
        Ok(())
    }

    #[tokio::test]
    async fn malformed_rows_return_content_free_errors() -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = ServerStorage::open_initialized(directory.path()).await?;
        let alice = user(&storage).await?;
        sqlx::query(
            "INSERT INTO folders VALUES ('bad-id', ?, 'secret-folder-name', 1, 'time', 'time')",
        )
        .bind(&alice)
        .execute(storage.pool())
        .await?;
        let result = storage
            .reads()
            .folders(OwnerId::parse(&alice)?, FolderPageRequest::new(None, 10)?)
            .await;
        assert!(matches!(result, Err(RepositoryError::InvalidStoredData)));
        assert_eq!(
            RepositoryError::InvalidStoredData.to_string(),
            "invalid_stored_data"
        );
        storage.close().await;
        Ok(())
    }
}
