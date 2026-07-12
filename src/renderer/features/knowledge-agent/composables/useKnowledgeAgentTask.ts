import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeAgentTaskResult, KnowledgeAgentWriteMode } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { knowledgeAgentService } from '../services/knowledge-agent.service';

const knowledgeAgentTaskLogger = createLogger('KnowledgeAgentTask');

export function useKnowledgeAgentTask() {
  const isRunning = ref(false);
  const result = ref<KnowledgeAgentTaskResult | null>(null);
  const error = ref<string | null>(null);

  const runTask = async (
    task: string,
    writeMode: KnowledgeAgentWriteMode = 'confirm',
  ): Promise<KnowledgeAgentTaskResult> => {
    if (!task.trim()) {
      throw new Error('Task cannot be empty');
    }

    knowledgeAgentTaskLogger.debug(`Starting agent task (length=${task.length})`);
    isRunning.value = true;
    error.value = null;
    result.value = null;

    try {
      const taskResult = await knowledgeAgentService.runTask(task, writeMode);
      if (!taskResult.success) {
        throw new Error(taskResult.error || 'Failed to run agent task');
      }

      result.value = taskResult;
      return taskResult;
    } catch (err) {
      const message = getErrorMessage(err);
      knowledgeAgentTaskLogger.error(`Error running agent task: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isRunning.value = false;
      knowledgeAgentTaskLogger.debug('Agent task flow finished');
    }
  };

  return {
    runTask,
    isRunning,
    result,
    error,
  };
}

