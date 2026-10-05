-- Fresh identity databases only; existing schema 1 upgrades require recovery support.
CREATE TABLE bootstrap_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    closed INTEGER NOT NULL CHECK (closed IN (0, 1)),
    migration_sql TEXT NOT NULL
) STRICT;
