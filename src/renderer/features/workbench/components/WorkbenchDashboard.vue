<template>
  <div class="workbench-dashboard">
    <section class="workbench-hero">
      <div class="workbench-hero__copy">
        <h1>{{ t('workbench.title') }}</h1>
        <p>{{ t('workbench.subtitle') }}</p>

        <div class="workbench-hero__behavior" aria-label="writing behavior summary">
          <div class="hero-behavior-chip">
            <span class="hero-behavior-chip__label">{{ t('workbench.behavior.totalCharacters') }}</span>
            <strong>{{ formatNumber(behaviorFeedback.totalCharacters) }}</strong>
          </div>
          <div class="hero-behavior-chip">
            <span class="hero-behavior-chip__label">{{ t('workbench.behavior.totalNotes') }}</span>
            <strong>{{ formatNumber(behaviorFeedback.totalNotes) }}</strong>
          </div>
          <div class="hero-behavior-chip">
            <span class="hero-behavior-chip__label">{{ t('workbench.behavior.sevenDayCharacters') }}</span>
            <strong>{{ formatNumber(behaviorFeedback.sevenDayCharacters) }}</strong>
          </div>
          <div class="hero-behavior-chip">
            <span class="hero-behavior-chip__label">{{ t('workbench.behavior.todayCharacters') }}</span>
            <strong>{{ formatNumber(behaviorFeedback.todayCharacters) }}</strong>
          </div>
          <div class="hero-behavior-chip">
            <span class="hero-behavior-chip__label">{{ t('workbench.behavior.streakDays') }}</span>
            <strong>{{ formatNumber(behaviorFeedback.streakDays) }}</strong>
          </div>
        </div>
      </div>

    </section>

    <section v-if="hasNotes && orderedModules.length > 0" class="workbench-grid">
      <article v-for="module in orderedModules" :key="module.id" class="workbench-card" :class="module.layoutClass">
        <header class="workbench-card__header">
          <h2>{{ t(module.labelKey) }}</h2>
        </header>

        <div v-if="module.id === 'smartRecommendation'" class="workbench-card__body">
          <div v-if="smartRecommendationsPreview.length > 0" class="recommendation-list">
            <button v-for="item in smartRecommendationsPreview" :key="item.note.id" type="button" class="recommendation-row"
              :title="item.note.title" @click="openNoteInWorkspace(item.note.id)">
              <span class="recommendation-row__main">
                <span class="recommendation-row__title">{{ item.note.title }}</span>
                <span class="recommendation-row__reason">{{ t(item.reasonKey) }}</span>
              </span>
              <span class="recommendation-row__time">{{ formatRelativeTime(item.note.updatedAt) }}</span>
            </button>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noNotesBody') }}
          </div>
        </div>

        <div v-else-if="module.id === 'recentActivity'" class="workbench-card__body">
          <div v-if="recentActivityPreview.length > 0" class="recommendation-list">
            <button v-for="entry in recentActivityPreview" :key="entry.id" type="button" class="recommendation-row"
              :title="getActivityTooltip(entry)"
              @click="handleActivityClick(entry)">
              <span class="recommendation-row__main">
                <span class="recommendation-row__title">{{ getActivityTitle(entry) }}</span>
                <span class="recommendation-row__reason">{{ getActivityReason(entry) }}</span>
              </span>
              <span class="recommendation-row__time">{{ formatRelativeTime(entry.timestamp) }}</span>
            </button>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noActivity') }}
          </div>
        </div>

        <div v-else-if="module.id === 'recentQuestions'" class="workbench-card__body">
          <div v-if="recentQuestionEntriesPreview.length > 0" class="recommendation-list">
            <button v-for="question in recentQuestionEntriesPreview" :key="question.id" type="button"
              class="recommendation-row" :title="question.query" @click="openGlobalSearch(question.query)">
              <span class="recommendation-row__main">
                <span class="recommendation-row__title">{{ question.query }}</span>
                <span class="recommendation-row__reason">
                  {{ question.answer || t('workbench.empty.noAnswer') }}
                </span>
              </span>
              <span class="recommendation-row__time">{{ formatRelativeTime(question.askedAt) }}</span>
            </button>
          </div>

          <div v-else-if="todoFallbackEntries.length > 0" class="recommendation-list">
            <button v-for="entry in todoFallbackEntries" :key="entry.id" type="button" class="recommendation-row"
              :title="entry.snippet" @click="openNoteInWorkspace(entry.noteId)">
              <span class="recommendation-row__main">
                <span class="recommendation-row__title">{{ entry.snippet }}</span>
                <span class="recommendation-row__reason">{{ entry.noteTitle }}</span>
              </span>
              <span class="recommendation-row__time">{{ formatRelativeTime(entry.updatedAt) }}</span>
            </button>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noQuestions') }}
          </div>
        </div>

      </article>
    </section>

    <section v-else-if="hasNotes" class="workbench-empty">
      <p>{{ t('workbench.empty.noData') }}</p>
    </section>

    <section v-else class="workbench-empty workbench-empty--large">
      <h2>{{ t('workbench.empty.noNotesTitle') }}</h2>
      <p>{{ t('workbench.empty.noNotesBody') }}</p>
      <button type="button" class="workbench-action workbench-action--primary" @click="handlePrimaryAction">
        {{ t('contextMenu.newNote') }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useSearch } from '@renderer/features/search';
