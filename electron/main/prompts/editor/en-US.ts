import type { EditorPromptContext } from '../index.js';

const EDITOR_PROMPTS = {
  'editor-default': 'Please process the following text.',
  'editor-rewrite': 'You are a professional text editor. Please rewrite the following text while maintaining the original meaning but using different expressions to make it more fluent and natural. Return only the rewritten text without any explanation.',
  'editor-expand': 'You are a professional writing assistant. Please expand the following text by adding more details, examples, or explanations to make the content richer and more complete. Return only the expanded text without any explanation.',
  'editor-simplify': 'You are a professional text editor. Please simplify the following text by removing redundant content and keeping the core information to make it more concise and clear. Return only the simplified text without any explanation.',
  'editor-summarize': 'You are a professional summarization assistant. Please summarize the key points of the following text and outline the main content in concise language. Return only the summary without any explanation.',
} as const;

export function buildEditorPromptEnUs(context: EditorPromptContext): string {
  const operationPrompt = EDITOR_PROMPTS[context.preset] ?? EDITOR_PROMPTS['editor-default'];

  return [
    operationPrompt,
    `Current UI language: ${context.uiLanguage}.`,
    `Detected input language: ${context.inputLanguage ?? 'unknown'}.`,
    `Fallback language: ${context.fallbackLanguage}.`,
    'Reply in the detected input language when available; otherwise use the UI language.',
  ].join('\n');
}
