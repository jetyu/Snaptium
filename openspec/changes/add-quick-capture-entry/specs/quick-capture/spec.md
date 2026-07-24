## ADDED Requirements

### Requirement: Quick capture entry points
The system SHALL expose a Quick Capture tray action and a configurable global shortcut while the Snaptium process is running.

#### Scenario: Capture from the tray
- **WHEN** the user selects Quick Capture from the tray menu
- **THEN** Snaptium restores, becomes visible and focused, and submits one capture request

#### Scenario: Capture with the global shortcut
- **WHEN** the configured global accelerator is pressed while Snaptium is running
- **THEN** Snaptium restores, becomes visible and focused, and submits one capture request

#### Scenario: Application is fully quit
- **WHEN** Snaptium is not running
- **THEN** the quick-capture accelerator does not launch the application

### Requirement: Timestamped note creation
The system SHALL create a root-level note for a capture request, title it with a localized Quick Capture prefix and local timestamp to seconds, switch to the workspace, and focus the editor at the end of the note.

#### Scenario: Successful capture
- **WHEN** a ready and unlocked renderer receives a capture request
- **THEN** exactly one root note is created, selected, displayed in the workspace, and focused at its document end

#### Scenario: Note creation fails
- **WHEN** the workspace service cannot create the note
- **THEN** the system shows the existing error-dialog pattern and does not attempt editor focus

### Requirement: Startup and access-control safety
The system SHALL retain one pending capture request while the renderer is unavailable, initializing, busy, or locked, and SHALL not create a note before access control is unlocked.

#### Scenario: Request before renderer readiness
- **WHEN** a request arrives before the renderer declares readiness
- **THEN** the main process delivers one pending request after readiness

#### Scenario: Request while locked
- **WHEN** a request arrives while access control is locked
- **THEN** the application is focused, no note is created while locked, and one capture proceeds after successful unlock

#### Scenario: Repeated pending requests
- **WHEN** multiple requests arrive before a pending request can be processed
- **THEN** they are coalesced into one capture operation

### Requirement: Configurable and observable global shortcut
The system SHALL manage the quick-capture accelerator through the existing shortcut settings and SHALL report operating-system registration failures.

#### Scenario: Binding changes
- **WHEN** the user adds, removes, resets, or imports quick-capture bindings
- **THEN** the main process immediately refreshes its owned global shortcut registrations

#### Scenario: Registration conflict
- **WHEN** Electron cannot register a configured accelerator
- **THEN** the shortcut settings page identifies the failed accelerator and the tray entry remains usable

#### Scenario: All bindings removed
- **WHEN** the user removes every quick-capture binding
- **THEN** no global accelerator is registered for quick capture
