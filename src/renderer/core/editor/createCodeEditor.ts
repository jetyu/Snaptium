import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightActiveLine,
  placeholder,
} from '@codemirror/view';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

interface CreateCodeEditorOptions {
  target: HTMLElement;
  initialValue: string;
  onChange: (value: string) => void;
}

export function createCodeEditor({ target, initialValue, onChange }: CreateCodeEditorOptions) {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      drawSelection(),
      history(),
      highlightActiveLine(),
      markdown(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      placeholder('Start typing your note here...'),
      updateListener,
    ],
  });

  const view = new EditorView({ state, parent: target });

  return {
    setValue(nextValue: string) {
      const currentValue = view.state.doc.toString();
      if (nextValue === currentValue) return;

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue },
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
