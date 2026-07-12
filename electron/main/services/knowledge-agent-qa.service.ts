import { remoteAiService } from './remote-ai.service.js';
import { aiConfigService } from './ai-config.service.js';
import { knowledgeAgentIndexService } from './knowledge-agent-index.service.js';
import { assessKnowledgeEvidence } from './knowledge-evidence-assessment.service.js';
import { loggerService } from './logger.service.js';
import { buildKnowledgeAnswerPrompt } from '../prompts/index.js';
import { $t } from '../utils/i18n.js';

const logger = loggerService.createLogger('Main:KnowledgeAgentQAService');

type KnowledgeSearchResults = Awaited<ReturnType<typeof knowledgeAgentIndexService.searchByVector>>;
type KnowledgeAgentConfig = Awaited<ReturnType<typeof aiConfigService.resolveKnowledgeAgentConfig>>;

export interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: KnowledgeSearchResults;
  usedSearchFallback: boolean;
  insufficientEvidence?: boolean;
  error?: string;
}

export type KnowledgeAnswerStreamEvent =
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
    'search.knowledgeAgentInsufficientEvidence',
    'The current knowledge base does not contain enough evidence to answer this question.',
  );
}

export async function ensureKnowledgeAgentReady(): Promise<KnowledgeAgentConfig> {
  const config = await aiConfigService.resolveKnowledgeAgentConfig();

  if (!knowledgeAgentIndexService.isReady()) {
    await knowledgeAgentIndexService.initialize(config.workspaceRoot, config.embeddingConfig);
  } else {
    knowledgeAgentIndexService.updateEmbeddingConfig(config.embeddingConfig);
  }

  return config;
}

export async function answerKnowledgeQuestionStream(
  query: string,
  onEvent: (event: KnowledgeAnswerStreamEvent) => void,
): Promise<KnowledgeAnswerResult> {
  const config = await ensureKnowledgeAgentReady();
  const results = await knowledgeAgentIndexService.searchKnowledgeBase({
    query,
    topK: Number(config.knowledgeAgent.topK),
    similarityThreshold: Number(config.knowledgeAgent.similarityThreshold),
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

  if (!config.chatConfig) {
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

  const contextText = results.map((res) => res.chunk.content).join('\n---\n');
  const systemPrompt = buildKnowledgeAnswerPrompt(config.uiLanguage, query, contextText);
  const streamResult = await remoteAiService.chatStream({
    endpoint: config.chatConfig.endpoint,
    apiKey: config.chatConfig.apiKey,
    model: config.chatConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  }, (chunk) => {
    onEvent({ type: 'delta', text: chunk.content });
  });

  return {
    success: true,
    answer: streamResult.content,
    sources: results,
    usedSearchFallback: false,
  };
}

