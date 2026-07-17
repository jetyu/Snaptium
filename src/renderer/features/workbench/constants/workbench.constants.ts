export const WORKBENCH_MODULE_IDS = [
  'recentActivity',
  'recentQuestions',
  'smartRecommendation',
] as const;

export type WorkbenchModuleId = (typeof WORKBENCH_MODULE_IDS)[number];

export interface WorkbenchQuestionEntry {
  id: string;
  threadId: string;
  mode?: WorkbenchQuestionMode;
  agentWriteMode?: WorkbenchAgentWriteMode;
  query: string;
  askedAt: number;
  answeredAt?: number;
  answer: string;
  fullAnswer?: string;
  sourceNoteIds: string[];
  sources?: WorkbenchQuestionSource[];
  agentSteps?: WorkbenchQuestionAgentStep[];
  agentTraceEvents?: WorkbenchQuestionAgentTraceEvent[];
  pendingWrites?: WorkbenchQuestionAgentWriteProposal[];
  executedWrites?: WorkbenchQuestionAgentExecutedWrite[];
  dismissedWriteIds?: string[];
  createdWriteIds?: string[];
}

export interface WorkbenchQuestionSource {
  noteId: string;
  noteTitle: string;
}

export type WorkbenchQuestionMode = 'ask' | 'agent-task';

export type WorkbenchAgentWriteMode = 'confirm' | 'auto';

export interface WorkbenchQuestionAgentStep {
  title: string;
  detail: string;
  status: 'completed' | 'failed';
}

export interface WorkbenchQuestionAgentTraceEvent {
  id: string;
  type: 'model-response' | 'tool-call' | 'tool-result' | 'tool-error';
  title: string;
  detail: string;
  status: 'completed' | 'failed';
  at: number;
  durationMs?: number;
  toolName?: string;
}

export interface WorkbenchQuestionCreateNoteProposal {
  id: string;
  type: 'create-note';
  title: string;
  content: string;
  reason: string;
}

