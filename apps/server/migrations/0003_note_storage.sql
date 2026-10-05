-- Server rows only. Existing-data upgrades require a verified recovery point.
CREATE TABLE note_storage_metadata (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    version INTEGER NOT NULL CHECK (version = 3),
    migration_sql TEXT NOT NULL
) STRICT;

CREATE TABLE note_history (
    owner_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    folder_id TEXT,
    title TEXT NOT NULL,
    markdown TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    trashed_at TEXT,
    PRIMARY KEY (owner_id, note_id, revision),
    FOREIGN KEY (owner_id, note_id) REFERENCES notes(owner_id, id) ON DELETE RESTRICT
) STRICT;

-- Metadata journal, not a wire payload. Never assign cursors or reset sqlite_sequence.
-- No entity foreign key: permanent deletion must preserve its tombstone.
CREATE TABLE change_log (
    cursor INTEGER PRIMARY KEY AUTOINCREMENT CHECK (cursor > 0),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    entity_kind TEXT NOT NULL CHECK (entity_kind IN ('note', 'folder')),
    entity_id TEXT NOT NULL CHECK (length(entity_id) > 0),
    revision INTEGER NOT NULL CHECK (revision > 0),
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    occurred_at TEXT NOT NULL,
    UNIQUE (owner_id, entity_kind, entity_id, revision)
) STRICT;
CREATE INDEX change_log_owner_cursor ON change_log(owner_id, cursor);
