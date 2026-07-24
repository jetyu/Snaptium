## Why

Snaptium currently requires users to navigate back into the workspace before capturing an idea, which adds friction to a frequent note-taking action. A tray entry and configurable global shortcut can shorten this flow while reusing the existing Electron and shortcut infrastructure.

## What Changes

- Add a "Quick Capture" tray action that restores and focuses Snaptium.
- Add a configurable global quick-capture command, active while Snaptium is running, with a default `CommandOrControl+Alt+N` accelerator.
- Create one timestamped root note per capture request, switch to the workspace, and focus the editor at the end of the new note.
- Queue one request while the renderer initializes or access control is locked, then continue after the application is ready or unlocked.
- Surface operating-system shortcut registration failures in the shortcut settings UI.

## Capabilities

### New Capabilities

- `quick-capture`: Capture a timestamped note through the tray or a configurable global shortcut while preserving startup and access-control boundaries.

### Modified Capabilities

None.

## Impact

- Electron main-process tray, shortcut registration, window lifecycle, IPC constants, and startup orchestration.
- Preload and renderer bridge APIs for quick-capture readiness, requests, and global shortcut status.
- Renderer workspace orchestration, shortcut settings, editor focus behavior, and Simplified Chinese localization.
- No new runtime dependency and no system-level launcher when the application is fully quit.
