## ADDED Requirements

### Requirement: Versioned synchronization contract
The system SHALL expose a versioned synchronization protocol with stable identifiers, timestamp encoding, revision semantics, cursor semantics, operation types, and machine-readable errors.

#### Scenario: Supported adjacent version
- **WHEN** a supported client connects to a compatible server protocol version
- **THEN** synchronization proceeds without relying on either side's database schema

### Requirement: Idempotent mutation submission
The server SHALL associate each mutation identifier with a deterministic outcome so that retrying the same mutation does not apply it more than once.

#### Scenario: Lost push response
- **WHEN** the server commits a mutation but the client retries because the response was lost
- **THEN** the server returns the original outcome without creating another revision or duplicate entity

### Requirement: Revision preconditions
The server SHALL accept an entity update only when its base revision matches the current authoritative revision, except for a permitted create operation.

#### Scenario: Stale edit
- **WHEN** a client pushes an edit based on an older revision
- **THEN** the server rejects the mutation with the current authoritative version and does not overwrite it

### Requirement: Ordered incremental pull
The server SHALL expose user-scoped changes after a cursor in deterministic order and support bounded pagination.

#### Scenario: Interrupted multi-page pull
- **WHEN** synchronization stops after a client commits one page but before receiving the next
- **THEN** the next synchronization resumes after the last transactionally committed cursor

### Requirement: Deletion propagation
The system SHALL represent deletions as tombstones in the synchronization stream. The first release SHALL retain these tombstones without automatic purging; bounded cleanup requires a later reviewed recovery and expired-cursor policy.

#### Scenario: Offline device receives deletion
- **WHEN** a device reconnects within tombstone retention after another client deleted a note
- **THEN** it receives the deletion and removes or trashes the local entity according to the operation

### Requirement: Conflict preservation
The native client SHALL preserve a rejected local edit as a user-visible conflict copy instead of silently discarding or overwriting content.

#### Scenario: Concurrent edits
- **WHEN** two clients modify the same base revision and one update is accepted first
- **THEN** the other client retains both the authoritative note and a conflict copy containing its local edit

### Requirement: Transactional local application
The native client SHALL apply each pulled page and advance its cursor in one local transaction.

#### Scenario: Local failure during pull
- **WHEN** applying any change in a pulled page fails
- **THEN** no change from that page and no new cursor are committed
