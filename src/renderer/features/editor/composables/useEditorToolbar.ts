import { computed, type Ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { markdownCommands } from '@renderer/core/editor/markdownCommands';
import { TOOLBAR_GROUPS } from '../constants/toolbar.constants';

export function useEditorToolbar(editorView: Ref<EditorView | undefined>) {
  
  const executeCommand = (actionName: string) => {
    if (!editorView.value) return;

    const command = markdownCommands[actionName as keyof typeof markdownCommands];
    if (command) {
      command(editorView.value);
    }
  };

  
  const toolbarGroups = computed(() => TOOLBAR_GROUPS);

  const isEditorReady = computed(() => !!editorView.value);

  return {
    executeCommand,
    toolbarGroups,
    isEditorReady,
  };
}
