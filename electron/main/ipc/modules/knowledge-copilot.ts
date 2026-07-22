import { ipcMain } from 'electron';
import { z } from 'zod';
import { knowledgeCopilotIndexService } from '../../services/knowledge-copilot-index.service.js';
import { runKnowledgeCopilotTask } from '../../services/knowledge-copilot-task.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { answerKnowledgeQuestionStream } from '../../services/knowledge-copilot-qa.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';
import { KNOWLEDGE_COPILOT_CONVERSATION_LIMITS } from '../../../shared/knowledge-copilot.constants.js';

const logger = loggerService.createLogger('Main:KnowledgeCopilotIPC');

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
  conversationId: z.string().min(1).optional(),
  context: z.object({
    summary: z.string().max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.SUMMARY_LENGTH).optional(),
    summaryUpToQuestionId: z.string().min(1).optional(),
    turns: z.array(z.object({
      id: z.string().min(1),
    mode: z.enum(['ask', 'agent-task']),
    query: z.string().min(1).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.QUESTION_LENGTH),
    answer: z.string().min(1).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.ANSWER_LENGTH),
    })).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.VISIBLE_TURNS),
  }).optional(),
});

const ConversationContextSchema = z.object({
  summary: z.string().max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.SUMMARY_LENGTH).optional(),
  summaryUpToQuestionId: z.string().min(1).optional(),
  turns: z.array(z.object({
  id: z.string().min(1),
  mode: z.enum(['ask', 'agent-task']),
  query: z.string().min(1).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.QUESTION_LENGTH),
  answer: z.string().min(1).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.ANSWER_LENGTH),
  })).max(KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.VISIBLE_TURNS),
});

const RunTaskSchema = z.object({
  task: z.string().default(''),
  writeMode: z.enum(['confirm', 'auto']).optional(),
  conversationId: z.string().min(1).optional(),
  context: ConversationContextSchema.optional(),
  decisions: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('approve') }),
    z.object({ type: z.literal('edit'), editedAction: z.object({ name: z.string().min(1), args: z.record(z.string(), z.unknown()) }) }),
    z.object({ type: z.literal('reject'), message: z.string().optional() }),
  ])).optional(),
}).refine((value) => value.task.trim().length > 0 || (value.conversationId && value.decisions), {
  message: 'A task or resumable conversation decision is required',
});

export function registerKnowledgeCopilotHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_INITIALIZE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      InitializeSchema.parse(request);
      const config = await aiConfigService.resolveKnowledgeCopilotConfig();
      await knowledgeCopilotIndexService.initialize(config.workspaceRoot, config.embeddingConfig);
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_INITIALIZE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_INDEX_NOTE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      const validated = IndexNoteSchema.parse(request);
      return await knowledgeCopilotIndexService.indexNote(validated);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_INDEX_NOTE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM, async (event, request) => {
    let requestId = '';
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      const validated = StreamQuestionSchema.parse(request);
      requestId = validated.requestId;
      event.sender.send(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM_EVENT, {
        requestId,
        type: 'start',
      });

      const result = await answerKnowledgeQuestionStream(validated.query, validated.context ?? { turns: [] }, (streamEvent) => {
        event.sender.send(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM_EVENT, {
          requestId,
          ...streamEvent,
        });
      });

      if (!result.success) {
        event.sender.send(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM_EVENT, {
          requestId,
          type: 'error',
          error: result.error || 'Failed to generate answer',
          sources: result.sources,
          usedSearchFallback: result.usedSearchFallback,
          insufficientEvidence: result.insufficientEvidence,
        });
        return result;
      }

      event.sender.send(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM_EVENT, {
        requestId,
        type: 'done',
        answer: result.answer || '',
        sources: result.sources,
        usedSearchFallback: result.usedSearchFallback,
      });
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM error: ${message}`);

      event.sender.send(IPC_CHANNELS.KNOWLEDGE_COPILOT_ANSWER_QUESTION_STREAM_EVENT, {
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

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_RUN_TASK, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      const validated = RunTaskSchema.parse(request);
      return await runKnowledgeCopilotTask(validated.task, {
        writeMode: validated.writeMode,
        conversationId: validated.conversationId,
        context: validated.context,
        decisions: validated.decisions,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_RUN_TASK error: ${message}`);
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
        conversationId: '',
        pendingActions: [],
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_DELETE_NOTE_INDEX, async (_event, noteId) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      const validatedNoteId = z.string().min(1).parse(noteId);
      return await knowledgeCopilotIndexService.deleteNoteIndex(validatedNoteId);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_DELETE_NOTE_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_GET_STATUS, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      const status = await knowledgeCopilotIndexService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_GET_STATUS error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.KNOWLEDGE_COPILOT_REBUILD_INDEX, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.KNOWLEDGE_COPILOT);
      await knowledgeCopilotIndexService.clear();
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`KNOWLEDGE_COPILOT_REBUILD_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  logger.info('Knowledge Copilot IPC handlers registered');
}
