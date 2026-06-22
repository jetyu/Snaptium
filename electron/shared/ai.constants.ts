export const AI_WRITING_STYLE = {
  CONCISE: 'concise',
  RIGOROUS: 'rigorous',
  PROFESSIONAL: 'professional',
  ACCESSIBLE: 'accessible',
  VIVID: 'vivid',
} as const;

export type AiWritingStyle = (typeof AI_WRITING_STYLE)[keyof typeof AI_WRITING_STYLE];

export const AI_WRITING_SCENARIO = {
  GENERAL: 'general-writing',
  TECHNICAL_DOCUMENT: 'technical-document',
  PRODUCT_DOCUMENT: 'product-document',
  SUMMARY_REPORT: 'summary-report',
  DAILY_RECORD: 'daily-record',
  CONTENT_CREATION: 'content-creation',
  OFFICIAL_WRITING: 'official-writing',
} as const;

export type AiWritingScenario = (typeof AI_WRITING_SCENARIO)[keyof typeof AI_WRITING_SCENARIO];

export const AI_WRITING_MODE = {
  FOCUS: 'focus',
  STANDARD: 'standard',
  AGGRESSIVE: 'aggressive',
} as const;

export type AiWritingMode = (typeof AI_WRITING_MODE)[keyof typeof AI_WRITING_MODE];

export const AI_WRITING_DEFAULTS = {
  MODE: AI_WRITING_MODE.STANDARD,
  STYLE: AI_WRITING_STYLE.CONCISE,
  SCENARIO: AI_WRITING_SCENARIO.GENERAL,
  AUTO_CONTINUE: true,
} as const;

export const AI_PROMPT_PRESETS = {
  EDITOR_DEFAULT: 'editor-default',
  EDITOR_REWRITE: 'editor-rewrite',
  EDITOR_EXPAND: 'editor-expand',
  EDITOR_SIMPLIFY: 'editor-simplify',
  EDITOR_SUMMARIZE: 'editor-summarize',
} as const;

export type AiPromptPreset = (typeof AI_PROMPT_PRESETS)[keyof typeof AI_PROMPT_PRESETS];

const AI_WRITING_STYLE_VALUES = new Set<AiWritingStyle>(Object.values(AI_WRITING_STYLE));
const AI_WRITING_SCENARIO_VALUES = new Set<AiWritingScenario>(Object.values(AI_WRITING_SCENARIO));
const AI_WRITING_MODE_VALUES = new Set<AiWritingMode>(Object.values(AI_WRITING_MODE));
const AI_PROMPT_PRESET_VALUES = new Set<AiPromptPreset>(Object.values(AI_PROMPT_PRESETS));

export function isValidAiWritingStyle(value: unknown): value is AiWritingStyle {
  return AI_WRITING_STYLE_VALUES.has(value as AiWritingStyle);
}

export function isValidAiWritingScenario(value: unknown): value is AiWritingScenario {
  return AI_WRITING_SCENARIO_VALUES.has(value as AiWritingScenario);
}

export function isValidAiWritingMode(value: unknown): value is AiWritingMode {
  return AI_WRITING_MODE_VALUES.has(value as AiWritingMode);
}

export function isValidAiPromptPreset(value: unknown): value is AiPromptPreset {
  return AI_PROMPT_PRESET_VALUES.has(value as AiPromptPreset);
}