import { useWorkspace, type Note } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkbenchStore } from '@renderer/features/workbench';
import {
  useLocalSmartRecommendations,
} from '../composables/useLocalSmartRecommendations';
import {
  WORKBENCH_LIMITS,
  WORKBENCH_MODULE_DEFINITIONS,
  type WorkbenchModuleDefinition,
  type WorkbenchQuestionEntry,
} from '../constants/workbench.constants';

interface ActivityEntry {
  id: string;
  kind: 'saved' | 'questioned';
  timestamp: number;
  note?: Note;
  question?: WorkbenchQuestionEntry;
}

interface TodoFallbackEntry {
  id: string;
  noteId: string;
  noteTitle: string;
  snippet: string;
  updatedAt: number;
}

const WORKBENCH_DISPLAY_LIMITS = {
  RECENT_ACTIVITY: 4,
  RECENT_QUESTIONS: 3,
} as const;

const { t } = useI18n();
const { openGlobalSearch } = useSearch();
const { notes, createNote, selectNote } = useWorkspace();
const appShellStore = useAppShellStore();
const workbenchStore = useWorkbenchStore();
const { recentQuestions } = storeToRefs(workbenchStore);

const hasNotes = computed(() => notes.value.length > 0);
const noteMap = computed(() => {
  return new Map(notes.value.map((note) => [note.id, note]));
});
const sortedNotesByUpdated = computed(() => {
  return [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt);
});
const recentQuestionEntries = computed(() => recentQuestions.value);
const recentQuestionEntriesPreview = computed(() => {
  return recentQuestionEntries.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_QUESTIONS);
});
const moduleMap = computed(() => {
  return new Map(WORKBENCH_MODULE_DEFINITIONS.map((module) => [module.id, module]));
});
const orderedModules = computed<WorkbenchModuleDefinition[]>(() => {
  return WORKBENCH_MODULE_DEFINITIONS
    .map((module) => moduleMap.value.get(module.id))
    .filter((module): module is WorkbenchModuleDefinition => Boolean(module));
});
const { smartRecommendations } = useLocalSmartRecommendations({
  notes: sortedNotesByUpdated,
});

