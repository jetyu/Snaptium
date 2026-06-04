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
  type WorkbenchQuestionEntry,
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
    askedAt?: number;
    answer?: string;
    sourceNoteIds?: string[];
    sources?: WorkbenchQuestionSource[];
  }): Promise<WorkbenchQuestionEntry | null> {
    const query = payload.query.trim();
    if (!query) {
      return null;
    }

    const askedAt = payload.askedAt ?? Date.now();
    const sources = sanitizeQuestionSources(payload.sources);
    const sourceNoteIds = Array.isArray(payload.sourceNoteIds)
      ? payload.sourceNoteIds
          .map((noteId) => String(noteId ?? '').trim())
          .filter((noteId, index, items) => noteId.length > 0 && items.indexOf(noteId) === index)
      : sources
          .map((source) => source.noteId)
          .filter((noteId, index, items) => noteId.length > 0 && items.indexOf(noteId) === index);
    const fullAnswer = trimFullAnswer(payload.answer ?? '');

    const nextEntry: WorkbenchQuestionEntry = {
      id: createQuestionId(query, askedAt),
      query,
      askedAt,
      answer: trimAnswer(fullAnswer),
      fullAnswer: fullAnswer || undefined,
      sourceNoteIds,
      sources,
    };

    const nextQuestions = [
      nextEntry,
      ...recentQuestions.value.filter((entry) => entry.query !== query),
    ].slice(0, WORKBENCH_LIMITS.QUESTIONS);

    await saveWorkbench({ recentQuestions: nextQuestions });
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
    deleteQuestion,
    recordRecommendationFeedback,
    cleanupNoteReferences,
  };
});
