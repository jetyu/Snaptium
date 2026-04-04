import { EditorState, Compartment, StateEffect } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  highlightActiveLine,
  Decoration,
} from '@codemirror/view';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { foldGutter, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { search, searchKeymap } from '@codemirror/search';
import { aiCompletionPlugin, acceptedSuggestionAnnotation } from '../ai/wordsAutoCompletion';

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
  onChange: (value: string, isAiCompletion?: boolean) => void;
  onSelectionChange?: (selection: { line: number; column: number; selectedText: string }) => void;
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
  onSelectionChange,
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
      const isAiCompletion = update.transactions.some(tr =>
        tr.annotation(acceptedSuggestionAnnotation)
      );
      onChange(update.state.doc.toString(), isAiCompletion);
    }

    if (onSelectionChange && (update.selectionSet || update.docChanged)) {
      const selection = update.state.selection.main;
      const pos = selection.head;
      const line = update.state.doc.lineAt(pos);
      const selectedText = selection.from === selection.to
        ? ''
        : update.state.doc.sliceString(selection.from, selection.to);

      onSelectionChange({
        line: line.number,
        column: pos - line.from + 1,
        selectedText,
      });
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
      updateListener,
      readOnlyCompartment.of([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
      aiCompletionPlugin,
    ],
  });

  const view = new EditorView({ state, parent: target });

  return {
    view,
    setValue(nextValue: string) {
      const currentValue = view.state.doc.toString();
      if (nextValue === currentValue) return;

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue },
      });
    },
    jumpToLine(lineNumber: number, searchText?: string) {
      const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
      const pos = line.from;

      view.dispatch({
        selection: { anchor: pos, head: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });

      view.focus();

      // Highlight search text if provided
      if (searchText) {
        this.highlightText(searchText);
      }
    },
    highlightText(searchText: string) {
      if (!searchText) return;

      const content = view.state.doc.toString();
      const searchLower = searchText.toLowerCase();
      const decorations: any[] = [];

      let pos = 0;
      while (pos < content.length) {
        const index = content.toLowerCase().indexOf(searchLower, pos);
        if (index === -1) break;

        decorations.push(
          Decoration.mark({
            class: 'cm-search-highlight',
          }).range(index, index + searchText.length)
        );

        pos = index + 1;
      }

      if (decorations.length > 0) {
        view.dispatch({
          effects: StateEffect.appendConfig.of([
            EditorView.baseTheme({
              '.cm-search-highlight': {
                backgroundColor: '#ffd700',
                color: '#000',
                fontWeight: '600',
                borderRadius: '2px',
              },
            }),
          ]),
        });
      }
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
