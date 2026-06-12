import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { Command } from '@codemirror/view';

/**
 * 在选中文本前后添加标记
 */
function wrapSelection(before: string, after: string = before): Command {
  return (view: EditorView) => {
    const changes = view.state.changeByRange((range) => {
      const selectedText = view.state.sliceDoc(range.from, range.to);
      const wrappedText = `${before}${selectedText}${after}`;
      
      return {
        changes: { from: range.from, to: range.to, insert: wrappedText },
        range: EditorSelection.range(
          range.from + before.length,
          range.to + before.length
        ),
      };
    });

    view.dispatch(changes, { userEvent: 'input.format' });
    view.focus();
    return true;
  };
}

/**
 * 在行首添加或移除前缀
 */
function toggleLinePrefix(prefix: string): Command {
  return (view: EditorView) => {
    const changes = view.state.changeByRange((range) => {
      const line = view.state.doc.lineAt(range.from);
      const lineText = line.text;

      if (lineText.startsWith(prefix)) {
        // 移除前缀
        return {
          changes: { from: line.from, to: line.from + prefix.length, insert: '' },
          range: EditorSelection.range(
            Math.max(line.from, range.from - prefix.length),
            Math.max(line.from, range.to - prefix.length)
          ),
        };
      } else {
        // 添加前缀
        return {
          changes: { from: line.from, to: line.from, insert: prefix },
          range: EditorSelection.range(range.from + prefix.length, range.to + prefix.length),
        };
      }
    });

    view.dispatch(changes, { userEvent: 'input.format' });
    view.focus();
    return true;
  };
}

/**
 * 插入代码块
 */
const insertCodeBlock: Command = (view: EditorView) => {
  const changes = view.state.changeByRange((range) => {
    const selectedText = view.state.sliceDoc(range.from, range.to);
    const insertText = `\`\`\`\n${selectedText}\n\`\`\``;
    
    return {
      changes: { from: range.from, to: range.to, insert: insertText },
      range: EditorSelection.range(range.from + 4, range.from + 4 + selectedText.length),
    };
  });

  view.dispatch(changes, { userEvent: 'input.format' });
  view.focus();
  return true;
};

/**
 * 插入链接
 */
const insertLink: Command = (view: EditorView) => {
  const changes = view.state.changeByRange((range) => {
    const selectedText = view.state.sliceDoc(range.from, range.to);
    
    if (selectedText) {
      const linkText = `[${selectedText}](url)`;
      return {
        changes: { from: range.from, to: range.to, insert: linkText },
        range: EditorSelection.range(
          range.from + selectedText.length + 3,
          range.from + selectedText.length + 6
        ),
      };
    } else {
      const linkText = '[链接文本](url)';
      return {
        changes: { from: range.from, to: range.to, insert: linkText },
        range: EditorSelection.range(range.from + 1, range.from + 5),
      };
    }
  });

  view.dispatch(changes, { userEvent: 'input.insert' });
  view.focus();
  return true;
};

/**
 * 插入图片
 */
const insertImage: Command = (view: EditorView) => {
  const changes = view.state.changeByRange((range) => {
    const insertText = '![图片描述](url)';
    return {
      changes: { from: range.from, to: range.to, insert: insertText },
      range: EditorSelection.range(range.from + 2, range.from + 6),
    };
  });

  view.dispatch(changes, { userEvent: 'input.insert' });
  view.focus();
  return true;
};

/**
 * 插入表格
 */
const insertTable: Command = (view: EditorView) => {
  const table = `| 列1 | 列2 | 列3 |
| --- | --- | --- |
| 内容 | 内容 | 内容 |
`;
  
  const changes = view.state.changeByRange((range) => {
    return {
      changes: { from: range.from, to: range.to, insert: table },
      range: EditorSelection.range(range.from + table.length, range.from + table.length),
    };
  });

  view.dispatch(changes, { userEvent: 'input.insert' });
  view.focus();
  return true;
};

/**
 * Markdown 命令集合
 * 使用 CodeMirror 标准 Command 接口
 */
export const markdownCommands = {
  bold: wrapSelection('**'),
  italic: wrapSelection('*'),
  strikethrough: wrapSelection('~~'),
  
  heading1: toggleLinePrefix('# '),
  heading2: toggleLinePrefix('## '),
  heading3: toggleLinePrefix('### '),
  
  bulletList: toggleLinePrefix('- '),
  numberedList: toggleLinePrefix('1. '),
  taskList: toggleLinePrefix('- [ ] '),
  
  quote: toggleLinePrefix('> '),
  
  codeBlock: insertCodeBlock,
  insertLink,
  insertImage,
  insertTable,
};
