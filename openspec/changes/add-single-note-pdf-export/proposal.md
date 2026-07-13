## Why

Users need a simple way to share or archive one note in a stable read-only format without invoking the existing batch migration/export flows. PDF is the highest-value first format because it supports printing and sharing outside Snaptium.

## What Changes

- Add a note context menu action to export the selected note as PDF.
- Save the generated PDF to a user-selected file path.
- Preserve the current scope by not adding notebook-level combined PDF export or HTML export.

## Capabilities

### New Capabilities

- `single-note-export`: Export one note to an external sharing format.

### Modified Capabilities

- None.

## Impact

- Renderer workspace context menu and store orchestration.
- Renderer/preload/main Electron API bridge for single-note PDF export.
- Main process PDF generation and file save flow.
- Simplified Chinese i18n strings for the new action and feedback.
