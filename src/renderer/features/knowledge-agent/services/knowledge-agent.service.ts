import {
  electronApi,
  type KnowledgeAgentWriteMode,
  type KnowledgeAgentTaskResult,
  type KnowledgeAnswerResult,
  type KnowledgeAgentStatusResult,
} from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { KNOWLEDGE_AGENT_ERROR_MESSAGES } from '../constants/knowledge-agent.constants';

const knowledgeAgentLogger = createLogger('Renderer:KnowledgeAgent Service');

interface KnowledgeAgentConfig {
  enabled?: boolean;
  embeddingSourceId?: string;
}

interface AppConfig {
  knowledgeAgent?: KnowledgeAgentConfig;
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
 * KnowledgeAgent Service - Orchestration Layer
 * Handles complex business logic, initialization, and cross-service coordination.
 */
export const knowledgeAgentService = {
  isAvailable(): boolean {
    return electronApi.knowledgeAgent.isAvailable();
  },

  /**
   * Orchestrate initialization using app settings (Business Logic)
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await electronApi.settings.getConfig() as unknown as AppConfig;
      if (!config.knowledgeAgent?.enabled) {
        return { success: false, error: KNOWLEDGE_AGENT_ERROR_MESSAGES.DISABLED };
      }

      const workspaceRoot = config.noteSavePath;
      if (!workspaceRoot) {
        return { success: false, error: KNOWLEDGE_AGENT_ERROR_MESSAGES.NO_WORKSPACE };
      }

      const result = await electronApi.knowledgeAgent.initialize();

      return result;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeAgentLogger.error('KnowledgeAgent initialization failed', { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Index a single note (Batch-Atomic call to Main)
   */
  async indexNote(request: IndexNoteRequest): Promise<{ success: boolean; chunksIndexed?: number; error?: string }> {
    return await electronApi.knowledgeAgent.indexNote({
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
    const clearResult = await electronApi.knowledgeAgent.clearIndex();
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

  async answerQuestion(query: string): Promise<KnowledgeAnswerResult> {
    try {
      return await electronApi.knowledgeAgent.answerQuestion({ query });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeAgentLogger.error('KnowledgeAgent question failed', { error: message });
      return {
        success: false,
        error: message,
        answer: undefined,
        sources: [],
        usedSearchFallback: false,
        insufficientEvidence: false,
      };
    }
  },

  async runTask(task: string, writeMode: KnowledgeAgentWriteMode = 'confirm'): Promise<KnowledgeAgentTaskResult> {
    try {
      return await electronApi.knowledgeAgent.runTask({ task, writeMode });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      knowledgeAgentLogger.error('KnowledgeAgent agent task failed', { error: message });
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
      };
    }
  },

  async getStatus(): Promise<KnowledgeAgentStatusResult> {
    return await electronApi.knowledgeAgent.getStatus();
  },

  async deleteNoteIndex(noteId: string): Promise<{ success: boolean; error?: string }> {
    return await electronApi.knowledgeAgent.deleteNoteIndex(noteId);
  },

  /**
   * Clear all index data from the vector store
   */
  async clearIndex(): Promise<{ success: boolean; error?: string }> {
    return await electronApi.knowledgeAgent.clearIndex();
  },
};