const behaviorFeedback = computed(() => {
  const now = Date.now();
  const todayStart = getDayStartTimestamp(now);
  const sevenDayThreshold = todayStart - (6 * 24 * 60 * 60 * 1000);
  const activeDays = new Set(notes.value.map((note) => getLocalDateKey(note.updatedAt)));

  let streakDays = 0;
  let cursor = todayStart;
  while (activeDays.has(getLocalDateKey(cursor))) {
    streakDays += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }

  return {
    totalCharacters: notes.value.reduce((total, note) => total + getCharacterCount(note.content), 0),
    totalNotes: notes.value.length,
    sevenDayCharacters: notes.value
      .filter((note) => note.updatedAt >= sevenDayThreshold)
      .reduce((total, note) => total + getCharacterCount(note.content), 0),
    todayCharacters: notes.value
      .filter((note) => note.updatedAt >= todayStart)
      .reduce((total, note) => total + getCharacterCount(note.content), 0),
    streakDays,
  };
});

const recentActivity = computed<ActivityEntry[]>(() => {
  const savedActivities = sortedNotesByUpdated.value.slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY).map((note) => {
    return {
      id: `saved:${note.id}:${note.updatedAt}`,
      kind: 'saved' as const,
      timestamp: note.updatedAt,
      note,
    };
  });

  const questionedActivities = recentQuestionEntries.value.slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY).map((entry) => {
    return {
      id: `questioned:${entry.id}`,
      kind: 'questioned' as const,
      timestamp: entry.askedAt,
      question: entry,
      note: entry.sourceNoteIds.length > 0 ? noteMap.value.get(entry.sourceNoteIds[0]) : undefined,
    };
  });

  return [...savedActivities, ...questionedActivities]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY);
});
const recentActivityPreview = computed(() => {
  return recentActivity.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_ACTIVITY);
});

const smartRecommendationExcludedNoteIds = computed(() => {
  const excludedNoteIds = new Set<string>();

  const topRecentActivityNoteId = recentActivityPreview.value[0]?.note?.id;
  if (topRecentActivityNoteId) {
    excludedNoteIds.add(topRecentActivityNoteId);
  }

  const topQuestionSourceNoteId = recentQuestionEntriesPreview.value[0]?.sourceNoteIds[0];
  if (topQuestionSourceNoteId) {
    excludedNoteIds.add(topQuestionSourceNoteId);
  }

  return excludedNoteIds;
});

const smartRecommendationsPreview = computed(() => {
  const filteredRecommendations = smartRecommendations.value.filter((item) => {
    return !smartRecommendationExcludedNoteIds.value.has(item.note.id);
  });

  return filteredRecommendations.length > 0 ? filteredRecommendations : smartRecommendations.value;
});

const TODO_TASK_REGEX = /^[-*+]\s+\[\s\]\s+(.+)$/;
const TODO_MARKER_REGEX = /(?:^|\s)(?:TODO|TBD|FIXME)\b:?\s*(.+)?$/i;
const CODE_FENCE_REGEX = /^\s*(?:```|~~~)/;

function normalizeTodoSnippet(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function extractTodoSnippet(content: string): string | null {
  const lines = content.split('\n');
  let inCodeFence = false;

  for (const line of lines) {
    if (CODE_FENCE_REGEX.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const normalizedLine = line.replace(/`[^`]*`/g, ' ').trim();
    if (!normalizedLine) {
      continue;
    }

    const taskMatch = normalizedLine.match(TODO_TASK_REGEX);
    if (taskMatch?.[1]) {
      const snippet = normalizeTodoSnippet(taskMatch[1]);
      if (snippet) {
        return snippet;
      }
    }

    const markerMatch = normalizedLine.match(TODO_MARKER_REGEX);
    if (markerMatch) {
      const snippet = normalizeTodoSnippet(markerMatch[1] ?? normalizedLine);
      if (snippet) {
        return snippet;
      }
    }
  }

  return null;
}

