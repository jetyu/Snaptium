CREATE TABLE schema_metadata (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    version INTEGER NOT NULL CHECK (version = 1),
    migration_sql TEXT NOT NULL
) STRICT;

CREATE TABLE server_policy (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    attachment_limit_bytes INTEGER NOT NULL CHECK (attachment_limit_bytes > 0),
    default_quota_bytes INTEGER NOT NULL CHECK (default_quota_bytes > 0),
    note_history_limit INTEGER NOT NULL CHECK (note_history_limit > 0),
    public_registration INTEGER NOT NULL CHECK (public_registration IN (0, 1)),
    purge_tombstones INTEGER NOT NULL CHECK (purge_tombstones IN (0, 1))
) STRICT;
INSERT INTO server_policy VALUES (1, 20971520, 5368709120, 100, 0, 0);

CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    login TEXT NOT NULL UNIQUE CHECK (length(trim(login)) > 0),
    password_verifier TEXT NOT NULL CHECK (length(password_verifier) > 0),
    is_admin INTEGER NOT NULL CHECK (is_admin IN (0, 1)),
    quota_bytes INTEGER NOT NULL DEFAULT 5368709120 CHECK (quota_bytes > 0),
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE folders (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (owner_id, id)
) STRICT;
CREATE INDEX folders_owner ON folders(owner_id);

CREATE TABLE notes (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    folder_id TEXT,
    title TEXT NOT NULL,
    markdown TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    trashed_at TEXT,
    UNIQUE (owner_id, id),
    FOREIGN KEY (owner_id, folder_id) REFERENCES folders(owner_id, id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX notes_owner_updated ON notes(owner_id, updated_at, id);
CREATE INDEX notes_owner_folder ON notes(owner_id, folder_id);
