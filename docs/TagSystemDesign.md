# Tag System Design

## Goal

The tag system adds a lightweight cross-folder index for notes. It should not replace notebooks or search. Notebooks keep the storage hierarchy, search finds content, and tags group notes by reusable topics such as project, priority, status, or theme.

## Product Scope

### MVP

- Add and remove tags from the active note in the editor header area.
- Create tags from the editor by typing a new tag name.
- Reuse existing tags through a searchable picker.
- Add a Tags main view to browse tags and find related notes.
- Support the virtual groups "All tagged notes" and "Untagged notes".
- Open a note from the Tags view in the workspace editor.

### Later

- Tag rename, merge, delete, and color management.
- Multi-tag filters with "any" and "all" matching.
- Tag suggestions from recent notes or local topic analysis.
- Tag graph or knowledge-topic integration.

## UX Placement

### Editor

Tags should live directly below the note title/header in the editor column as a compact metadata bar:

```text
Title
#product  #todo  #important  + Add tag
Markdown editor
```

Rationale:

- Tags are note metadata, so they should be visible while editing the note.
- The editor is the place where users naturally decide how a note should be classified.
- Keeping tags outside Markdown avoids polluting note content and makes rename/merge operations safe.

Behavior:

- Show current note tags as compact pills.
- Clicking `+ Add tag` opens a popover.
- The popover searches existing tags and creates a tag when the query does not match.
- Each pill has a remove action.
- Long tag sets wrap or collapse gracefully depending on available width.

### Tags View

The Tags view should be a work-focused index view:

```text
Tags list              Notes for selected tag          Preview / detail
-----------------------------------------------------------------------
Search tags            Note A                          Title
All tagged notes       Note B                          Summary
#important             Note C                          Tags
#todo                                                  Open in workspace
Untagged
```

For the MVP, a two-column version is acceptable:

- Left: tag list with note counts.
- Right: note list filtered by the selected tag.

Opening a note should switch to Workspace and select that note.

## Data Model

The note stores tag names as metadata:

```ts
interface Note {
  tags: string[];
}
```

This keeps the MVP simple and compatible with the current note model. A future dedicated tag table can add color, aliases, rename history, and merge support:

```ts
interface TagMeta {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}
```

## Normalization Rules

- Trim leading and trailing whitespace.
- Remove a leading `#` when users type one.
- Collapse repeated spaces.
- Deduplicate tags case-insensitively.
- Keep display casing from the first created tag.
- Limit tag length to keep pills and lists stable.

## Architecture

Renderer flow:

```text
Editor / Tags View
-> workspace composable/store
-> workspace service
-> electron bridge
-> main VFS service
```

The MVP should extend the existing note update path instead of adding a separate tag persistence service. This keeps the change close to the note metadata that already moves through the workspace store.

## Interaction Details

### Add Tag

1. User opens the tag picker from the editor metadata bar.
2. User selects an existing tag or types a new tag name.
3. The workspace store updates the active note tags.
4. The note list, editor, and Tags view update reactively.

### Remove Tag

1. User clicks the remove action on a tag pill.
2. The workspace store removes that tag from the active note.
3. Empty tag arrays are stored as `[]`.

### Browse Tag

1. User opens the Tags main view.
2. User selects a tag or virtual group.
3. The note list filters immediately.
4. User clicks a note to open it in Workspace.

## Responsive Behavior

- Desktop and default window: editor tag bar is inline under the editor header.
- Narrow windows: tags wrap to a second line, and the add button remains visible.
- Very narrow windows: hide lower-priority metadata in the Tags view and keep the note list usable.

## Risks

- Tag sprawl can happen quickly without rename/merge tools.
- Tags and notebooks can overlap conceptually if labels are too hierarchical.
- Adding tag controls to the editor header must not reduce writing space too much.

## Acceptance Criteria

- Users can add and remove tags on a note.
- Tags persist after app reload.
- Users can open a Tags view and see tag counts.
- Selecting a tag shows notes that contain that tag.
- Selecting "Untagged" shows notes without tags.
- Clicking a note in the Tags view opens it in the workspace.
