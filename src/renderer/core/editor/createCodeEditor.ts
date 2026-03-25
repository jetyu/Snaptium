import { EditorState, Compartment } from '@codemirror/state';
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
  readOnly?: boolean;
  onChange: (value: string) => void;
}

export function createCodeEditor({
  target,
  initialValue,
  readOnly = false,
  onChange,
}: CreateCodeEditorOptions) {
  const readOnlyCompartment = new Compartment();

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
      readOnlyCompartment.of([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
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
    setReadOnly(nextReadOnly: boolean) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure([
          EditorView.editable.of(!nextReadOnly),
          EditorState.readOnly.of(nextReadOnly),
        ]),
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
