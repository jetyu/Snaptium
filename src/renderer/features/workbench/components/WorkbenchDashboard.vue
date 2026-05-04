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

      <div class="workbench-hero__actions">
        <div class="workbench-config-shell">
          <button ref="configButtonRef" type="button" class="workbench-action workbench-action--icon"
            :title="t('workbench.action.configure')" :aria-label="t('workbench.action.configure')"
            @click="toggleConfigPanel">
            <Tool theme="outline" :size="16" />
          </button>

          <Transition name="workbench-config">
            <div v-if="isConfigOpen" ref="configPanelRef" class="workbench-config-panel">
              <WorkbenchConfig :module-definitions="moduleDefinitions" :visible-module-ids="visibleModuleIds"
                @toggle-module="handleToggleModule" @close="isConfigOpen = false" />
            </div>
          </Transition>
        </div>
      </div>
    </section>

    <section v-if="hasNotes && orderedModules.length > 0" class="workbench-grid">
      <article v-for="module in orderedModules" :key="module.id" class="workbench-card" :class="module.layoutClass">
        <header class="workbench-card__header">
          <h2>{{ t(module.labelKey) }}</h2>
        </header>

        <div v-if="module.id === 'smartRecommendation'" class="workbench-card__body">
          <div v-if="featuredNote" class="featured-note">
            <div class="featured-note__content">
              <button type="button" class="featured-note__title" @click="openNoteInWorkspace(featuredNote.id)">
                {{ featuredNote.title }}
              </button>
              <p>{{ getNotePreview(featuredNote.content) }}</p>
              <div class="featured-note__meta">
                <span>{{ formatRelativeTime(featuredNote.updatedAt) }}</span>
                <span>{{ formatNumber(getCharacterCount(featuredNote.content)) }}</span>
              </div>
            </div>

            <div class="featured-note__actions">
              <button type="button" class="note-action-pill" @click="openNoteInWorkspace(featuredNote.id)">
                {{ t('workbench.action.continueWriting') }}
              </button>
              <button type="button" class="note-icon-button" :class="{ 'is-active': isFavorite(featuredNote.id) }"
                :aria-label="t('workbench.module.favorites')" @click.stop="handleToggleFavorite(featuredNote.id)">
                <Star :theme="isFavorite(featuredNote.id) ? 'filled' : 'outline'" :size="16" />
              </button>
            </div>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noNotesBody') }}
          </div>
        </div>

        <div v-else-if="module.id === 'recentNotes'" class="workbench-card__body">
          <div v-if="recentOpenedNotesPreview.length > 0" class="note-list-card">
            <div v-for="entry in recentOpenedNotesPreview" :key="entry.note.id" class="note-list-row" role="button"
              tabindex="0" @click="openNoteInWorkspace(entry.note.id)"
              @keydown.enter.prevent="openNoteInWorkspace(entry.note.id)">
              <div class="note-list-row__copy">
                <span class="note-list-row__title">{{ entry.note.title }}</span>
                <span class="note-list-row__meta">{{ formatRelativeTime(entry.openedAt) }}</span>
              </div>
              <button type="button" class="note-icon-button" :class="{ 'is-active': isFavorite(entry.note.id) }"
                :aria-label="t('workbench.module.favorites')" @click.stop="handleToggleFavorite(entry.note.id)">
                <Star :theme="isFavorite(entry.note.id) ? 'filled' : 'outline'" :size="16" />
              </button>
            </div>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noRecentNotes') }}
          </div>
        </div>

        <div v-else-if="module.id === 'favorites'" class="workbench-card__body">
          <div v-if="favoriteNotesPreview.length > 0" class="note-list-card">
            <div v-for="note in favoriteNotesPreview" :key="note.id" class="note-list-row" role="button" tabindex="0"
              @click="openNoteInWorkspace(note.id)" @keydown.enter.prevent="openNoteInWorkspace(note.id)">
              <div class="note-list-row__copy">
                <span class="note-list-row__title">{{ note.title }}</span>
                <span class="note-list-row__meta">{{ formatRelativeTime(note.updatedAt) }}</span>
              </div>
              <button type="button" class="note-icon-button is-active" :aria-label="t('workbench.module.favorites')"
                @click.stop="handleToggleFavorite(note.id)">
                <Star theme="filled" :size="16" />
              </button>
            </div>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noFavorites') }}
          </div>
        </div>

        <div v-else-if="module.id === 'recentActivity'" class="workbench-card__body">
          <div v-if="recentActivityPreview.length > 0" class="activity-list">
            <button v-for="entry in recentActivityPreview" :key="entry.id" type="button" class="activity-row"
              @click="handleActivityClick(entry)">
              <div class="activity-row__copy">
                <span class="activity-row__title">{{ getActivityTitle(entry) }}</span>
                <span class="activity-row__meta">{{ formatRelativeTime(entry.timestamp) }}</span>
              </div>
              <Right theme="outline" :size="14" />
            </button>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noActivity') }}
          </div>
        </div>

        <div v-else-if="module.id === 'recentQuestions'" class="workbench-card__body">
          <div v-if="recentQuestionEntriesPreview.length > 0" class="question-list">
            <button v-for="question in recentQuestionEntriesPreview" :key="question.id" type="button"
              class="question-row" @click="openGlobalSearch(question.query)">
              <span class="question-row__query">{{ question.query }}</span>
              <span class="question-row__answer">
                {{ question.answer || t('workbench.empty.noAnswer') }}
              </span>
            </button>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noQuestions') }}
          </div>
        </div>

        <div v-else-if="module.id === 'relatedNotes'" class="workbench-card__body">
          <div v-if="relatedNotesPreview.length > 0" class="note-list-card">
            <div v-for="note in relatedNotesPreview" :key="note.id" class="note-list-row" role="button" tabindex="0"
              @click="openNoteInWorkspace(note.id)" @keydown.enter.prevent="openNoteInWorkspace(note.id)">
              <div class="note-list-row__copy">
                <span class="note-list-row__title">{{ note.title }}</span>
                <span class="note-list-row__meta">{{ formatRelativeTime(note.updatedAt) }}</span>
              </div>
              <button type="button" class="note-icon-button" :class="{ 'is-active': isFavorite(note.id) }"
                :aria-label="t('workbench.module.favorites')" @click.stop="handleToggleFavorite(note.id)">
                <Star :theme="isFavorite(note.id) ? 'filled' : 'outline'" :size="16" />
              </button>
            </div>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noRelatedNotes') }}
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Right, Tool, Star } from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import WorkbenchConfig from './WorkbenchConfig.vue';
import { useSearch } from '@renderer/features/search';
import { useWorkspace, type Note } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { useFavoritesStore } from '@renderer/features/favorites/store/favorites.store';
import { useRAGConfig, useRAGSearch } from '@renderer/features/rag';
import {
  WORKBENCH_LIMITS,
  WORKBENCH_MODULE_DEFINITIONS,
  type WorkbenchModuleDefinition,
  type WorkbenchModuleId,
  type WorkbenchQuestionEntry,
} from '../constants/workbench.constants';

