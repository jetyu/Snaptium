## 1. Main Process

- [x] 1.1 Add quick-capture IPC channels and a coordinator that restores/focuses the window, queues one request, and performs the renderer-ready handshake.
- [x] 1.2 Add command scope, the default quick-capture binding, owned global-shortcut refresh, and typed registration status.
- [x] 1.3 Wire quick capture into application lifecycle, tray menu, shortcut mutations, and cleanup.

## 2. Bridge and Renderer

- [x] 2.1 Expose typed quick-capture and global-shortcut-status APIs through preload and the renderer bridge.
- [x] 2.2 Implement renderer capture orchestration for readiness, access control, workspace note creation, and editor-end focus.
- [x] 2.3 Integrate command scope and registration warnings into shortcut settings without changing existing local shortcut behavior.
- [x] 2.4 Add Simplified Chinese quick-capture labels and error messages.

## 3. Verification

- [x] 3.1 Add focused unit coverage for request coalescing, global registration refresh/status, and renderer capture behavior where practical.
- [x] 3.2 Run OpenSpec validation, unit tests, main/preload builds, renderer typecheck, and lint; resolve regressions in scope.
