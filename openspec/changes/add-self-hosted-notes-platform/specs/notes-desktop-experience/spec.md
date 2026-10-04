## ADDED Requirements

### Requirement: Configurable self-hosted server
The Windows client SHALL allow a user to configure an HTTPS server address and validate its identity, compatibility, and advertised capabilities before authentication.

#### Scenario: Compatible server configuration
- **WHEN** a user enters a reachable compatible server address
- **THEN** the client records the normalized address and proceeds to authentication

#### Scenario: Incompatible endpoint
- **WHEN** the configured address does not advertise a supported notes protocol
- **THEN** the client rejects it with an actionable error and stores no credentials

### Requirement: Offline note access
The Windows client SHALL store a local SQLite replica that permits reading, creating, editing, searching, trashing, and restoring notes while the server is unavailable.

#### Scenario: Edit while offline
- **WHEN** a signed-in user edits a locally available note without network access
- **THEN** the client commits the edit locally and queues an idempotent mutation for later synchronization

### Requirement: Protected native credentials
The Windows client MUST store persistent authentication credentials using operating-system-protected credential storage and MUST NOT persist the user's password.

#### Scenario: Successful sign-in
- **WHEN** a user signs in on Windows
- **THEN** the client stores only the device-scoped persistent credential in protected storage

### Requirement: Native local search
The Windows client SHALL maintain a local full-text index that reflects locally committed note titles and Markdown text.

#### Scenario: Search while offline
- **WHEN** a user searches without network access
- **THEN** the client returns matching locally synchronized and locally edited notes

### Requirement: Durable local changes
The Windows client SHALL persist note edits and pending mutations atomically before reporting an offline save as successful.

#### Scenario: Application terminates after save
- **WHEN** the application terminates after reporting a successful local save but before synchronization
- **THEN** the edit and its pending mutation remain available after restart

### Requirement: Safe native application boundary
The Tauri WebView MUST access database, credentials, files, and synchronization through validated coarse-grained commands and MUST NOT receive unrestricted SQL or filesystem capabilities.

#### Scenario: Invalid command input
- **WHEN** the WebView invokes a native command with malformed or unauthorized input
- **THEN** the native boundary rejects the call without performing a partial operation