export interface WorkbenchQuestionUpdateNoteProposal {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type WorkbenchQuestionAgentWriteProposal =
  | WorkbenchQuestionCreateNoteProposal
  | WorkbenchQuestionUpdateNoteProposal;

export interface WorkbenchQuestionExecutedCreateNote {
  id: string;
  type: 'create-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export interface WorkbenchQuestionExecutedUpdateNote {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type WorkbenchQuestionAgentExecutedWrite =
  | WorkbenchQuestionExecutedCreateNote
  | WorkbenchQuestionExecutedUpdateNote;

export const WORKBENCH_RECOMMENDATION_FEEDBACK_ACTIONS = {
  OPENED: 'opened',
  SNOOZED: 'snoozed',
  DISMISSED: 'dismissed',
} as const satisfies Record<string, string>;

export type WorkbenchRecommendationFeedbackAction =
  typeof WORKBENCH_RECOMMENDATION_FEEDBACK_ACTIONS[keyof typeof WORKBENCH_RECOMMENDATION_FEEDBACK_ACTIONS];

export interface WorkbenchRecommendationFeedbackEntry {
  noteId: string;
  reasonType: string;
  action: WorkbenchRecommendationFeedbackAction;
  count: number;
  lastAt: number;
}

export interface WorkbenchSettings {
  recentQuestions: WorkbenchQuestionEntry[];
  conversationThreads: WorkbenchConversationThread[];
  recommendationFeedback: WorkbenchRecommendationFeedbackEntry[];
  onboardingGuideActivated: boolean;
  onboardingGuideDismissed: boolean;
  agentWriteMode: WorkbenchAgentWriteMode;
}

export interface WorkbenchConversationThread {
  id: string;
  questions: WorkbenchQuestionEntry[];
  summary?: string;
  summaryUpToQuestionId?: string;
  updatedAt: number;
}

export interface WorkbenchModuleDefinition {
  id: WorkbenchModuleId;
  labelKey: string;
  layoutClass: string;
}

export const WORKBENCH_LIMITS = {
  QUESTIONS: 10,
  CONVERSATION_THREADS: 30,
  CONVERSATION_TURNS: 12,
  RECENT_ACTIVITY: 4,
  RECOMMENDATION_FEEDBACK: 80,
} as const;

const WORKBENCH_RECOMMENDATION_FEEDBACK_ACTION_VALUES = new Set<string>(
  Object.values(WORKBENCH_RECOMMENDATION_FEEDBACK_ACTIONS),
);

export const WORKBENCH_MODULE_DEFINITIONS: WorkbenchModuleDefinition[] = [
  {
    id: 'smartRecommendation',
    labelKey: 'workbench.module.smartRecommendation',
    layoutClass: 'workbench-card--hero',
  },
  {
    id: 'recentActivity',
    labelKey: 'workbench.module.recentActivity',
    layoutClass: 'workbench-card--list',
  },
  {
    id: 'recentQuestions',
    labelKey: 'workbench.module.recentQuestions',
    layoutClass: 'workbench-card--list',
  },
];

function sanitizeQuestionMode(value: unknown): WorkbenchQuestionMode | undefined {
  return value === 'agent-task' ? 'agent-task' : value === 'ask' ? 'ask' : undefined;
}

function sanitizeAgentWriteMode(value: unknown): WorkbenchAgentWriteMode {
  return value === 'auto' ? 'auto' : 'confirm';
}

function sanitizeAgentStepStatus(value: unknown): WorkbenchQuestionAgentStep['status'] {
  return value === 'failed' ? 'failed' : 'completed';
}

function sanitizeAgentSteps(value: unknown): WorkbenchQuestionAgentStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((step) => {
      const normalized = (step ?? {}) as Partial<WorkbenchQuestionAgentStep>;
      return {
        title: String(normalized.title ?? '').trim(),
        detail: String(normalized.detail ?? '').trim(),
        status: sanitizeAgentStepStatus(normalized.status),
      };
    })
    .filter((step) => step.title.length > 0)
    .slice(0, 24);
}

function sanitizeAgentTraceEventType(value: unknown): WorkbenchQuestionAgentTraceEvent['type'] {
  if (
    value === 'model-response'
    || value === 'tool-call'
    || value === 'tool-result'
    || value === 'tool-error'
  ) {
    return value;
  }

  return 'tool-result';
}

function sanitizeAgentTraceEvents(value: unknown): WorkbenchQuestionAgentTraceEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((event, index) => {
      const normalized = (event ?? {}) as Partial<WorkbenchQuestionAgentTraceEvent>;
      const at = Number(normalized.at ?? 0);
      const durationMs = Number(normalized.durationMs ?? 0);
      return {
        id: String(normalized.id ?? `trace-${index}`).trim(),
        type: sanitizeAgentTraceEventType(normalized.type),
        title: String(normalized.title ?? '').trim(),
        detail: String(normalized.detail ?? '').trim().slice(0, 1200),
        status: sanitizeAgentStepStatus(normalized.status),
        at: Number.isFinite(at) && at > 0 ? at : Date.now(),
        durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : undefined,
        toolName: String(normalized.toolName ?? '').trim() || undefined,
      };
    })
    .filter((event) => event.id.length > 0 && event.title.length > 0)
    .slice(0, 80);
}

function sanitizeAgentWriteProposals(value: unknown): WorkbenchQuestionAgentWriteProposal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((proposal) => {
      const normalized = (proposal ?? {}) as Partial<WorkbenchQuestionAgentWriteProposal>;
      const id = String(normalized.id ?? '').trim();
      const content = String(normalized.content ?? '').trim().slice(0, 16000);
      const reason = String(normalized.reason ?? '').trim().slice(0, 500);

      if (normalized.type === 'create-note') {
        return {
          id,
          type: 'create-note',
          title: String(normalized.title ?? '').trim().slice(0, 120),
          content,
          reason,
        } satisfies WorkbenchQuestionCreateNoteProposal;
      }

      if (normalized.type === 'update-note') {
        return {
          id,
          type: 'update-note',
          noteId: String(normalized.noteId ?? '').trim(),
          noteTitle: String(normalized.noteTitle ?? '').trim().slice(0, 120),
          content,
          reason,
        } satisfies WorkbenchQuestionUpdateNoteProposal;
      }

      return null;
    })
    .filter((proposal): proposal is WorkbenchQuestionAgentWriteProposal => {
      if (!proposal || !proposal.id || !proposal.content || !proposal.reason) {
        return false;
      }

      if (proposal.type === 'create-note') {
        return proposal.title.length > 0;
      }

      return proposal.noteId.length > 0 && proposal.noteTitle.length > 0;
    })
    .slice(0, 8);
}

