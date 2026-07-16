import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeCopilotDecision, KnowledgeCopilotTaskResult, KnowledgeCopilotWriteMode } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { knowledgeCopilotService } from '../services/knowledge-copilot.service';

const knowledgeCopilotTaskLogger = createLogger('KnowledgeCopilotTask');

export function useKnowledgeCopilotTask() {
  const isRunning = ref(false);
  const result = ref<KnowledgeCopilotTaskResult | null>(null);
  const error = ref<string | null>(null);

  const runTask = async (
    task: string,
    writeMode: KnowledgeCopilotWriteMode = 'confirm',
    conversationId?: string,
  ): Promise<KnowledgeCopilotTaskResult> => {
    if (!task.trim()) {
      throw new Error('Task cannot be empty');
    }

    knowledgeCopilotTaskLogger.debug(`Starting agent task (length=${task.length})`);
    isRunning.value = true;
    error.value = null;
    result.value = null;

    try {
      const taskResult = await knowledgeCopilotService.runTask(task, writeMode, conversationId);
      if (!taskResult.success) {
        throw new Error(taskResult.error || 'Failed to run agent task');
      }

      result.value = taskResult;
      return taskResult;
    } catch (err) {
      const message = getErrorMessage(err);
      knowledgeCopilotTaskLogger.error(`Error running agent task: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isRunning.value = false;
      knowledgeCopilotTaskLogger.debug('Agent task flow finished');
    }
  };

  const resumeTask = async (
    conversationId: string,
    decisions: KnowledgeCopilotDecision[],
    writeMode: KnowledgeCopilotWriteMode = 'confirm',
  ): Promise<KnowledgeCopilotTaskResult> => {
    isRunning.value = true;
    error.value = null;
    try {
      const taskResult = await knowledgeCopilotService.runTask('', writeMode, conversationId, decisions);
      if (!taskResult.success) throw new Error(taskResult.error || 'Failed to resume agent task');
      result.value = taskResult;
      return taskResult;
    } finally {
      isRunning.value = false;
    }
  };

  return {
    runTask,
    resumeTask,
    isRunning,
    result,
    error,
  };
}