interface RecentOpenedNoteEntry {
  note: Note;
  openedAt: number;
}

interface ActivityEntry {
  id: string;
  kind: 'saved' | 'opened' | 'questioned';
  timestamp: number;
  note?: Note;
  question?: WorkbenchQuestionEntry;
}

const WORKBENCH_DISPLAY_LIMITS = {
  FAVORITES: 4,
  RECENT_NOTES: 4,
  RELATED_NOTES: 3,
  RECENT_ACTIVITY: 4,
  RECENT_QUESTIONS: 3,
} as const;

const configButtonRef = ref<HTMLElement | null>(null);
const configPanelRef = ref<HTMLElement | null>(null);
const isConfigOpen = ref(false);
const relatedNotes = ref<Note[]>([]);

const { t } = useI18n();
const { openGlobalSearch } = useSearch();
const { notes, createNote, selectNote } = useWorkspace();
const appShellStore = useAppShellStore();
const workbenchStore = useWorkbenchStore();
const favoritesStore = useFavoritesStore();
const { search: ragSearch } = useRAGSearch();
const { isEnabled: ragEnabled, isConfigured: ragConfigured } = useRAGConfig();
const { visibleModuleIds, recentNotes, recentQuestions } = storeToRefs(workbenchStore);

const hasNotes = computed(() => notes.value.length > 0);
const noteMap = computed(() => {
  return new Map(notes.value.map((note) => [note.id, note]));
});
const sortedNotesByUpdated = computed(() => {
  return [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt);
});
const recentOpenedNotes = computed<RecentOpenedNoteEntry[]>(() => {
  return recentNotes.value
    .map((entry) => {
      const note = noteMap.value.get(entry.noteId);
      return note ? { note, openedAt: entry.openedAt } : null;
    })
    .filter((entry): entry is RecentOpenedNoteEntry => entry !== null);
});
const recentOpenedNotesPreview = computed(() => {
  return recentOpenedNotes.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_NOTES);
});
const favoriteNotes = computed(() => {
  return favoritesStore.sortedStarredNotes;
});
const favoriteNotesPreview = computed(() => {
  return favoriteNotes.value.slice(0, WORKBENCH_DISPLAY_LIMITS.FAVORITES);
});
const recentQuestionEntries = computed(() => recentQuestions.value);
const recentQuestionEntriesPreview = computed(() => {
  return recentQuestionEntries.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_QUESTIONS);
});
const moduleMap = computed(() => {
  return new Map(WORKBENCH_MODULE_DEFINITIONS.map((module) => [module.id, module]));
});
const moduleDefinitions = computed(() => WORKBENCH_MODULE_DEFINITIONS);
const orderedModules = computed<WorkbenchModuleDefinition[]>(() => {
  return visibleModuleIds.value
    .map((moduleId) => moduleMap.value.get(moduleId))
    .filter((module): module is WorkbenchModuleDefinition => Boolean(module));
});
const featuredNote = computed(() => {
  return recentOpenedNotes.value[0]?.note ?? sortedNotesByUpdated.value[0] ?? null;
});
const recommendationSeed = computed(() => {
  return featuredNote.value ?? null;
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

  const openedActivities = recentOpenedNotes.value.slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY).map((entry) => {
    return {
      id: `opened:${entry.note.id}:${entry.openedAt}`,
      kind: 'opened' as const,
      timestamp: entry.openedAt,
      note: entry.note,
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

  return [...savedActivities, ...openedActivities, ...questionedActivities]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY);
});
const recentActivityPreview = computed(() => {
  return recentActivity.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_ACTIVITY);
});
const relatedNotesPreview = computed(() => {
  return relatedNotes.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RELATED_NOTES);
});

