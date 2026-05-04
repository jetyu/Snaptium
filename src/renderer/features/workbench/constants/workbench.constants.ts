export const WORKBENCH_MODULE_IDS = [
  'recentNotes',
  'favorites',
  'recentActivity',
  'recentQuestions',
  'smartRecommendation',
  'relatedNotes',
] as const;

export type WorkbenchModuleId = (typeof WORKBENCH_MODULE_IDS)[number];

export interface WorkbenchRecentNoteEntry {
  noteId: string;
  openedAt: number;
}

export interface WorkbenchQuestionEntry {
  id: string;
  query: string;
  askedAt: number;
  answer: string;
  sourceNoteIds: string[];
}

export interface WorkbenchSettings {
  visibleModuleIds: WorkbenchModuleId[];
  recentNotes: WorkbenchRecentNoteEntry[];
  recentQuestions: WorkbenchQuestionEntry[];
}

export interface WorkbenchModuleDefinition {
  id: WorkbenchModuleId;
  labelKey: string;
  layoutClass: string;
}

export const WORKBENCH_LIMITS = {
  QUESTIONS: 8,
  RECENT_NOTES: 8,
  RELATED_NOTES: 3,
  RECENT_ACTIVITY: 6,
} as const;

export const WORKBENCH_MODULE_DEFINITIONS: WorkbenchModuleDefinition[] = [
  {
    id: 'smartRecommendation',
    labelKey: 'workbench.module.smartRecommendation',
    layoutClass: 'workbench-card--hero',
  },
  {
    id: 'recentNotes',
    labelKey: 'workbench.module.recentNotes',
    layoutClass: 'workbench-card--list',
  },
  {
    id: 'favorites',
    labelKey: 'workbench.module.favorites',
    layoutClass: 'workbench-card--list',
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
  {
    id: 'relatedNotes',
    labelKey: 'workbench.module.relatedNotes',
    layoutClass: 'workbench-card--list',
  },
];

export const DEFAULT_WORKBENCH_VISIBLE_MODULES: WorkbenchModuleId[] = [
  'smartRecommendation',
  'recentNotes',
  'favorites',
  'recentActivity',
  'recentQuestions',
  'relatedNotes',
];

export function isWorkbenchModuleId(value: unknown): value is WorkbenchModuleId {
  return typeof value === 'string' && WORKBENCH_MODULE_IDS.includes(value as WorkbenchModuleId);
}

export function sanitizeWorkbenchModuleIds(value: unknown): WorkbenchModuleId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_WORKBENCH_VISIBLE_MODULES];
  }

  const uniqueIds = value.filter((moduleId, index, items) => {
    return isWorkbenchModuleId(moduleId) && items.indexOf(moduleId) === index;
  }) as WorkbenchModuleId[];

  return uniqueIds.length > 0 ? uniqueIds : [...DEFAULT_WORKBENCH_VISIBLE_MODULES];
}

function sanitizeRecentNotes(value: unknown): WorkbenchRecentNoteEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const normalized = (entry ?? {}) as Partial<WorkbenchRecentNoteEntry>;
      return {
        noteId: String(normalized.noteId ?? '').trim(),
        openedAt: Number(normalized.openedAt ?? 0),
      };
    })
    .filter((entry, index, items) => {
      return entry.noteId.length > 0
        && Number.isFinite(entry.openedAt)
        && items.findIndex((candidate) => candidate.noteId === entry.noteId) === index;
    })
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, WORKBENCH_LIMITS.RECENT_NOTES);
}

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
    visibleModuleIds: [...DEFAULT_WORKBENCH_VISIBLE_MODULES],
    recentNotes: [],
    recentQuestions: [],
  };
}

export function sanitizeWorkbenchSettings(value?: Partial<WorkbenchSettings> | null): WorkbenchSettings {
  const base = createDefaultWorkbenchSettings();
  if (!value) {
    return base;
  }

  return {
    visibleModuleIds: sanitizeWorkbenchModuleIds(value.visibleModuleIds),
    recentNotes: sanitizeRecentNotes(value.recentNotes),
    recentQuestions: sanitizeRecentQuestions(value.recentQuestions),
  };
}
