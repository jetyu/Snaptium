import { aiConfigService } from './ai-config.service.js';
import { createProviderChatModel } from './ai-provider.service.js';
import { knowledgeCopilotIndexService } from './knowledge-copilot-index.service.js';
import { assessKnowledgeEvidence } from './knowledge-evidence-assessment.service.js';
import { loggerService } from './logger.service.js';
import { buildKnowledgeAnswerPrompt, buildKnowledgeConversationSummaryPrompt, buildKnowledgeFollowupRewritePrompt } from '../prompts/index.js';
import { $t } from '../utils/i18n.js';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { KNOWLEDGE_COPILOT_CONVERSATION_LIMITS, type KnowledgeCopilotConversationContext } from '../../shared/knowledge-copilot.constants.js';
import { formatKnowledgeCopilotConversationContext, getKnowledgeCopilotRecentHistory, getKnowledgeCopilotSummaryCandidates } from './knowledge-copilot-conversation-context.service.js';

const logger = loggerService.createLogger('Main:KnowledgeCopilotQAService');

type KnowledgeSearchResults = Awaited<ReturnType<typeof knowledgeCopilotIndexService.searchByVector>>;
type KnowledgeCopilotConfig = Awaited<ReturnType<typeof aiConfigService.resolveKnowledgeCopilotConfig>>;

export interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: KnowledgeSearchResults;
  usedSearchFallback: boolean;
  insufficientEvidence?: boolean;
  conversationSummary?: string;
  conversationSummaryUpToQuestionId?: string;
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
  context: KnowledgeCopilotConversationContext,
  onEvent: (event: KnowledgeAnswerStreamEvent) => void,
): Promise<KnowledgeAnswerResult> {
  onEvent({ type: 'stage', stage: 'preparing' });
  const config = await ensureKnowledgeCopilotReady();
  const chatModel = config.askChatConfig
    ? createProviderChatModel({
      provider: config.askChatConfig.provider,
      baseUrl: config.askChatConfig.baseUrl,
      apiKey: config.askChatConfig.apiKey,
      model: config.askChatConfig.model,
    })
    : null;
  let conversationSummary = context.summary;
  let conversationSummaryUpToQuestionId = context.summaryUpToQuestionId;
  const summaryCandidates = getKnowledgeCopilotSummaryCandidates(context);
  if (chatModel && summaryCandidates.length > 0) {
    const summarized = await chatModel.invoke([
      new SystemMessage(buildKnowledgeConversationSummaryPrompt()),
      new HumanMessage([conversationSummary, formatKnowledgeCopilotConversationContext({ ...context, summary: undefined, turns: summaryCandidates })].filter(Boolean).join('\n\n')),
    ]);
    conversationSummary = summarized.text.trim().slice(0, KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.SUMMARY_LENGTH) || conversationSummary;
    conversationSummaryUpToQuestionId = summaryCandidates[summaryCandidates.length - 1]?.id ?? conversationSummaryUpToQuestionId;
  }
  const conversationContext = { ...context, summary: conversationSummary, summaryUpToQuestionId: conversationSummaryUpToQuestionId };
  const recentHistory = getKnowledgeCopilotRecentHistory(conversationContext);
  let retrievalQuery = query;
  if (chatModel && recentHistory.length > 0) {
    try {
      const rewritten = await chatModel.invoke([
        new SystemMessage(buildKnowledgeFollowupRewritePrompt(config.uiLanguage, query)),
        new HumanMessage(`${formatKnowledgeCopilotConversationContext(conversationContext)}\n\nLatest user question: ${query}`),
      ]);
      retrievalQuery = rewritten.text.trim() || query;
    } catch (error) {
      logger.warn('Knowledge follow-up rewrite failed; using original query', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  onEvent({ type: 'stage', stage: 'searching' });
  const results = await knowledgeCopilotIndexService.searchKnowledgeBase({
    query: retrievalQuery,
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
      conversationSummary,
      conversationSummaryUpToQuestionId,
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
      conversationSummary,
      conversationSummaryUpToQuestionId,
    };
  }

  onEvent({ type: 'stage', stage: 'sourcing' });
  if (!chatModel) {
    const summary = results
      .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
      .join('\n\n');

    return {
      success: true,
      answer: summary,
      sources: results,
      usedSearchFallback: true,
      conversationSummary,
      conversationSummaryUpToQuestionId,
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
  let answer = '';
  const stream = await chatModel.stream([
    new SystemMessage(systemPrompt),
    ...(conversationSummary ? [new HumanMessage(`Earlier conversation summary (reference only):\n${conversationSummary}`)] : []),
    ...recentHistory.flatMap((turn) => [
      new HumanMessage(turn.query),
      new AIMessage(turn.answer),
    ]),
    new HumanMessage(query),
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
    conversationSummary,
    conversationSummaryUpToQuestionId,
  };
}

