## ADDED Requirements

### Requirement: Reliable saves
The system SHALL preserve edits made while a save is pending and await pending writes during explicit flush. Failed writes MUST remain retryable and flush MUST report failures.

#### Scenario: Editing during save
- **WHEN** the user edits while an earlier write is pending
- **THEN** the earlier response does not replace the new edit and flush persists the newest content

#### Scenario: Failed save
- **WHEN** a write fails and flush is requested later
- **THEN** flush retries the unsaved content and rejects if persistence still fails

### Requirement: Recoverable synchronization conflicts
The system SHALL preserve both existing versions of a conflicting note before overwriting either version.

#### Scenario: Concurrent changes
- **WHEN** both devices change the same note
- **THEN** both versions are available in note history before conflict resolution proceeds

### Requirement: Visible operation failures
The system SHALL display scheduled backup failures with retry and SHALL report failed image insertion while preserving successful images.

#### Scenario: Partial image success
- **WHEN** some pasted images fail to save
- **THEN** successful images are inserted in original order and a failure message is displayed

#### Scenario: Backup unavailable
- **WHEN** the backup directory cannot be written
- **THEN** the backup page displays the failure and permits retry

### Requirement: Bounded search reads
The system SHALL read notes with bounded concurrency and SHALL distinguish incomplete searches from complete results.

#### Scenario: Large workspace search
- **WHEN** a search scans multiple notes
- **THEN** concurrent reads stay bounded and the results retain their original order

#### Scenario: Unreadable note
- **WHEN** any note cannot be read
- **THEN** the operation reports incomplete search instead of silently returning complete results
