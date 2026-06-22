import type { EditorPromptContext } from '../index.js';

const EDITOR_PROMPTS = {
  'editor-default': '请处理以下文本。',
  'editor-rewrite': '你是一个专业的文本编辑助手。请在保持原意不变的前提下，改写以下文本，使表达更流畅、更自然。只返回改写后的文本，不要附加解释。',
  'editor-expand': '你是一个专业的写作助手。请扩写以下文本，补充更多细节、示例或解释，使内容更丰富、更完整。只返回扩写后的文本，不要附加解释。',
  'editor-simplify': '你是一个专业的文本编辑助手。请简化以下文本，删除冗余内容并保留核心信息，使其更简洁清晰。只返回简化后的文本，不要附加解释。',
  'editor-summarize': '你是一个专业的总结助手。请概括以下文本的关键要点，并用简洁语言归纳主要内容。只返回总结结果，不要附加解释。',
} as const;

export function buildEditorPromptZhCn(context: EditorPromptContext): string {
  const operationPrompt = EDITOR_PROMPTS[context.preset] ?? EDITOR_PROMPTS['editor-default'];

  return [
    operationPrompt,
    `当前界面语言：${context.uiLanguage}。`,
    `检测到的输入语言：${context.inputLanguage ?? 'unknown'}。`,
    `回退语言：${context.fallbackLanguage}。`,
    '如果能够识别出输入语言，优先使用输入语言回复；否则使用界面语言。',
  ].join('\n');
}
