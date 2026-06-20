import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeAgentTaskResult } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { ragService } from '../services/rag.service';

const ragAgentTaskLogger = createLogger('RAGAgentTask');

export function useRAGAgentTask() {
  const isRunning = ref(false);
  const result = ref<KnowledgeAgentTaskResult | null>(null);
  const error = ref<string | null>(null);

  const runTask = async (task: string): Promise<KnowledgeAgentTaskResult> => {
    if (!task.trim()) {
      throw new Error('Task cannot be empty');
    }

    ragAgentTaskLogger.debug(`Starting agent task (length=${task.length})`);
    isRunning.value = true;
    error.value = null;
    result.value = null;

    try {
      const taskResult = await ragService.runTask(task);
      if (!taskResult.success) {
        throw new Error(taskResult.error || 'Failed to run agent task');
      }

      result.value = taskResult;
      return taskResult;
    } catch (err) {
      const message = getErrorMessage(err);
      ragAgentTaskLogger.error(`Error running agent task: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isRunning.value = false;
      ragAgentTaskLogger.debug('Agent task flow finished');
    }
  };

  return {
    runTask,
    isRunning,
    result,
    error,
  };
}
