import { ref, type Ref } from 'vue';
import type { EditorView } from '@codemirror/view';

// 全局编辑器实例引用
const editorViewRef: Ref<EditorView | null> = ref(null);

/**
 * 编辑器 composable
 * 提供对当前活动编辑器的访问
 */
export function useEditor() {
  const setEditorView = (view: EditorView | null) => {
    editorViewRef.value = view;
  };

  const getEditorView = () => {
    return editorViewRef.value;
  };

  return {
    editorView: editorViewRef,
    setEditorView,
    getEditorView,
  };
}
