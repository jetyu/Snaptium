import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

export interface MarkdownCommandsOptions {
  getEditorView: () => EditorView | undefined;
}

export function useMarkdownCommands({ getEditorView }: MarkdownCommandsOptions) {
  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    view.dispatch({
      changes: {
        from,
        to,
        insert: `${prefix}${selectedText}${suffix}`,
      },
      selection: EditorSelection.range(
        from + prefix.length,
        to + prefix.length
      ),
    });

    view.focus();
  };

  const insertAtCursor = (text: string, cursorOffset: number = 0) => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from } = state.selection.main;

    view.dispatch({
      changes: {
        from,
        to: from,
        insert: text,
      },
      selection: EditorSelection.cursor(from + text.length + cursorOffset),
    });

    view.focus();
  };

  const insertAtLineStart = (prefix: string) => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const line = state.doc.lineAt(from);
    const lineText = line.text;

    if (lineText.startsWith(prefix)) {
      view.dispatch({
        changes: {
          from: line.from,
          to: line.from + prefix.length,
          insert: '',
        },
      });
    } else {
      view.dispatch({
        changes: {
          from: line.from,
          to: line.from,
          insert: prefix,
        },
        selection: EditorSelection.range(from + prefix.length, to + prefix.length),
      });
    }

    view.focus();
  };

  const heading1 = () => insertAtLineStart('# ');
  const heading2 = () => insertAtLineStart('## ');
  const bold = () => wrapSelection('**');
  const italic = () => wrapSelection('*');
  const strikethrough = () => wrapSelection('~~');
  const bulletList = () => insertAtLineStart('- ');
  const numberedList = () => insertAtLineStart('1. ');
  const taskList = () => insertAtLineStart('- [ ] ');
  const quote = () => insertAtLineStart('> ');

  const codeBlock = () => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    const codeBlockText = `\`\`\`\n${selectedText}\n\`\`\``;

    view.dispatch({
      changes: {
        from,
        to,
        insert: codeBlockText,
      },
      selection: EditorSelection.cursor(from + 4),
    });

    view.focus();
  };

  const insertLink = () => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    const linkText = selectedText || 'link text';
    const linkMarkdown = `[${linkText}](url)`;

    view.dispatch({
      changes: {
        from,
        to,
        insert: linkMarkdown,
      },
      selection: EditorSelection.range(
        from + linkMarkdown.length - 4,
        from + linkMarkdown.length - 1
      ),
    });

    view.focus();
  };

  const insertImage = () => {
    const view = getEditorView();
    if (!view) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.sliceDoc(from, to);

    const altText = selectedText || 'image';
    const imageMarkdown = `![${altText}](url)`;

    view.dispatch({
      changes: {
        from,
        to,
        insert: imageMarkdown,
      },
      selection: EditorSelection.range(
        from + imageMarkdown.length - 4,
        from + imageMarkdown.length - 1
      ),
    });

    view.focus();
  };

  const insertTable = () => {
    const tableMarkdown = `| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n`;
    insertAtCursor(tableMarkdown, -tableMarkdown.length);
  };

  const executeAction = (actionName: string) => {
    const actions: Record<string, () => void> = {
      heading1,
      heading2,
      bold,
      italic,
      strikethrough,
      bulletList,
      numberedList,
      taskList,
      quote,
      codeBlock,
      insertLink,
      insertImage,
      insertTable,
    };

    const action = actions[actionName];
    if (action) {
      action();
    }
  };

  return {
    executeAction,
  };
}
