## ADDED Requirements

### Requirement: Portable note export
The system SHALL allow a user to export their notes as readable Markdown files with referenced attachments and a manifest sufficient to preserve stable relationships.

#### Scenario: Complete account export
- **WHEN** a user requests a complete export
- **THEN** the resulting archive contains their active and trashed notes, attachments, and documented metadata without requiring the application to read Markdown content

### Requirement: Safe Markdown import
The system SHALL import supported Markdown files and attachments without executing embedded active content and SHALL report unsupported or failed items.

#### Scenario: Partial import failure
- **WHEN** one file in a multi-file import is invalid
- **THEN** successfully validated files are handled according to the documented transaction policy and the user receives an itemized failure report

### Requirement: Consistent server backup
The server SHALL create a consistent backup containing the SQLite database, attachments, configuration-independent metadata, and a version manifest.

#### Scenario: Backup during service use
- **WHEN** an authorized backup starts while users are active
- **THEN** the backup uses a consistency-safe database mechanism and produces a manifest that can be validated before restore

### Requirement: Verified restoration
The system SHALL provide a documented restore procedure that validates backup integrity and application/schema compatibility before replacing active data.

#### Scenario: Incompatible backup
- **WHEN** an operator attempts to restore a backup requiring a newer unsupported schema
- **THEN** restoration stops before replacing active data and reports the compatibility problem

### Requirement: Recoverable upgrades
The deployment SHALL preserve a pre-upgrade recovery point before applying a forward schema migration.

#### Scenario: Operator rollback
- **WHEN** an upgrade fails after a migration begins
- **THEN** the documented rollback restores both the prior application image and its corresponding recovery point

### Requirement: No proprietary data lock-in
The system SHALL document its Markdown, attachment, and export manifest formats sufficiently for users to recover content without running the server.

#### Scenario: Application unavailable
- **WHEN** a user only has an exported archive and no running application
- **THEN** note text and attachments remain accessible using standard filesystem and Markdown tools