function sanitizeExecutedWrites(value: unknown): WorkbenchQuestionAgentExecutedWrite[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((write) => {
      const normalized = (write ?? {}) as Partial<WorkbenchQuestionAgentExecutedWrite>;
      const id = String(normalized.id ?? '').trim();
      const noteId = String(normalized.noteId ?? '').trim();
      const noteTitle = String(normalized.noteTitle ?? '').trim().slice(0, 120);
      const content = String(normalized.content ?? '').trim().slice(0, 16000);
      const reason = String(normalized.reason ?? '').trim().slice(0, 500);

      if (normalized.type === 'create-note') {
        return {
          id,
          type: 'create-note',
          noteId,
          noteTitle,
          content,
          reason,
        } satisfies WorkbenchQuestionExecutedCreateNote;
      }

      if (normalized.type === 'update-note') {
        return {
          id,
          type: 'update-note',
          noteId,
          noteTitle,
          content,
          reason,
        } satisfies WorkbenchQuestionExecutedUpdateNote;
      }

      return null;
    })
    .filter((write): write is WorkbenchQuestionAgentExecutedWrite => {
      return Boolean(
        write
        && write.id
        && write.noteId
        && write.noteTitle
        && write.content
        && write.reason,
      );
    })
    .slice(0, 8);
}

function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((id) => String(id ?? '').trim())
    .filter((id, index, items) => id.length > 0 && items.indexOf(id) === index)
    .slice(0, 20);
}

function sanitizeRecentQuestions(value: unknown, limit: number = WORKBENCH_LIMITS.QUESTIONS): WorkbenchQuestionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const normalized = (entry ?? {}) as Partial<WorkbenchQuestionEntry>;
      const sourceNoteIds = Array.isArray(normalized.sourceNoteIds)
        ? normalized.sourceNoteIds
            .map((noteId) => String(noteId ?? '').trim())
            .filter((noteId, index, items) => noteId.length > 0 && items.indexOf(noteId) === index)
        : [];
      const sources = Array.isArray(normalized.sources)
        ? normalized.sources
            .map((source) => {
              const normalizedSource = (source ?? {}) as Partial<WorkbenchQuestionSource>;
              return {
                noteId: String(normalizedSource.noteId ?? '').trim(),
                noteTitle: String(normalizedSource.noteTitle ?? '').trim(),
              };
            })
            .filter((source) => source.noteId.length > 0)
        : [];
      const answeredAt = Number(normalized.answeredAt ?? 0);

      return {
        id: String(normalized.id ?? '').trim(),
        threadId: String(normalized.threadId ?? normalized.id ?? '').trim(),
        mode: sanitizeQuestionMode(normalized.mode),
        agentWriteMode: sanitizeAgentWriteMode(normalized.agentWriteMode),
        query: String(normalized.query ?? '').trim(),
        askedAt: Number(normalized.askedAt ?? 0),
        answeredAt: Number.isFinite(answeredAt) && answeredAt > 0 ? answeredAt : undefined,
        answer: String(normalized.answer ?? '').trim(),
        fullAnswer: String(normalized.fullAnswer ?? '').trim() || undefined,
        sourceNoteIds,
        sources,
        agentSteps: sanitizeAgentSteps(normalized.agentSteps),
        agentTraceEvents: sanitizeAgentTraceEvents(normalized.agentTraceEvents),
        pendingWrites: sanitizeAgentWriteProposals(normalized.pendingWrites),
        executedWrites: sanitizeExecutedWrites(normalized.executedWrites),
        dismissedWriteIds: sanitizeIdList(normalized.dismissedWriteIds),
        createdWriteIds: sanitizeIdList(normalized.createdWriteIds),
      };
    })
    .filter((entry) => entry.id.length > 0 && entry.query.length > 0 && Number.isFinite(entry.askedAt))
    .sort((a, b) => b.askedAt - a.askedAt)
    .slice(0, limit);
}

