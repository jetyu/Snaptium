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

export interface WorkbenchSettings {
  recentQuestions: WorkbenchQuestionEntry[];
}

export interface WorkbenchModuleDefinition {
  id: WorkbenchModuleId;
  labelKey: string;
  layoutClass: string;
}

export const WORKBENCH_LIMITS = {
  QUESTIONS: 8,
  RECENT_ACTIVITY: 6,
} as const;

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

export function createDefaultWorkbenchSettings(): WorkbenchSettings {
  return {
    recentQuestions: [],
  };
}

export function sanitizeWorkbenchSettings(value?: Partial<WorkbenchSettings> | null): WorkbenchSettings {
  const base = createDefaultWorkbenchSettings();
  if (!value) {
    return base;
  }

  return {
    recentQuestions: sanitizeRecentQuestions(value.recentQuestions),
  };
}
