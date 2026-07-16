import { aiConfigService } from './ai-config.service.js';
import { createProviderChatModel } from './ai-provider.service.js';
import { knowledgeCopilotIndexService } from './knowledge-copilot-index.service.js';
import { assessKnowledgeEvidence } from './knowledge-evidence-assessment.service.js';
import { loggerService } from './logger.service.js';
import { buildKnowledgeAnswerPrompt } from '../prompts/index.js';
import { $t } from '../utils/i18n.js';

const logger = loggerService.createLogger('Main:KnowledgeCopilotQAService');

type KnowledgeSearchResults = Awaited<ReturnType<typeof knowledgeCopilotIndexService.searchByVector>>;
type KnowledgeCopilotConfig = Awaited<ReturnType<typeof aiConfigService.resolveKnowledgeCopilotConfig>>;

export interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: KnowledgeSearchResults;
  usedSearchFallback: boolean;
  insufficientEvidence?: boolean;
  error?: string;
}

export type KnowledgeAnswerStage = 'preparing' | 'searching' | 'assessing' | 'sourcing' | 'generating';

export type KnowledgeAnswerStreamEvent =
  | {
    type: 'stage';
    stage: KnowledgeAnswerStage;
  }
  | {
    type: 'sources';
    sources: KnowledgeSearchResults;
    usedSearchFallback: boolean;
    insufficientEvidence?: boolean;
  }
  | {
    type: 'delta';
    text: string;
  };

function createInsufficientEvidenceMessage(): string {
  return $t(
    'search.knowledgeCopilotInsufficientEvidence',
    'The current knowledge base does not contain enough evidence to answer this question.',
  );
}

export async function ensureKnowledgeCopilotReady(): Promise<KnowledgeCopilotConfig> {
  const config = await aiConfigService.resolveKnowledgeCopilotConfig();

  if (!knowledgeCopilotIndexService.isReady()) {
    await knowledgeCopilotIndexService.initialize(config.workspaceRoot, config.embeddingConfig);
  } else {
    await knowledgeCopilotIndexService.updateEmbeddingConfig(config.embeddingConfig);
  }

  return config;
}

export async function answerKnowledgeQuestionStream(
  query: string,
  onEvent: (event: KnowledgeAnswerStreamEvent) => void,
): Promise<KnowledgeAnswerResult> {
  onEvent({ type: 'stage', stage: 'preparing' });
  const config = await ensureKnowledgeCopilotReady();
  onEvent({ type: 'stage', stage: 'searching' });
  const results = await knowledgeCopilotIndexService.searchKnowledgeBase({
    query,
    topK: Number(config.knowledgeCopilot.topK),
    similarityThreshold: Number(config.knowledgeCopilot.similarityThreshold),
    rerankerConfig: config.rerankerConfig,
  });

  if (!results.length) {
    return {
      success: false,
      error: createInsufficientEvidenceMessage(),
      sources: [],
      usedSearchFallback: false,
      insufficientEvidence: true,
    };
  }

  onEvent({ type: 'stage', stage: 'assessing' });
  const evidence = assessKnowledgeEvidence(results);
  if (!evidence.sufficient) {
    logger.info('Knowledge stream answer rejected due to insufficient evidence', {
      highestScore: evidence.highestScore,
      averageScore: evidence.averageScore,
      consideredCount: evidence.consideredCount,
    });
    return {
      success: false,
      error: createInsufficientEvidenceMessage(),
      sources: results,
      usedSearchFallback: false,
      insufficientEvidence: true,
    };
  }

  onEvent({ type: 'stage', stage: 'sourcing' });
  if (!config.askChatConfig) {
    const summary = results
      .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
      .join('\n\n');

    return {
      success: true,
      answer: summary,
      sources: results,
      usedSearchFallback: true,
    };
  }

  onEvent({
    type: 'sources',
    sources: results,
    usedSearchFallback: false,
  });

  onEvent({ type: 'stage', stage: 'generating' });
  const contextText = results.map((res) => res.chunk.content).join('\n---\n');
  const systemPrompt = buildKnowledgeAnswerPrompt(config.uiLanguage, query, contextText);
  const chatModel = createProviderChatModel({
    provider: config.askChatConfig.provider,
    baseUrl: config.askChatConfig.baseUrl,
    apiKey: config.askChatConfig.apiKey,
    model: config.askChatConfig.model,
  });
  let answer = '';
  const stream = await chatModel.stream([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ]);
  for await (const chunk of stream) {
    const text = chunk.text;
    if (!text) continue;
    answer += text;
    onEvent({ type: 'delta', text });
  }

  return {
    success: true,
    answer,
    sources: results,
    usedSearchFallback: false,
  };
}

