// Components
export { default as EditorPane } from './components/EditorPane.vue';
export { default as EditorStatus } from './components/EditorStatus.vue';

// Composables
export { useEditor } from './composables/useEditor';
export { useEditorContextMenu } from './composables/useEditorContextMenu';

// Services
export {
  showNativeEditorContextMenu,
  createEditorContextMenuLabels,
  getEditorContextMenu,
  executeEditorAction,
  getSelectedText,
  hasSelection,
  replaceSelectedText,
  type EditorContextAction,
  type EditorMenuItem,
} from './services/editorContextMenu.service';

// Constants
export {
  EDITOR_CONSTANTS,
  TOOLBAR_ACTIONS,
  TOOLBAR_GROUPS,
  type ToolbarAction,
  type ToolbarGroup,
} from './constants/editor.constants';
