## ADDED Requirements

### Requirement: Deployable self-hosted application
The system SHALL provide a supported Docker Compose deployment that starts the notes server and embedded Web client without requiring an external database, cache, search engine, or object store.

#### Scenario: First deployment
- **WHEN** an operator supplies required secrets and starts the documented Compose configuration
- **THEN** the system serves an initialization flow, Web client, versioned API, and health endpoint from the configured application address

### Requirement: Persistent application data
The system SHALL store the server database, attachments, and recovery artifacts under documented persistent volume paths independent of the container filesystem.

#### Scenario: Container replacement
- **WHEN** the application container is replaced while the configured data volume is retained
- **THEN** all committed users, notes, device records, and attachments remain available

### Requirement: Atomic Web and API versioning
The system SHALL release compatible Web assets and API server code in the same application image.

#### Scenario: Image upgrade
- **WHEN** an operator upgrades the application image
- **THEN** the served Web client and API originate from the same release version

### Requirement: Safe single-node operation
The system SHALL enforce and document a single active application instance for a server SQLite data directory.

#### Scenario: Conflicting writer startup
- **WHEN** another application instance attempts to use a data directory already owned by an active instance
- **THEN** startup fails without modifying the database

### Requirement: Observable service health
The system SHALL expose health and version information without exposing secrets or note content.

#### Scenario: Health probe
- **WHEN** an authenticated or permitted infrastructure probe requests the health endpoint
- **THEN** the response reports application readiness, version, schema compatibility, and storage availability

### Requirement: Upgrade protection
The system SHALL create or verify a recoverable backup before applying a schema migration and SHALL refuse to run against a schema newer than the application supports.

#### Scenario: Migration failure
- **WHEN** a database migration cannot complete
- **THEN** the service stops accepting traffic and provides a recovery-safe error without continuing on a partially compatible schema
