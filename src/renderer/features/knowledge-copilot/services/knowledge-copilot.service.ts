import {
  electronApi,
  type KnowledgeCopilotWriteMode,
  type KnowledgeCopilotTaskResult,
  type KnowledgeCopilotDecision,
  type KnowledgeAnswerResult,
  type KnowledgeAnswerStreamEvent,
  type KnowledgeCopilotStatusResult,
} from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { KNOWLEDGE_COPILOT_ERROR_MESSAGES } from '../constants/knowledge-copilot.constants';

const knowledgeCopilotLogger = createLogger('Renderer:KnowledgeCopilot Service');

interface KnowledgeCopilotConfig {
  enabled?: boolean;
  embeddingSourceId?: string;
}

interface AppConfig {
  knowledgeCopilot?: KnowledgeCopilotConfig;
  noteSavePath?: string;
}

export interface IndexNoteRequest {
  noteId: string;
  noteTitle: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface RebuildIndexProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
}

/**
 * KnowledgeCopilot Service - Orchestration Layer
 * Handles complex business logic, initialization, and cross-service coordination.
 */
export const knowledgeCopilotService = {
  isAvailable(): boolean {
    return electronApi.knowledgeCopilot.isAvailable();
  },

  /**
   * Orchestrate initialization using app settings (Business Logic)
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await electronApi.settings.getConfig() as unknown as AppConfig;
      if (!config.knowledgeCopilot?.enabled) {
        return { success: false, error: KNOWLEDGE_COPILOT_ERROR_MESSAGES.DISABLED };
      }

      const workspaceRoot = config.noteSavePath;
      if (!workspaceRoot) {
        return { success: false, error: KNOWLEDGE_COPILOT_ERROR_MESSAGES.NO_WORKSPACE };
      }

      const result = await electronApi.knowledgeCopilot.initialize();

      return result;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeCopilotLogger.error('KnowledgeCopilot initialization failed', { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Index a single note (Batch-Atomic call to Main)
   */
  async indexNote(request: IndexNoteRequest): Promise<{ success: boolean; chunksIndexed?: number; error?: string }> {
    return await electronApi.knowledgeCopilot.indexNote({
      ...request,
      chunkSize: request.chunkSize || 500,
      chunkOverlap: request.chunkOverlap || 50,
    });
  },

  /**
   * Full rebuild loop orchestrated in Renderer (Business Loop)
   */
  async rebuildIndex(
    notes: Array<{ id: string; title: string; content: string }>,
    options: { chunkSize: number; chunkOverlap: number; onProgress?: (p: RebuildIndexProgress) => void }
  ) {
    const clearResult = await electronApi.knowledgeCopilot.clearIndex();
    if (!clearResult.success) {
      throw new Error(clearResult.error || 'Failed to clear vector index');
    }

    const total = notes.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      const note = notes[i];
      try {
        const res = await this.indexNote({
          noteId: note.id,
          noteTitle: note.title,
          content: note.content,
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        });

        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }

      options.onProgress?.({
        total,
        current: i + 1,
        success: successCount,
        failed: failCount,
      });
    }

    return { total, successCount, failCount };
  },

  async answerQuestionStream(
    query: string,
    callbacks: {
      onEvent?: (event: KnowledgeAnswerStreamEvent) => void;
      onDelta?: (text: string) => void;
    } = {},
  ): Promise<KnowledgeAnswerResult> {
    const requestId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = electronApi.knowledgeCopilot.onAnswerQuestionStreamEvent((event) => {
        if (event.requestId !== requestId) {
          return;
        }

        callbacks.onEvent?.(event);
        if (event.type === 'delta') {
          callbacks.onDelta?.(event.text);
        }
      });

      return await electronApi.knowledgeCopilot.answerQuestionStream({ query, requestId });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeCopilotLogger.error('KnowledgeCopilot streaming question failed', { error: message });
      return {
        success: false,
        error: message,
        answer: undefined,
        sources: [],
        usedSearchFallback: false,
        insufficientEvidence: false,
      };
    } finally {
      unsubscribe?.();
    }
  },

  async runTask(
    task: string,
    writeMode: KnowledgeCopilotWriteMode = 'confirm',
    conversationId?: string,
    decisions?: KnowledgeCopilotDecision[],
  ): Promise<KnowledgeCopilotTaskResult> {
    try {
      return await electronApi.knowledgeCopilot.runTask({ task, writeMode, conversationId, decisions });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeCopilotLogger.error('KnowledgeCopilot agent task failed', { error: message });
      return {
        success: false,
        error: message,
        finalAnswer: undefined,
        steps: [],
        traceEvents: [],
        sources: [],
        writeMode,
        pendingWrites: [],
        executedWrites: [],
        stopReason: undefined,
        conversationId: conversationId ?? '',
        pendingActions: [],
      };
    }
  },

  async getStatus(): Promise<KnowledgeCopilotStatusResult> {
    return await electronApi.knowledgeCopilot.getStatus();
  },

  async deleteNoteIndex(noteId: string): Promise<{ success: boolean; error?: string }> {
    return await electronApi.knowledgeCopilot.deleteNoteIndex(noteId);
  },

  /**
   * Clear all index data from the vector store
   */
  async clearIndex(): Promise<{ success: boolean; error?: string }> {
    return await electronApi.knowledgeCopilot.clearIndex();
  },
};

