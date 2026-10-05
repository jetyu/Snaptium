## ADDED Requirements

### Requirement: Browser note workspace
The system SHALL provide a responsive Web workspace in which an authenticated user can create, view, edit, organize, search, move to trash, restore, and permanently delete their own notes.

#### Scenario: Create and edit a note
- **WHEN** an authenticated user creates a note and enters a title and body
- **THEN** the server persists the note and the workspace displays the committed content after reload

### Requirement: First-release folder organization
The first release SHALL organize notes using single-level owner-scoped folders and SHALL NOT provide tag organization. Folder operations and moving notes between folders MUST verify ownership of both the note and the target folder. Deleting a folder SHALL preserve its notes by moving them to the uncategorized group.

#### Scenario: Delete a folder containing notes
- **WHEN** an authenticated user deletes their own folder containing notes
- **THEN** those notes become uncategorized without losing Markdown content, and the operation follows revision and synchronization change-log rules

#### Scenario: Move a note to an owned folder
- **WHEN** an authenticated user moves their own note to their own folder
- **THEN** the system persists the folder association without changing the note's Markdown content

#### Scenario: Cross-user folder assignment
- **WHEN** an authenticated user attempts to assign a note to another user's folder
- **THEN** the system rejects the operation without changing the note or disclosing whether the folder exists

### Requirement: WYSIWYG Markdown authoring
The system SHALL provide WYSIWYG authoring for the supported Markdown subset while storing normalized Markdown as canonical note content.

#### Scenario: Markdown round trip
- **WHEN** a user applies supported rich-text formatting, saves the note, and reopens it
- **THEN** the visual formatting and canonical Markdown meaning remain equivalent

### Requirement: Bounded note revision history
The system SHALL retain the latest 100 versions per note and SHALL prune older history without changing the current note. Attachment cleanup MUST preserve files referenced by retained history.

#### Scenario: Note history exceeds the limit
- **WHEN** committing a note revision would exceed 100 retained versions
- **THEN** the system keeps the latest 100 versions and the current note remains unchanged by history pruning

### Requirement: Safe Markdown rendering
The system MUST prevent note content from executing scripts, unsafe URLs, or untrusted embedded HTML in the Web client.

#### Scenario: Malicious imported content
- **WHEN** imported Markdown contains scripts, event handlers, or disallowed URL schemes
- **THEN** the rendered note neutralizes the unsafe content without executing it

### Requirement: Recoverable browser drafts
The system SHALL preserve unsent Web editor drafts locally and distinguish them from server-committed content.

#### Scenario: Browser interruption
- **WHEN** a browser tab closes or loses connectivity before an edit is committed
- **THEN** reopening the note offers the recoverable local draft without silently overwriting the server version

### Requirement: Authenticated attachment use
The system SHALL allow an authorized user to upload, insert, download, and delete supported attachments belonging to their notes.

#### Scenario: Unauthorized attachment request
- **WHEN** a user requests an attachment owned by another user
- **THEN** the server denies access without disclosing attachment metadata

### Requirement: Online-first Web behavior
The first-release Web client SHALL treat the server as authoritative and SHALL not claim full offline availability.

#### Scenario: Server unavailable
- **WHEN** the Web client cannot reach the server
- **THEN** it preserves eligible local drafts and clearly reports that authoritative notes and synchronization are unavailable
