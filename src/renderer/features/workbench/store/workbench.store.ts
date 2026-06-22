import { computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { createLogger } from '@renderer/features/logger';
import { useSettingsStore } from '@renderer/features/settings';
import {
  WORKBENCH_LIMITS,
  sanitizeWorkbenchSettings,
  type WorkbenchRecommendationFeedbackAction,
  type WorkbenchRecommendationFeedbackEntry,
  type WorkbenchQuestionAgentStep,
  type WorkbenchQuestionAgentExecutedWrite,
  type WorkbenchQuestionAgentTraceEvent,
  type WorkbenchQuestionAgentWriteProposal,
  type WorkbenchAgentWriteMode,
  type WorkbenchQuestionEntry,
  type WorkbenchQuestionMode,
  type WorkbenchQuestionSource,
  type WorkbenchSettings,
} from '../constants/workbench.constants';

const workbenchLogger = createLogger('WorkbenchStore');

interface RecommendationFeedbackPayload {
  noteId: string;
  reasonType: string;
  action: WorkbenchRecommendationFeedbackAction;
  at?: number;
}

function trimAnswer(answer: string) {
  return answer.trim().slice(0, 240);
}

function trimFullAnswer(answer: string) {
  return answer.trim().slice(0, 4000);
}

function sanitizeQuestionSources(sources?: WorkbenchQuestionSource[]) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources
    .map((source) => ({
      noteId: source.noteId.trim(),
      noteTitle: source.noteTitle.trim(),
    }))
    .filter((source) => source.noteId.length > 0)
    .slice(0, 8);
}

function sanitizeQuestionIdList(ids?: string[]): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids
    .map((id) => String(id ?? '').trim())
    .filter((id, index, items) => id.length > 0 && items.indexOf(id) === index)
    .slice(0, 20);
}

