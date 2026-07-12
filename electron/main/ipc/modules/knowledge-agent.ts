import { ipcMain } from 'electron';
import { z } from 'zod';
import { knowledgeAgentIndexService } from '../../services/knowledge-agent-index.service.js';
import { runKnowledgeAgentTask } from '../../services/knowledge-agent-task.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { answerKnowledgeQuestionStream } from '../../services/knowledge-agent-qa.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';

const logger = loggerService.createLogger('Main:KnowledgeAgentIPC');

const InitializeSchema = z.object({}).optional();

const IndexNoteSchema = z.object({
  noteId: z.string().min(1),
  noteTitle: z.string().min(1),
  content: z.string(),
  chunkSize: z.number().int().positive().optional().default(500),
  chunkOverlap: z.number().int().nonnegative().optional().default(50),
});

const StreamQuestionSchema = z.object({
  query: z.string().min(1),
  requestId: z.string().min(1),
});

const RunTaskSchema = z.object({
  task: z.string().min(1),
  writeMode: z.enum(['confirm', 'auto']).optional(),
});

export function registerKnowledgeAgentHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_INITIALIZE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      InitializeSchema.parse(request);
      const config = await aiConfigService.resolveKnowledgeAgentConfig();
      await knowledgeAgentIndexService.initialize(config.workspaceRoot, config.embeddingConfig);
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_INITIALIZE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_INDEX_NOTE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      const validated = IndexNoteSchema.parse(request);
      return await knowledgeAgentIndexService.indexNote(validated);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_INDEX_NOTE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM, async (event, request) => {
    let requestId = '';
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      const validated = StreamQuestionSchema.parse(request);
      requestId = validated.requestId;
      event.sender.send(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM_EVENT, {
        requestId,
        type: 'start',
      });

      const result = await answerKnowledgeQuestionStream(validated.query, (streamEvent) => {
        event.sender.send(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM_EVENT, {
          requestId,
          ...streamEvent,
        });
      });

      if (!result.success) {
        event.sender.send(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM_EVENT, {
          requestId,
          type: 'error',
          error: result.error || 'Failed to generate answer',
          sources: result.sources,
          usedSearchFallback: result.usedSearchFallback,
          insufficientEvidence: result.insufficientEvidence,
        });
        return result;
      }

      event.sender.send(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM_EVENT, {
        requestId,
        type: 'done',
        answer: result.answer || '',
        sources: result.sources,
        usedSearchFallback: result.usedSearchFallback,
      });
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM error: ${message}`);

      event.sender.send(IPC_CHANNELS.KNOWLEDGE_AGENT_ANSWER_QUESTION_STREAM_EVENT, {
        requestId,
        type: 'error',
        error: message,
        sources: [],
        usedSearchFallback: false,
        insufficientEvidence: false,
      });
      return {
        success: false,
        error: message,
        sources: [],
        usedSearchFallback: false,
        insufficientEvidence: false,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_RUN_TASK, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      const validated = RunTaskSchema.parse(request);
      return await runKnowledgeAgentTask(validated.task, { writeMode: validated.writeMode });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_RUN_TASK error: ${message}`);
      return {
        success: false,
        error: message,
        finalAnswer: undefined,
        steps: [],
        traceEvents: [],
        sources: [],
        writeMode: 'confirm',
        pendingWrites: [],
        executedWrites: [],
        stopReason: undefined,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_DELETE_NOTE_INDEX, async (_event, noteId) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      const validatedNoteId = z.string().min(1).parse(noteId);
      return await knowledgeAgentIndexService.deleteNoteIndex(validatedNoteId);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_DELETE_NOTE_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_GET_STATUS, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      const status = await knowledgeAgentIndexService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_GET_STATUS error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_AGENT_REBUILD_INDEX, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_AGENT);
      await knowledgeAgentIndexService.clear();
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_AGENT_REBUILD_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  logger.info('Knowledge-agent IPC handlers registered');
}
