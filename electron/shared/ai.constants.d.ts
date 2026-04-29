export declare const AI_WRITING_STYLE: {
  readonly CONCISE: 'concise';
  readonly RIGOROUS: 'rigorous';
  readonly PROFESSIONAL: 'professional';
  readonly ACCESSIBLE: 'accessible';
  readonly VIVID: 'vivid';
};

export type AiWritingStyle = (typeof AI_WRITING_STYLE)[keyof typeof AI_WRITING_STYLE];

export declare const AI_WRITING_SCENARIO: {
  readonly GENERAL: 'general-writing';
  readonly TECHNICAL_DOCUMENT: 'technical-document';
  readonly PRODUCT_DOCUMENT: 'product-document';
  readonly SUMMARY_REPORT: 'summary-report';
  readonly DAILY_RECORD: 'daily-record';
  readonly CONTENT_CREATION: 'content-creation';
  readonly OFFICIAL_WRITING: 'official-writing';
};

export type AiWritingScenario = (typeof AI_WRITING_SCENARIO)[keyof typeof AI_WRITING_SCENARIO];

export declare const AI_WRITING_MODE: {
  readonly FOCUS: 'focus';
  readonly STANDARD: 'standard';
  readonly AGGRESSIVE: 'aggressive';
};

export type AiWritingMode = (typeof AI_WRITING_MODE)[keyof typeof AI_WRITING_MODE];

export declare const AI_WRITING_DEFAULTS: {
  readonly MODE: typeof AI_WRITING_MODE.STANDARD;
  readonly STYLE: typeof AI_WRITING_STYLE.CONCISE;
  readonly SCENARIO: typeof AI_WRITING_SCENARIO.GENERAL;
  readonly AUTO_CONTINUE: boolean;
};

export declare const AI_TEXT_OPERATION_PROMPTS: {
  readonly DEFAULT: string;
  readonly REWRITE: string;
  readonly EXPAND: string;
  readonly SIMPLIFY: string;
  readonly SUMMARIZE: string;
};

export declare function isValidAiWritingStyle(value: unknown): value is AiWritingStyle;
export declare function isValidAiWritingScenario(value: unknown): value is AiWritingScenario;
export declare function isValidAiWritingMode(value: unknown): value is AiWritingMode;
export declare function buildAiAssistantSystemPrompt(style?: AiWritingStyle, scenario?: AiWritingScenario): string;