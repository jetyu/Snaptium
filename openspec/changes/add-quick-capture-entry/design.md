## Context

Snaptium already has an Electron tray, persisted shortcut bindings, a global-shortcut wrapper, renderer workspace stores, and a shared CodeMirror reference. Global shortcuts are not currently registered, and renderer startup performs asynchronous initialization before most main-to-renderer listeners are attached. Access control can cover the workspace while it is locked.

## Goals / Non-Goals

**Goals:**

- Route tray and global-shortcut capture requests through one main-process coordinator.
- Preserve the Electron Main → Preload → Renderer boundary and avoid creating notes before unlock.
- Reuse the existing shortcut settings UI and surface operating-system registration failures.
- Create exactly one root note for a coalesced request and focus its editor.

**Non-Goals:**

- A floating capture window, daily-note model, browser extension, analytics, or capture while Snaptium is fully quit.
- Changing the existing local "New Note" command.

## Decisions

- Add a main-process quick-capture service that owns the active window, renderer readiness, and one pending request. Both the tray and global shortcut call this service. A renderer-ready handshake prevents events from being lost during startup or reload.
- Add an explicit `renderer | global` command scope. Only global commands are registered with Electron and they are excluded from renderer keydown handling, preventing duplicate foreground execution.
- Re-register owned global accelerators after persisted shortcut mutations. Track only accelerators registered by this service; do not use Electron's process-wide `unregisterAll` API.
- Persist user-selected accelerators even when registration fails. Expose typed registration status so the settings page can show an inline warning and let the tray remain as a fallback.
- Keep note creation in the renderer workspace layer. The renderer coalesces pending requests while initializing, busy, or locked; after unlock it switches to the workspace, creates a root note named with local time to seconds, waits for CodeMirror, moves the cursor to the end, and focuses it.
- Add only Simplified Chinese locale entries, matching repository localization policy.

## Risks / Trade-offs

- [An accelerator is owned by the OS or another app] → Preserve the binding, report failed registration inline, and keep the tray action available.
- [A request arrives before Vue or CodeMirror is ready] → Use a readiness handshake plus a bounded editor wait; the note remains created even if focus times out.
- [Repeated input during startup or lock creates empty-note spam] → Coalesce pending requests to one until the current request finishes.
- [Snaptium is fully quit] → The shortcut is unavailable by design; no installer or platform launcher changes are introduced.
