export const AI_WRITING_STYLE = {
  CONCISE: 'concise',
  RIGOROUS: 'rigorous',
  PROFESSIONAL: 'professional',
  ACCESSIBLE: 'accessible',
  VIVID: 'vivid',
};

export const AI_WRITING_SCENARIO = {
  GENERAL: 'general-writing',
  TECHNICAL_DOCUMENT: 'technical-document',
  PRODUCT_DOCUMENT: 'product-document',
  SUMMARY_REPORT: 'summary-report',
  DAILY_RECORD: 'daily-record',
  CONTENT_CREATION: 'content-creation',
  OFFICIAL_WRITING: 'official-writing',
};

export const AI_WRITING_DEFAULTS = {
  STYLE: AI_WRITING_STYLE.CONCISE,
  SCENARIO: AI_WRITING_SCENARIO.GENERAL,
};

const AI_WRITING_STYLE_VALUES = new Set(Object.values(AI_WRITING_STYLE));
const AI_WRITING_SCENARIO_VALUES = new Set(Object.values(AI_WRITING_SCENARIO));

const AI_WRITING_BASE_PROMPT = `You are an AI writing assistant. Continue the user's text naturally based on the provided context.
Requirements:
- Output only the continuation, without repeating or rewriting the original text, in no more than one sentence
- Strictly preserve the source language, tone, and writing style
- Keep the content tightly connected to the context and avoid unrelated information
- Return plain continuous text only, without paragraphs, line breaks, or lists
- Do not add explanations, notes, prefixes, or summaries`;

const AI_WRITING_STYLE_PROMPTS = {
  [AI_WRITING_STYLE.CONCISE]: 'Writing style: concise. Emphasize direct, compact wording without redundancy.',
  [AI_WRITING_STYLE.RIGOROUS]: 'Writing style: rigorous. Emphasize logical precision, clear grounding, and accurate concepts.',
  [AI_WRITING_STYLE.PROFESSIONAL]: 'Writing style: professional. Emphasize reliable wording, accurate terminology, and a polished tone.',
  [AI_WRITING_STYLE.ACCESSIBLE]: 'Writing style: accessible. Emphasize easy-to-understand wording and avoid unnecessary jargon.',
  [AI_WRITING_STYLE.VIVID]: 'Writing style: vivid. Emphasize imagery, rhythm, and expressive wording when appropriate.',
};

const AI_WRITING_SCENARIO_PROMPTS = {
  [AI_WRITING_SCENARIO.GENERAL]: 'Writing scenario: general writing. Keep the continuation natural, clear, and broadly applicable to everyday writing tasks.',
  [AI_WRITING_SCENARIO.TECHNICAL_DOCUMENT]: 'Writing scenario: technical documentation. Keep terminology accurate, structure clear, and steps or constraints explicit when relevant.',
  [AI_WRITING_SCENARIO.PRODUCT_DOCUMENT]: 'Writing scenario: product documentation. Focus on feature explanation, user value, usage guidance, and scope boundaries.',
  [AI_WRITING_SCENARIO.SUMMARY_REPORT]: 'Writing scenario: summary and reporting. Highlight conclusions, progress, issues, and next actions with strong prioritization.',
  [AI_WRITING_SCENARIO.DAILY_RECORD]: 'Writing scenario: daily notes. Keep the continuation natural, candid, and easy to scan later.',
  [AI_WRITING_SCENARIO.CONTENT_CREATION]: 'Writing scenario: content creation. Balance readability, appeal, and momentum while keeping the content coherent and complete.',
  [AI_WRITING_SCENARIO.OFFICIAL_WRITING]: 'Writing scenario: official writing. Keep the continuation formal, compliant, measured, and structurally complete.',
};

export const AI_TEXT_OPERATION_PROMPTS = {
  DEFAULT: 'Please process the following text.',
  REWRITE: 'You are a professional text editor. Please rewrite the following text while maintaining the original meaning but using different expressions to make it more fluent and natural. Return only the rewritten text without any explanation.',
  EXPAND: 'You are a professional writing assistant. Please expand the following text by adding more details, examples, or explanations to make the content richer and more complete. Return only the expanded text without any explanation.',
  SIMPLIFY: 'You are a professional text editor. Please simplify the following text by removing redundant content and keeping the core information to make it more concise and clear. Return only the simplified text without any explanation.',
  SUMMARIZE: 'You are a professional summarization assistant. Please summarize the key points of the following text and outline the main content in concise language. Return only the summary without any explanation.',
};

function buildStylePrompt(style) {
  const stylePrompt = AI_WRITING_STYLE_PROMPTS[style] || AI_WRITING_STYLE_PROMPTS[AI_WRITING_DEFAULTS.STYLE];

  return `${AI_WRITING_BASE_PROMPT}
${stylePrompt}`;
}

export function isValidAiWritingStyle(value) {
  return AI_WRITING_STYLE_VALUES.has(value);
}

export function isValidAiWritingScenario(value) {
  return AI_WRITING_SCENARIO_VALUES.has(value);
}

export function buildAiAssistantSystemPrompt(
  style = AI_WRITING_DEFAULTS.STYLE,
  scenario = AI_WRITING_DEFAULTS.SCENARIO
) {
  const stylePrompt = buildStylePrompt(style);
  const scenarioPrompt = AI_WRITING_SCENARIO_PROMPTS[scenario] || AI_WRITING_SCENARIO_PROMPTS[AI_WRITING_DEFAULTS.SCENARIO];

  return `${stylePrompt}\n${scenarioPrompt}`;
}