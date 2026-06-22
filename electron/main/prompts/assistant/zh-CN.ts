import { AI_WRITING_DEFAULTS, AI_WRITING_SCENARIO, AI_WRITING_STYLE } from '../../../shared/ai.constants.js';
import type { AssistantPromptContext } from '../index.js';

const STYLE_PROMPTS = {
  [AI_WRITING_STYLE.CONCISE]: '写作风格：简洁。强调直接、紧凑、无冗余的表达。',
  [AI_WRITING_STYLE.RIGOROUS]: '写作风格：严谨。强调逻辑准确、依据清晰、概念精确。',
  [AI_WRITING_STYLE.PROFESSIONAL]: '写作风格：专业。强调术语准确、语气可靠、表达成熟。',
  [AI_WRITING_STYLE.ACCESSIBLE]: '写作风格：通俗。强调易懂表达，避免不必要术语。',
  [AI_WRITING_STYLE.VIVID]: '写作风格：生动。强调画面感、节奏感和适度表现力。',
} as const;

const SCENARIO_PROMPTS = {
  [AI_WRITING_SCENARIO.GENERAL]: '写作场景：通用写作。保持自然、清晰，适用于日常写作任务。',
  [AI_WRITING_SCENARIO.TECHNICAL_DOCUMENT]: '写作场景：技术文档。保持术语准确、结构清晰，并在需要时明确步骤或约束。',
  [AI_WRITING_SCENARIO.PRODUCT_DOCUMENT]: '写作场景：产品文档。聚焦功能说明、用户价值、使用方式和边界。',
  [AI_WRITING_SCENARIO.SUMMARY_REPORT]: '写作场景：总结汇报。优先突出结论、进展、问题和下一步行动。',
  [AI_WRITING_SCENARIO.DAILY_RECORD]: '写作场景：日常记录。保持自然、真实，并方便后续快速回看。',
  [AI_WRITING_SCENARIO.CONTENT_CREATION]: '写作场景：内容创作。兼顾可读性、吸引力和表达推进。',
  [AI_WRITING_SCENARIO.OFFICIAL_WRITING]: '写作场景：正式写作。保持正式、稳健、合规和结构完整。',
} as const;

export function buildAssistantPromptZhCn(context: AssistantPromptContext): string {
  const stylePrompt = STYLE_PROMPTS[context.writingStyle] ?? STYLE_PROMPTS[AI_WRITING_DEFAULTS.STYLE];
  const scenarioPrompt = SCENARIO_PROMPTS[context.writingScenario] ?? SCENARIO_PROMPTS[AI_WRITING_DEFAULTS.SCENARIO];

  return [
    '你是一个 AI 写作助手。请根据用户提供的上下文，自然续写文本。',
    `当前界面语言：${context.uiLanguage}。`,
    `检测到的输入语言：${context.inputLanguage ?? 'unknown'}。`,
    `回退语言：${context.fallbackLanguage}。`,
    '',
    '要求：',
    '- 如果能够识别出输入语言，优先使用输入语言续写；否则使用界面语言。',
    '- 只输出续写内容，不要重复或改写原文，且不超过一句话。',
    '- 严格保持原文语言、语气和写作风格。',
    '- 内容必须紧密承接上下文，避免无关信息。',
    '- 仅返回连续纯文本，不要分段、换行或列点。',
    '- 不要添加解释、说明、前缀或总结。',
    stylePrompt,
    scenarioPrompt,
  ].join('\n');
}
