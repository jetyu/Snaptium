import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, EditorState, Annotation } from '@codemirror/state';
import { keymap } from '@codemirror/view';

// 定义补全建议的状态效果
const setSuggestion = StateEffect.define<string | null>();

// 定义标记：表示这是接受AI建议的操作
export const acceptedSuggestionAnnotation = Annotation.define<boolean>();

// 记录最近一次建议被清除（无论是被接受、拒绝还是用户打字覆盖）的时间戳
let lastSuggestionClearTime = 0;

export function getLastSuggestionClearTime(): number {
  return lastSuggestionClearTime;
}

// 补全建议的状态字段
const suggestionState = StateField.define<string | null>({
  create: () => null,
  update(value, tr) {
    let nextValue = value;
    for (const effect of tr.effects) {
      if (effect.is(setSuggestion)) {
        nextValue = effect.value;
      }
    }
    // 如果文档发生变化（用户输入），清除建议
    if (tr.docChanged && nextValue !== null) {
      nextValue = null;
    }
    
    // 如果发生状态翻转（从有建议变为无建议），重置冷却时间
    if (value !== null && nextValue === null) {
      lastSuggestionClearTime = Date.now();
    }
    
    return nextValue;
  },
});

// Ghost text widget - 显示灰色的补全建议
class SuggestionWidget extends WidgetType {
  constructor(readonly suggestion: string) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this.suggestion;
    span.className = 'cm-ai-suggestion';
    span.style.cssText = 'color: #888; opacity: 0.6; pointer-events: none; user-select: none;';
    return span;
  }

  eq(other: SuggestionWidget) {
    return this.suggestion === other.suggestion;
  }

  ignoreEvent() {
    return true;
  }
}

const suggestionDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.state.field(suggestionState) !== update.startState.field(suggestionState)) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const suggestion = view.state.field(suggestionState);
      if (!suggestion) {
        return Decoration.none;
      }

      const pos = view.state.selection.main.head;
      const widget = Decoration.widget({
        widget: new SuggestionWidget(suggestion),
        side: 1,
      });

      return Decoration.set([widget.range(pos)]);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// 接受补全的命令
function acceptSuggestion(view: EditorView): boolean {
  const suggestion = view.state.field(suggestionState);
  if (!suggestion) {
    return false; // 返回 false 让 Tab 键继续执行默认行为（缩进）
  }

  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, insert: suggestion },
    selection: { anchor: pos + suggestion.length },
    effects: setSuggestion.of(null),
    annotations: [acceptedSuggestionAnnotation.of(true)],
  });

  return true; // 返回 true 表示已处理，阻止默认行为
}

// 拒绝补全的命令
function rejectSuggestion(view: EditorView): boolean {
  const suggestion = view.state.field(suggestionState);
  if (!suggestion) {
    return false;
  }

  view.dispatch({
    effects: setSuggestion.of(null),
  });

  return true;
}

// 键盘快捷键
// Tab 键：有建议时接受，无建议时执行默认缩进
// Escape 键：拒绝建议
const suggestionKeymap = keymap.of([
  {
    key: 'Tab',
    run: acceptSuggestion,
  },
  {
    key: 'Escape',
    run: rejectSuggestion,
  },
]);

/**
 * 显示AI补全建议
 */
export function showAiSuggestion(view: EditorView, suggestion: string) {
  if (!suggestion) return;

  view.dispatch({
    effects: setSuggestion.of(suggestion),
  });
}

/**
 * 清除AI补全建议
 */
export function clearAiSuggestion(view: EditorView) {
  view.dispatch({
    effects: setSuggestion.of(null),
  });
}

/**
 * 获取当前的补全建议
 */
export function getCurrentSuggestion(state: EditorState): string | null {
  return state.field(suggestionState, false) || null;
}

/**
 * 检查是否有活动的补全建议
 */
export function hasSuggestion(state: EditorState): boolean {
  return getCurrentSuggestion(state) !== null;
}

/**
 * AI补全插件扩展
 */
export const aiCompletionPlugin = [
  suggestionState,
  suggestionDecorations,
  suggestionKeymap,
  EditorView.baseTheme({
    '.cm-ai-suggestion': {
      fontStyle: 'italic',
    },
  }),
];
