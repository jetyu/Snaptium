export { useWorkspaceStore } from './store/workspace.store';
export { useWorkspace } from './composables/useWorkspace';
export { useWorkspaceUiActions } from './composables/useWorkspaceUiActions';
export { useWorkspacePaneResize } from './composables/useWorkspacePaneResize';
export { workspaceService, type Note, type Notebook } from './services/workspace.service';
export { default as HistoryDialog } from './components/HistoryDialog.vue';
export { default as NotePropertiesDialog } from './components/NotePropertiesDialog.vue';
export {
  buildNoteTemplate,
  NOTE_TEMPLATE_DEFAULT_ID,
  NOTE_TEMPLATE_DEFINITIONS,
  NOTE_TEMPLATE_IDS,
  isNoteTemplateId,
  type NoteTemplate,
  type NoteTemplateDefinition,
  type NoteTemplateIconName,
  type NoteTemplateId,
  type NoteTemplateTranslate,
} from './templates';
