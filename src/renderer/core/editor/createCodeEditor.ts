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
import { foldGutter, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { search, searchKeymap } from '@codemirror/search';

export interface CreateCodeEditorOptions {
  target: HTMLElement;
  initialValue: string;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
  codeFolding?: boolean;
  highlightActiveLine?: boolean;
  bracketMatching?: boolean;
  autoCloseBrackets?: boolean;
  autoIndent?: boolean;
  onChange: (value: string) => void;
}

export function createCodeEditor({
  target,
  initialValue,
  readOnly = false,
  showLineNumbers = true,
  wordWrap = false,
  codeFolding = true,
  highlightActiveLine: enableHighlightActiveLine = true,
  bracketMatching: enableBracketMatching = true,
  autoCloseBrackets = true,
  autoIndent = true,
  onChange,
}: CreateCodeEditorOptions) {
  const readOnlyCompartment = new Compartment();
  const lineNumbersCompartment = new Compartment();
  const wordWrapCompartment = new Compartment();
  const foldingCompartment = new Compartment();
  const highlightLineCompartment = new Compartment();
  const bracketMatchingCompartment = new Compartment();
  const closeBracketsCompartment = new Compartment();
  const indentCompartment = new Compartment();

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialValue,
    extensions: [
      lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
      wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      foldingCompartment.of(codeFolding ? foldGutter() : []),
      highlightLineCompartment.of(enableHighlightActiveLine ? highlightActiveLine() : []),
      bracketMatchingCompartment.of(enableBracketMatching ? bracketMatching() : []),
      closeBracketsCompartment.of(autoCloseBrackets ? closeBrackets() : []),
      indentCompartment.of(autoIndent ? indentOnInput() : []),
      highlightActiveLineGutter(),
      drawSelection(),
      history(),
      markdown(),
      search({ top: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
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
    setLineNumbers(show: boolean) {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(show ? lineNumbers() : []),
      });
    },
    setWordWrap(wrap: boolean) {
      view.dispatch({
        effects: wordWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
      });
    },
    setCodeFolding(enabled: boolean) {
      view.dispatch({
        effects: foldingCompartment.reconfigure(enabled ? foldGutter() : []),
      });
    },
    setHighlightActiveLine(enabled: boolean) {
      view.dispatch({
        effects: highlightLineCompartment.reconfigure(enabled ? highlightActiveLine() : []),
      });
    },
    setBracketMatching(enabled: boolean) {
      view.dispatch({
        effects: bracketMatchingCompartment.reconfigure(enabled ? bracketMatching() : []),
      });
    },
    setAutoCloseBrackets(enabled: boolean) {
      view.dispatch({
        effects: closeBracketsCompartment.reconfigure(enabled ? closeBrackets() : []),
      });
    },
    setAutoIndent(enabled: boolean) {
      view.dispatch({
        effects: indentCompartment.reconfigure(enabled ? indentOnInput() : []),
      });
    },
    destroy() {
      view.destroy();
    },
  };
}