const todoFallbackEntries = computed<TodoFallbackEntry[]>(() => {
  return sortedNotesByUpdated.value
    .map((note) => {
      const snippet = extractTodoSnippet(note.content);
      if (!snippet) {
        return null;
      }

      return {
        id: `todo:${note.id}`,
        noteId: note.id,
        noteTitle: note.title,
        snippet,
        updatedAt: note.updatedAt,
      };
    })
    .filter((entry): entry is TodoFallbackEntry => entry !== null)
    .slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_QUESTIONS);
});

async function createFirstNote() {
  await createNote(null);
  await appShellStore.setActiveMainView('workspace');
}

async function openNoteInWorkspace(noteId: string) {
  selectNote(noteId);
  await appShellStore.setActiveMainView('workspace');
}

async function handlePrimaryAction() {
  if (!hasNotes.value) {
    await createFirstNote();
    return;
  }

  const primaryNote = smartRecommendationsPreview.value[0]?.note ?? sortedNotesByUpdated.value[0] ?? null;
  if (primaryNote) {
    await openNoteInWorkspace(primaryNote.id);
  }
}

function getCharacterCount(content: string) {
  return content.replace(/\s+/g, '').length;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function getDayStartTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getLocalDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRelativeTime(timestamp: number) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 300) {
    return t('workbench.time.justNow');
  }

  if (diffSeconds < 3600) {
    return t('workbench.time.minutesAgo', { count: Math.floor(diffSeconds / 60) });
  }

  if (diffSeconds < 86400) {
    return t('workbench.time.hoursAgo', { count: Math.floor(diffSeconds / 3600) });
  }

  return t('workbench.time.daysAgo', { count: Math.floor(diffSeconds / 86400) });
}

function getActivityTitle(entry: ActivityEntry) {
  if (entry.kind === 'questioned') {
    return entry.question?.query ?? t('workbench.empty.noData');
  }

  return entry.note?.title ?? t('workbench.empty.noData');
}

function getActivityReason(entry: ActivityEntry) {
  if (entry.kind === 'questioned') {
    return t('workbench.activity.questioned');
  }

  return t('workbench.activity.saved');
}

function getActivityTooltip(entry: ActivityEntry) {
  return `${getActivityTitle(entry)} / ${getActivityReason(entry)}`;
}

async function handleActivityClick(entry: ActivityEntry) {
  if (entry.kind === 'questioned' && entry.question) {
    openGlobalSearch(entry.question.query);
    return;
  }

  if (entry.note) {
    await openNoteInWorkspace(entry.note.id);
  }
}

watch(
  () => notes.value.map((note) => note.id).sort().join('|'),
  () => {
    void workbenchStore.cleanupNoteReferences(notes.value.map((note) => note.id));
  },
  { immediate: true },
);
</script>

<style scoped>
.workbench-dashboard {
  flex: 1;
  min-height: 0;
  padding: 20px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 12%, transparent), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 84%, white), var(--bg));
  overflow-y: auto;
}

.workbench-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--panel-border));
  border-radius: 20px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, white) 0%, color-mix(in srgb, var(--panel) 92%, white) 46%, var(--panel) 100%);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.workbench-hero__copy {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.workbench-hero h1 {
  margin: 0;
  font-size: clamp(1.45rem, 1.7vw, 1.95rem);
  line-height: 1.05;
  color: var(--text);
}

.workbench-hero p {
  max-width: 620px;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
  font-size: 0.9rem;
}


.workbench-hero__behavior {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.workbench-hero__behavior::-webkit-scrollbar {
  display: none;
}

.hero-behavior-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  min-width: fit-content;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel) 90%, white);
  white-space: nowrap;
}

.hero-behavior-chip__label {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1;
}

.hero-behavior-chip strong {
  font-size: 0.84rem;
  line-height: 1;
  color: var(--text);
}

.workbench-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 90%, white);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.workbench-action:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 26%, var(--panel-border));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.workbench-action--primary {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--panel-border));
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: #fff;
}

.workbench-grid {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
}