function sanitizeConversationThreads(value: unknown, fallbackQuestions: WorkbenchQuestionEntry[]): WorkbenchConversationThread[] {
  const source = Array.isArray(value) ? value : Array.from(new Map(
    fallbackQuestions.map((question) => [question.threadId, {
      id: question.threadId,
      questions: fallbackQuestions.filter((entry) => entry.threadId === question.threadId),
      updatedAt: question.askedAt,
    }]),
  ).values());

  return source
    .map((thread) => {
      const normalized = (thread ?? {}) as Partial<WorkbenchConversationThread>;
      const questions = sanitizeRecentQuestions(normalized.questions, WORKBENCH_LIMITS.CONVERSATION_TURNS);
      return {
        id: String(normalized.id ?? '').trim(),
        questions: questions.sort((left, right) => left.askedAt - right.askedAt),
        summary: String(normalized.summary ?? '').trim().slice(0, 2400) || undefined,
        summaryUpToQuestionId: String(normalized.summaryUpToQuestionId ?? '').trim() || undefined,
        updatedAt: Number(normalized.updatedAt ?? questions[questions.length - 1]?.askedAt ?? 0),
      };
    })
    .filter((thread) => thread.id.length > 0 && thread.questions.length > 0 && Number.isFinite(thread.updatedAt))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, WORKBENCH_LIMITS.CONVERSATION_THREADS);
}

function sanitizeRecommendationFeedbackAction(value: unknown): WorkbenchRecommendationFeedbackAction | null {
  const action = String(value ?? '').trim();
  if (!WORKBENCH_RECOMMENDATION_FEEDBACK_ACTION_VALUES.has(action)) {
    return null;
  }

  return action as WorkbenchRecommendationFeedbackAction;
}

function sanitizeRecommendationFeedback(value: unknown): WorkbenchRecommendationFeedbackEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entryMap = new Map<string, WorkbenchRecommendationFeedbackEntry>();

  for (const entry of value) {
    const normalized = (entry ?? {}) as Partial<WorkbenchRecommendationFeedbackEntry>;
    const noteId = String(normalized.noteId ?? '').trim();
    const reasonType = String(normalized.reasonType ?? '').trim();
    const action = sanitizeRecommendationFeedbackAction(normalized.action);
    const count = Math.max(1, Math.min(999, Math.round(Number(normalized.count ?? 1))));
    const lastAt = Number(normalized.lastAt ?? 0);

    if (!noteId || !reasonType || !action || !Number.isFinite(lastAt)) {
      continue;
    }

    const key = `${noteId}:${reasonType}:${action}`;
    const existing = entryMap.get(key);
    entryMap.set(key, {
      noteId,
      reasonType,
      action,
      count: Math.min(999, count + (existing?.count ?? 0)),
      lastAt: Math.max(lastAt, existing?.lastAt ?? 0),
    });
  }

  return [...entryMap.values()]
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, WORKBENCH_LIMITS.RECOMMENDATION_FEEDBACK);
}

export function createDefaultWorkbenchSettings(): WorkbenchSettings {
  return {
    recentQuestions: [],
    conversationThreads: [],
    recommendationFeedback: [],
    onboardingGuideActivated: false,
    onboardingGuideDismissed: false,
    agentWriteMode: 'confirm',
  };
}

export function sanitizeWorkbenchSettings(value?: Partial<WorkbenchSettings> | null): WorkbenchSettings {
  const base = createDefaultWorkbenchSettings();
  if (!value) {
    return base;
  }

  const recentQuestions = sanitizeRecentQuestions(value.recentQuestions);
  return {
    recentQuestions,
    conversationThreads: sanitizeConversationThreads(value.conversationThreads, recentQuestions),
    recommendationFeedback: sanitizeRecommendationFeedback(value.recommendationFeedback),
    onboardingGuideActivated: value.onboardingGuideActivated === true,
    onboardingGuideDismissed: value.onboardingGuideDismissed === true,
    agentWriteMode: sanitizeAgentWriteMode(value.agentWriteMode),
  };
}