function createQuestionId(query: string, askedAt: number) {
  return `${askedAt}:${query.trim().slice(0, 48)}`;
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const settingsStore = useSettingsStore();
  const { config } = storeToRefs(settingsStore);

  const workbench = computed(() => sanitizeWorkbenchSettings(config.value.workbench));
  const recentQuestions = computed(() => workbench.value.recentQuestions);
  const recommendationFeedback = computed(() => workbench.value.recommendationFeedback);

  async function saveWorkbench(nextValue: Partial<WorkbenchSettings>) {
    const nextSettings = sanitizeWorkbenchSettings({
      ...workbench.value,
      ...nextValue,
    });

    await settingsStore.saveSettings({
      workbench: nextSettings,
    });
  }

  async function recordQuestion(payload: {
    query: string;
    threadId?: string;
    mode?: WorkbenchQuestionMode;
    agentWriteMode?: WorkbenchAgentWriteMode;
    askedAt?: number;
    answeredAt?: number;
    answer?: string;
    sourceNoteIds?: string[];
    sources?: WorkbenchQuestionSource[];
    agentSteps?: WorkbenchQuestionAgentStep[];
    agentTraceEvents?: WorkbenchQuestionAgentTraceEvent[];
    pendingWrites?: WorkbenchQuestionAgentWriteProposal[];
    executedWrites?: WorkbenchQuestionAgentExecutedWrite[];
    dismissedWriteIds?: string[];
    createdWriteIds?: string[];
  }): Promise<WorkbenchQuestionEntry | null> {
    const query = payload.query.trim();
    if (!query) {
      return null;
    }

    const askedAt = payload.askedAt ?? Date.now();
    const entryId = createQuestionId(query, askedAt);
    const threadId = payload.threadId?.trim() || entryId;
    const sources = sanitizeQuestionSources(payload.sources);
    const sourceNoteIds = Array.isArray(payload.sourceNoteIds)
      ? payload.sourceNoteIds
          .map((noteId) => String(noteId ?? '').trim())
          .filter((noteId, index, items) => noteId.length > 0 && items.indexOf(noteId) === index)
      : sources
          .map((source) => source.noteId)
          .filter((noteId, index, items) => noteId.length > 0 && items.indexOf(noteId) === index);
    const fullAnswer = trimFullAnswer(payload.answer ?? '');
    const answeredAt = Number(payload.answeredAt ?? 0);

    const nextEntry: WorkbenchQuestionEntry = {
      id: entryId,
      threadId,
      query,
      askedAt,
      answeredAt: Number.isFinite(answeredAt) && answeredAt > 0 ? answeredAt : undefined,
      answer: trimAnswer(fullAnswer),
      fullAnswer: fullAnswer || undefined,
      sourceNoteIds,
      sources,
      mode: payload.mode,
      agentWriteMode: payload.agentWriteMode,
      agentSteps: payload.agentSteps ?? [],
      agentTraceEvents: payload.agentTraceEvents ?? [],
      pendingWrites: payload.pendingWrites ?? [],
      executedWrites: payload.executedWrites ?? [],
      dismissedWriteIds: sanitizeQuestionIdList(payload.dismissedWriteIds),
      createdWriteIds: sanitizeQuestionIdList(payload.createdWriteIds),
    };

    const nextQuestions = [
      nextEntry,
      ...recentQuestions.value.filter((entry) => entry.id !== nextEntry.id),
    ].slice(0, WORKBENCH_LIMITS.QUESTIONS);

    await saveWorkbench({ recentQuestions: nextQuestions });
    return nextEntry;
  }

  async function updateQuestionAgentWriteState(payload: {
    questionId: string;
    dismissedWriteIds?: string[];
    createdWriteIds?: string[];
  }): Promise<WorkbenchQuestionEntry | null> {
    const questionId = payload.questionId.trim();
    if (!questionId) {
      return null;
    }

    const targetQuestion = recentQuestions.value.find((entry) => entry.id === questionId);
    if (!targetQuestion) {
      return null;
    }

    const nextEntry: WorkbenchQuestionEntry = {
      ...targetQuestion,
      dismissedWriteIds: sanitizeQuestionIdList(payload.dismissedWriteIds ?? targetQuestion.dismissedWriteIds),
      createdWriteIds: sanitizeQuestionIdList(payload.createdWriteIds ?? targetQuestion.createdWriteIds),
    };

    await saveWorkbench({
      recentQuestions: [
        nextEntry,
        ...recentQuestions.value.filter((entry) => entry.id !== questionId),
      ].slice(0, WORKBENCH_LIMITS.QUESTIONS),
    });

    return nextEntry;
  }

  async function deleteQuestion(questionId: string): Promise<boolean> {
    const normalizedQuestionId = questionId.trim();
    if (!normalizedQuestionId) {
      return false;
    }

    const nextQuestions = recentQuestions.value.filter((entry) => entry.id !== normalizedQuestionId);
    if (nextQuestions.length === recentQuestions.value.length) {
      return false;
    }

    await saveWorkbench({
      recentQuestions: nextQuestions,
    });
    return true;
  }

  async function recordRecommendationFeedback(payload: RecommendationFeedbackPayload): Promise<void> {
    const noteId = payload.noteId.trim();
    const reasonType = payload.reasonType.trim();
    if (!noteId || !reasonType) {
      return;
    }

    const existingEntry = recommendationFeedback.value.find((entry) => {
      return entry.noteId === noteId && entry.reasonType === reasonType && entry.action === payload.action;
    });

    const nextEntry: WorkbenchRecommendationFeedbackEntry = {
      noteId,
      reasonType,
      action: payload.action,
      count: Math.min(999, (existingEntry?.count ?? 0) + 1),
      lastAt: payload.at ?? Date.now(),
    };

    const nextFeedback = [
      nextEntry,
      ...recommendationFeedback.value.filter((entry) => {
        return !(entry.noteId === noteId && entry.reasonType === reasonType && entry.action === payload.action);
      }),
    ].slice(0, WORKBENCH_LIMITS.RECOMMENDATION_FEEDBACK);

    await saveWorkbench({ recommendationFeedback: nextFeedback });
  }

  async function cleanupNoteReferences(validNoteIds: string[]) {
    const validNoteIdSet = new Set(validNoteIds.map((noteId) => noteId.trim()).filter(Boolean));
    const nextSettings = sanitizeWorkbenchSettings({
      ...workbench.value,
      recentQuestions: recentQuestions.value.map((entry) => {
        return {
          ...entry,
          sourceNoteIds: entry.sourceNoteIds.filter((noteId) => validNoteIdSet.has(noteId)),
          sources: entry.sources?.filter((source) => validNoteIdSet.has(source.noteId)) ?? [],
          pendingWrites: entry.pendingWrites?.filter((proposal) => (
            proposal.type === 'create-note' || validNoteIdSet.has(proposal.noteId)
          )) ?? [],
        };
      }),
      recommendationFeedback: recommendationFeedback.value.filter((entry) => validNoteIdSet.has(entry.noteId)),
    });

    const hasChanged = JSON.stringify(nextSettings) !== JSON.stringify(workbench.value);
    if (!hasChanged) {
      return;
    }

    workbenchLogger.info('Cleaning workbench note references after workspace changes.');
    await settingsStore.saveSettings({ workbench: nextSettings });
  }

  return {
    workbench,
    recentQuestions,
    recommendationFeedback,
    recordQuestion,
    updateQuestionAgentWriteState,
    deleteQuestion,
    recordRecommendationFeedback,
    cleanupNoteReferences,
  };
});