const ragAvailable = computed(() => ragEnabled.value && ragConfigured.value);

async function createFirstNote() {
  await createNote(null);
  await appShellStore.setActiveMainView('workspace');
}

async function openNoteInWorkspace(noteId: string) {
  await workbenchStore.recordOpenedNote(noteId);
  selectNote(noteId);
  await appShellStore.setActiveMainView('workspace');
}

async function handlePrimaryAction() {
  if (!hasNotes.value) {
    await createFirstNote();
    return;
  }

  if (featuredNote.value) {
    await openNoteInWorkspace(featuredNote.value.id);
  }
}

function getNotePreview(content: string) {
  const firstMeaningfulLine = content
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine?.slice(0, 120) || t('workbench.empty.noContent');
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

function isFavorite(noteId: string) {
  return favoritesStore.isStarredNote(noteId);
}

async function handleToggleFavorite(noteId: string) {
  await favoritesStore.toggleStar(noteId, 'note', !isFavorite(noteId));
}

async function handleToggleModule(moduleId: WorkbenchModuleId) {
  await workbenchStore.toggleModule(moduleId);
}

function toggleConfigPanel() {
  isConfigOpen.value = !isConfigOpen.value;
}

function getActivityTitle(entry: ActivityEntry) {
  if (entry.kind === 'questioned') {
    return entry.question?.query ?? t('workbench.activity.questioned');
  }

  const noteTitle = entry.note?.title ?? t('workbench.empty.noData');
  const labelKey = entry.kind === 'opened'
    ? 'workbench.activity.opened'
    : 'workbench.activity.saved';

  return `${noteTitle} / ${t(labelKey)}`;
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

function buildSemanticQuery(note: Note) {
  const normalizedContent = note.content.replace(/\s+/g, ' ').trim();
  const excerpt = normalizedContent.slice(0, 260);
  return `${note.title}\n${excerpt}`.trim();
}

function buildFallbackRelatedNotes(seedNoteId?: string | null) {
  return sortedNotesByUpdated.value
    .filter((note) => note.id !== seedNoteId)
    .slice(0, WORKBENCH_LIMITS.RELATED_NOTES);
}

async function refreshRelatedNotes() {
  const seedNote = recommendationSeed.value;
  if (!seedNote) {
    relatedNotes.value = [];
    return;
  }

  if (!ragAvailable.value) {
    relatedNotes.value = buildFallbackRelatedNotes(seedNote.id);
    return;
  }

  try {
    const ragResults = await ragSearch(buildSemanticQuery(seedNote), 8);
    const seenNoteIds = new Set<string>([seedNote.id]);
    const nextRelatedNotes: Note[] = [];

    for (const result of ragResults) {
      const note = noteMap.value.get(result.chunk.noteId);
      if (!note || seenNoteIds.has(note.id)) {
        continue;
      }

      seenNoteIds.add(note.id);
      nextRelatedNotes.push(note);

      if (nextRelatedNotes.length >= WORKBENCH_LIMITS.RELATED_NOTES) {
        break;
      }
    }

    relatedNotes.value = nextRelatedNotes.length > 0
      ? nextRelatedNotes
      : buildFallbackRelatedNotes(seedNote.id);
  } catch {
    relatedNotes.value = buildFallbackRelatedNotes(seedNote.id);
  }
}

function handleDocumentPointerDown(event: Event) {
  if (!isConfigOpen.value) {
    return;
  }

  const target = event.target as Node | null;
  if (!target) {
    return;
  }

  if (configButtonRef.value?.contains(target) || configPanelRef.value?.contains(target)) {
    return;
  }

  isConfigOpen.value = false;
}

watch(
  () => notes.value.map((note) => note.id).sort().join('|'),
  () => {
    void workbenchStore.cleanupNoteReferences(notes.value.map((note) => note.id));
  },
  { immediate: true },
);

watch(
  [
    () => recommendationSeed.value ? `${recommendationSeed.value.id}:${recommendationSeed.value.updatedAt}` : '',
    ragAvailable,
    () => notes.value.length,
  ],
  () => {
    void refreshRelatedNotes();
  },
  { immediate: true },
);

onMounted(() => {
  void favoritesStore.initialize();
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
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

.workbench-hero__actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.workbench-config-shell {
  position: relative;
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

.workbench-action--icon {
  width: 40px;
  min-width: 40px;
  padding: 0;
}

.workbench-config-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(420px, calc(100vw - 40px));
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--panel-border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel) 95%, white);
  box-shadow: 0 22px 42px rgba(15, 23, 42, 0.12);
  z-index: 20;
}

.workbench-config-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.workbench-config-panel__header strong {
  font-size: 0.92rem;
}

.workbench-config-panel__close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.workbench-config-panel__close:hover {
  background: var(--panel-hover);
  color: var(--text);
}

.workbench-config-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.workbench-config-chip {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.workbench-config-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border));
}

.workbench-config-chip.is-active {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  color: var(--text);
}

.workbench-config-chip__order {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, var(--panel));
  color: var(--accent-hover);
  font-size: 0.76rem;
  font-weight: 700;
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
  min-height: 0;
}

.featured-note {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: end;
  padding: 2px 0 0;
}

.featured-note__content {
  display: grid;
  gap: 8px;
}

.featured-note__title {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: clamp(1.08rem, 1.5vw, 1.32rem);
  font-weight: 700;
  cursor: pointer;
}

.featured-note__title:hover {
  color: var(--accent-hover);
}

.featured-note__content p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
  font-size: 0.9rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}

.featured-note__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.84rem;
}

.featured-note__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-action-pill {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  color: var(--accent-hover);
  cursor: pointer;
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

.workbench-config-enter-active,
.workbench-config-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.workbench-config-enter-from,
.workbench-config-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 860px) {
  .workbench-dashboard {
    padding: 18px;
  }

  .workbench-hero {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .workbench-hero__actions {
    flex-wrap: wrap;
  }

  .featured-note {
    grid-template-columns: 1fr;
    align-items: start;
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

  .workbench-config-panel {
    right: auto;
    left: 0;
  }
}
</style>
