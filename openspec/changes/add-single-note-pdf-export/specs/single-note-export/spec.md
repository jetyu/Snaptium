## ADDED Requirements

### Requirement: Export selected note as PDF
The system SHALL allow users to export a single selected note as a PDF file from the note context menu.

#### Scenario: Successful single note PDF export
- **WHEN** the user chooses the PDF export action for a note and selects a save path
- **THEN** the system writes a PDF file containing that note's title and content

#### Scenario: Cancel PDF export
- **WHEN** the user chooses the PDF export action and cancels the save dialog
- **THEN** the system SHALL leave notes unchanged and report no export error

### Requirement: Preserve export scope
The system MUST limit this change to single-note PDF export and MUST NOT add notebook-level combined PDF export or HTML export.

#### Scenario: Notebook context menu
- **WHEN** the user opens a notebook context menu
- **THEN** the system SHALL NOT show a combined PDF export action
