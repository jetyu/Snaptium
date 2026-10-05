## ADDED Requirements

### Requirement: Browser note workspace
The system SHALL provide a responsive Web workspace in which an authenticated user can create, view, edit, organize, search, move to trash, restore, and permanently delete their own notes.

#### Scenario: Create and edit a note
- **WHEN** an authenticated user creates a note and enters a title and body
- **THEN** the server persists the note and the workspace displays the committed content after reload

### Requirement: First-release folder organization
The first release SHALL organize notes using owner-scoped folders and SHALL NOT provide tag organization. Folder operations and moving notes between folders MUST verify ownership of both the note and the target folder.

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
