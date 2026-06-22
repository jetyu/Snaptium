import { AI_WRITING_DEFAULTS, AI_WRITING_SCENARIO, AI_WRITING_STYLE } from '../../../shared/ai.constants.js';
import type { AssistantPromptContext } from '../index.js';

const STYLE_PROMPTS = {
  [AI_WRITING_STYLE.CONCISE]: 'Writing style: concise. Emphasize direct, compact wording without redundancy.',
  [AI_WRITING_STYLE.RIGOROUS]: 'Writing style: rigorous. Emphasize logical precision, clear grounding, and accurate concepts.',
  [AI_WRITING_STYLE.PROFESSIONAL]: 'Writing style: professional. Emphasize reliable wording, accurate terminology, and a polished tone.',
  [AI_WRITING_STYLE.ACCESSIBLE]: 'Writing style: accessible. Emphasize easy-to-understand wording and avoid unnecessary jargon.',
  [AI_WRITING_STYLE.VIVID]: 'Writing style: vivid. Emphasize imagery, rhythm, and expressive wording when appropriate.',
} as const;

const SCENARIO_PROMPTS = {
  [AI_WRITING_SCENARIO.GENERAL]: 'Writing scenario: general writing. Keep the continuation natural, clear, and broadly applicable to everyday writing tasks.',
  [AI_WRITING_SCENARIO.TECHNICAL_DOCUMENT]: 'Writing scenario: technical documentation. Keep terminology accurate, structure clear, and steps or constraints explicit when relevant.',
  [AI_WRITING_SCENARIO.PRODUCT_DOCUMENT]: 'Writing scenario: product documentation. Focus on feature explanation, user value, usage guidance, and scope boundaries.',
  [AI_WRITING_SCENARIO.SUMMARY_REPORT]: 'Writing scenario: summary and reporting. Highlight conclusions, progress, issues, and next actions with strong prioritization.',
  [AI_WRITING_SCENARIO.DAILY_RECORD]: 'Writing scenario: daily notes. Keep the continuation natural, candid, and easy to scan later.',
  [AI_WRITING_SCENARIO.CONTENT_CREATION]: 'Writing scenario: content creation. Balance readability, appeal, and momentum while keeping the content coherent and complete.',
  [AI_WRITING_SCENARIO.OFFICIAL_WRITING]: 'Writing scenario: official writing. Keep the continuation formal, compliant, measured, and structurally complete.',
} as const;

export function buildAssistantPromptEnUs(context: AssistantPromptContext): string {
  const stylePrompt = STYLE_PROMPTS[context.writingStyle] ?? STYLE_PROMPTS[AI_WRITING_DEFAULTS.STYLE];
  const scenarioPrompt = SCENARIO_PROMPTS[context.writingScenario] ?? SCENARIO_PROMPTS[AI_WRITING_DEFAULTS.SCENARIO];

  return [
    'You are an AI writing assistant. Continue the user\'s text naturally based on the provided context.',
    `Current UI language: ${context.uiLanguage}.`,
    `Detected input language: ${context.inputLanguage ?? 'unknown'}.`,
    `Fallback language: ${context.fallbackLanguage}.`,
    '',
    'Requirements:',
    '- Reply in the detected input language when available; otherwise use the UI language.',
    '- Output only the continuation, without repeating or rewriting the original text, in no more than one sentence.',
    '- Strictly preserve the source language, tone, and writing style.',
    '- Keep the content tightly connected to the context and avoid unrelated information.',
    '- Return plain continuous text only, without paragraphs, line breaks, or lists.',
    '- Do not add explanations, notes, prefixes, or summaries.',
    stylePrompt,
    scenarioPrompt,
  ].join('\n');
}
