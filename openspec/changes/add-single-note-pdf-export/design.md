## Context

Snaptium already supports batch Markdown and portable package export for migration and backup. This change adds a sharing-oriented export for one selected note from the workspace context menu.

The app uses the Renderer -> Preload/Bridge -> Main Electron boundary. File dialogs, PDF generation, and file writes must remain in the main process.

## Goals / Non-Goals

**Goals:**

- Add a single-note PDF export action to the note context menu.
- Generate PDF through Electron main process capabilities.
- Keep renderer logic limited to selecting the note, flushing pending saves, and invoking the bridge.
- Provide localized menu and feedback text.

**Non-Goals:**

- Notebook-level combined PDF export.
- HTML export.
- Batch PDF export.
- New rendering or export dependencies.

## Decisions

- Use Electron `webContents.printToPDF()` in the main process.
  - Rationale: Electron already provides PDF generation, so this avoids adding a dependency.
  - Alternative considered: add a PDF library. Rejected because it increases package size and duplicates Electron capability.
- Pass a minimal export payload from renderer to main: note title and sanitized rendered HTML.
  - Rationale: the selected note already exists in renderer state, and renderer owns the existing Markdown rendering/sanitizing pipeline.
  - Alternative considered: pass note ID and let main read VFS content. Rejected for first version because the renderer already coordinates note selection and autosave flushing.
- Render Markdown into a constrained HTML document inside a hidden BrowserWindow before printing.
  - Rationale: `printToPDF()` prints web contents, and a short in-process shell around sanitized note HTML is enough for a stable first version.

## Risks / Trade-offs

- Markdown styling may not exactly match the live preview -> Use a restrained document style focused on readable export output.
- Embedded local images may require future path rewriting -> The first implementation handles Markdown content, with complex asset fidelity left out of scope.
- Hidden window lifecycle issues -> Create the window per export, wait for load completion, then close it in a finally block.
