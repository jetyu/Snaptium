export const WORKBENCH_MODULE_IDS = [
  'recentActivity',
  'recentQuestions',
  'smartRecommendation',
] as const;

export type WorkbenchModuleId = (typeof WORKBENCH_MODULE_IDS)[number];

export interface WorkbenchQuestionEntry {
  id: string;
  query: string;
  askedAt: number;
  answer: string;
  sourceNoteIds: string[];
}

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
  recommendationFeedback: WorkbenchRecommendationFeedbackEntry[];
}

export interface WorkbenchModuleDefinition {
  id: WorkbenchModuleId;
  labelKey: string;
  layoutClass: string;
}

export const WORKBENCH_LIMITS = {
  QUESTIONS: 8,
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

function sanitizeRecentQuestions(value: unknown): WorkbenchQuestionEntry[] {
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

      return {
        id: String(normalized.id ?? '').trim(),
        query: String(normalized.query ?? '').trim(),
        askedAt: Number(normalized.askedAt ?? 0),
        answer: String(normalized.answer ?? '').trim(),
        sourceNoteIds,
      };
    })
    .filter((entry) => entry.id.length > 0 && entry.query.length > 0 && Number.isFinite(entry.askedAt))
    .sort((a, b) => b.askedAt - a.askedAt)
    .slice(0, WORKBENCH_LIMITS.QUESTIONS);
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
    recommendationFeedback: [],
  };
}

export function sanitizeWorkbenchSettings(value?: Partial<WorkbenchSettings> | null): WorkbenchSettings {
  const base = createDefaultWorkbenchSettings();
  if (!value) {
    return base;
  }

  return {
    recentQuestions: sanitizeRecentQuestions(value.recentQuestions),
    recommendationFeedback: sanitizeRecommendationFeedback(value.recommendationFeedback),
  };
}