.workbench-card {
  display: flex;
  flex-direction: column;
  flex: 1 1 320px;
  min-height: 200px;
  min-width: min(100%, 280px);
  max-width: 100%;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 90%, white);
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel) 94%, white);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
}

.workbench-card--hero {
  flex: 2 1 520px;
}

.workbench-card--list {
  flex: 1 1 320px;
}

.workbench-card--compact {
  flex: 1 1 420px;
}

.workbench-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.workbench-card__header h2 {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--text);
}

.workbench-card__body {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.recommendation-list {
  width: 100%;
  display: grid;
  gap: 8px;
  align-content: start;
}

.recommendation-row {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 90%, white);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.recommendation-row:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 20%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 5%, var(--panel));
}

.recommendation-row__main {
  min-width: 0;
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: 10px;
  overflow: hidden;
}

.recommendation-row__title {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommendation-row__reason {
  flex: 0 1 52%;
  max-width: 52%;
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommendation-row__time {
  color: var(--text-muted);
  font-size: 0.76rem;
  white-space: nowrap;
}

.note-list-card,
.activity-list,
.question-list {
  width: 100%;
  display: grid;
  gap: 8px;
  align-content: start;
}

.note-list-row,
.activity-row,
.question-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 90%, white);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.note-list-row:hover,
.activity-row:hover,
.question-row:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 20%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 5%, var(--panel));
}

.note-list-row__copy,
.activity-row__copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.note-list-row__title,
.activity-row__title {
  color: var(--text);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-list-row__meta,
.activity-row__meta {
  color: var(--text-muted);
  font-size: 0.76rem;
  text-align: left;
}

.question-row {
  flex-direction: column;
  align-items: flex-start;
}

.question-row__query {
  font-weight: 600;
  color: var(--text);
  text-align: left;
}

.question-row__answer {
  color: var(--text-muted);
  line-height: 1.5;
  font-size: 0.84rem;
  text-align: left;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.note-icon-button {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-hover) 92%, white);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.note-icon-button:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, #f59e0b 12%, var(--panel));
  color: #d97706;
}

.note-icon-button.is-active {
  background: color-mix(in srgb, #f59e0b 14%, var(--panel));
  color: #d97706;
}

.metric-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  align-content: start;
}

.metric-grid--behavior {
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 8px;
}

.metric-tile {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, white);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel) 90%, white);
}

.metric-tile--full {
  grid-column: span 2;
}

.metric-tile__label {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.metric-tile strong {
  font-size: 1.06rem;
  color: var(--text);
}

.metric-grid--behavior .metric-tile {
  gap: 4px;
  padding: 10px 8px;
}

.metric-grid--behavior .metric-tile__label {
  font-size: 0.72rem;
  line-height: 1.35;
}

.metric-grid--behavior .metric-tile strong {
  font-size: 0.96rem;
  line-height: 1.05;
}

.module-empty,
.workbench-empty {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
  line-height: 1.7;
}

.workbench-empty {
  min-height: 280px;
  margin-top: 20px;
  padding: 28px;
  border: 1px dashed color-mix(in srgb, var(--accent) 20%, var(--panel-border));
  border-radius: 22px;
  background: color-mix(in srgb, var(--panel) 84%, white);
}

.workbench-empty--large {
  flex-direction: column;
  gap: 14px;
}

.workbench-empty--large h2,
.workbench-empty--large p {
  margin: 0;
}

@media (max-width: 860px) {
  .workbench-dashboard {
    padding: 18px;
  }

  .workbench-hero {
    grid-template-columns: 1fr;
    padding: 16px;
  }

}

@media (max-width: 620px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-grid--behavior {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-tile--full {
    grid-column: auto;
  }

  .recommendation-row {
    min-height: 40px;
    padding: 0 10px;
  }

  .recommendation-row__main {
    gap: 8px;
  }

  .recommendation-row__reason {
    max-width: 48%;
  }
}
</style>
