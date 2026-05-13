<template>
  <div class="workbench-dashboard">
    <header class="workbench-topbar">
      <div class="topbar-brand">{{ t('common.appName') }}</div>

      <button type="button" class="topbar-search" @click="triggerSearch">
        <SearchIcon theme="outline" :size="16" />
        <span class="topbar-search__text">{{ t('search.placeholder') }}</span>
        <kbd class="topbar-search__shortcut">Ctrl K</kbd>
      </button>

      <div class="topbar-actions">
        <button
          type="button"
          class="topbar-icon-button"
          :aria-label="t('label.themeMode')"
          :title="t('label.themeMode')"
          @click="openGeneralSettings"
        >
          <Sun theme="outline" :size="18" />
        </button>
        <button type="button" class="topbar-icon-button" :aria-label="t('workbench.title')" :title="t('workbench.title')">
          <BellRing theme="outline" :size="18" />
        </button>
        <button type="button" class="topbar-avatar" :aria-label="t('common.appName')" :title="t('common.appName')">
          <User theme="outline" :size="16" />
        </button>
      </div>
    </header>

    <div class="workbench-layout">
      <main class="workbench-main">
        <section class="hero-card">
          <div class="hero-copy">
            <h1>{{ greetingText }}</h1>
            <p>{{ t('workbench.hero.focus') }}</p>

            <div class="hero-meta">
              <span>{{ t('workbench.label.recentEdited') }} {{ recentEditedTime }}</span>
              <span>{{ t('workbench.label.todayWriting') }} {{ formatNumber(behaviorFeedback.todayCharacters) }}</span>
              <span>{{ t('workbench.label.streak') }} {{ formatNumber(behaviorFeedback.streakDays) }}</span>
            </div>

            <div class="hero-actions">
              <button type="button" class="hero-action hero-action--primary" @click="handlePrimaryAction">
                <Edit theme="outline" :size="14" />
                <span>{{ t('workbench.action.continueWriting') }}</span>
              </button>
              <button type="button" class="hero-action" @click="createFirstNote">
                <Plus theme="outline" :size="14" />
                <span>{{ t('workbench.action.newDocument') }}</span>
              </button>
            </div>
          </div>

          <div class="hero-art" aria-hidden="true">
            <div class="hero-art__sun"></div>
            <div class="hero-art__ridge hero-art__ridge--a"></div>
            <div class="hero-art__ridge hero-art__ridge--b"></div>
            <div class="hero-art__ridge hero-art__ridge--c"></div>
          </div>
        </section>

        <section class="overview-section">
          <h2>{{ t('workbench.module.dataStatsTitle') }}</h2>
          <div class="overview-grid">
            <article v-for="metric in overviewMetrics" :key="metric.id" class="overview-card">
              <div class="overview-card__head">
                <component :is="metric.icon" theme="outline" :size="15" />
                <span>{{ metric.label }}</span>
              </div>
              <strong>{{ metric.value }}</strong>
              <span class="overview-card__trend">{{ metric.trend }}</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <h2>{{ t('workbench.module.recentActivity') }}</h2>
          </header>

          <div v-if="recentActivityPreview.length > 0" class="feed-list">
            <button
              v-for="entry in recentActivityPreview"
              :key="entry.id"
              type="button"
              class="feed-row"
              :title="getActivityTooltip(entry)"
              @click="handleActivityClick(entry)"
            >
              <span class="feed-row__icon">
                <Edit v-if="entry.kind === 'saved'" theme="outline" :size="14" />
                <Brain v-else theme="outline" :size="14" />
              </span>
              <span class="feed-row__main">
                <span class="feed-row__title">{{ getActivityTitle(entry) }}</span>
                <span class="feed-row__subtitle">{{ getActivityReason(entry) }}</span>
              </span>
              <span class="feed-row__time">{{ formatRelativeTime(entry.timestamp) }}</span>
            </button>
          </div>
          <div v-else class="module-empty">{{ t('workbench.empty.noActivity') }}</div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <h2>{{ t('workbench.module.smartRecommendation') }}</h2>
            <span class="panel-badge">{{ t('workbench.tag.aiEnhanced') }}</span>
          </header>

          <div class="smart-grid">
            <article class="smart-insight">
              <div class="smart-insight__icon">
                <Magic theme="outline" :size="18" />
              </div>
              <p>{{ t('workbench.insight.connection') }}</p>
              <div class="topic-chips">
                <span v-for="topic in topTopicLabels" :key="topic">{{ topic }}</span>
              </div>
              <button type="button" class="smart-insight__action" @click="handlePrimaryAction">
                {{ t('workbench.action.continueWriting') }}
              </button>
            </article>

            <div class="smart-list">
              <button
                v-for="item in smartRecommendationsPreview"
                :key="item.note.id"
                type="button"
                class="feed-row"
                :title="item.note.title"
                @click="openNoteInWorkspace(item.note.id)"
              >
                <span class="feed-row__icon"><LinkOne theme="outline" :size="14" /></span>
                <span class="feed-row__main">
                  <span class="feed-row__title">{{ item.note.title }}</span>
                  <span class="feed-row__subtitle">{{ t(item.reasonKey) }}</span>
                </span>
                <span class="feed-row__time">{{ formatRelativeTime(item.note.updatedAt) }}</span>
              </button>
              <div v-if="smartRecommendationsPreview.length === 0" class="module-empty">
                {{ t('workbench.empty.noNotesBody') }}
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__header">
            <h2>{{ t('workbench.module.recentQuestions') }}</h2>
          </header>

          <div v-if="recentQuestionEntriesPreview.length > 0" class="feed-list">
            <button
              v-for="question in recentQuestionEntriesPreview"
              :key="question.id"
              type="button"
              class="feed-row"
              :title="question.query"
              @click="openGlobalSearch(question.query)"
            >
              <span class="feed-row__icon"><SearchIcon theme="outline" :size="14" /></span>
              <span class="feed-row__main">
                <span class="feed-row__title">{{ question.query }}</span>
                <span class="feed-row__subtitle">{{ question.answer || t('workbench.empty.noAnswer') }}</span>
              </span>
              <span class="feed-row__time">{{ formatRelativeTime(question.askedAt) }}</span>
            </button>
          </div>
          <div v-else-if="todoFallbackEntries.length > 0" class="feed-list">
            <button
              v-for="entry in todoFallbackEntries"
              :key="entry.id"
              type="button"
              class="feed-row"
              :title="entry.snippet"
              @click="openNoteInWorkspace(entry.noteId)"
            >
              <span class="feed-row__icon"><Notes theme="outline" :size="14" /></span>
              <span class="feed-row__main">
                <span class="feed-row__title">{{ entry.snippet }}</span>
                <span class="feed-row__subtitle">{{ entry.noteTitle }}</span>
              </span>
              <span class="feed-row__time">{{ formatRelativeTime(entry.updatedAt) }}</span>
            </button>
          </div>
          <div v-else class="module-empty">{{ t('workbench.empty.noQuestions') }}</div>
        </section>
      </main>

      <aside class="workbench-side">
        <section class="side-card">
          <header class="side-card__header">
            <h3>{{ t('pref.pane.aiAssistant') }}</h3>
            <span class="state-pill" :class="{ 'is-active': aiEnabled }">
              {{ aiEnabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </header>
          <p class="side-card__muted">{{ t('workbench.subtitle') }}</p>
          <button type="button" class="side-card__action" @click="openAIAssistantSettings">
            {{ t('workbench.sidebar.aiModel') }}
          </button>
        </section>

        <section class="side-card">
          <header class="side-card__header">
            <h3>{{ t('label.syncStatus') }}</h3>
            <span class="state-pill" :class="statusToneClass">{{ syncStatusText }}</span>
          </header>
          <p v-if="formattedLastSynced" class="side-card__muted">{{ formattedLastSynced }}</p>
          <ul class="side-list">
            <li v-for="item in syncSummaryItems" :key="item">{{ item }}</li>
          </ul>
          <button type="button" class="side-card__action" @click="openSyncSettings">
            {{ t('workbench.sidebar.syncConfig') }}
          </button>
        </section>

        <section class="side-card">
          <header class="side-card__header">
            <h3>{{ t('workbench.sidebar.todayStats') }}</h3>
          </header>
          <div class="stats-list">
            <div v-for="item in todayStatItems" :key="item.label" class="stats-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="side-card">
          <header class="side-card__header">
            <h3>{{ t('workbench.sidebar.growth') }}</h3>
          </header>
          <div class="growth-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline :points="growthPolyline" />
            </svg>
          </div>
          <p class="side-card__muted">{{ growthLabel }}</p>
        </section>

        <section class="side-card">
          <header class="side-card__header">
            <h3>{{ t('workbench.sidebar.knowledgeHeat') }}</h3>
          </header>
          <div class="heat-list">
            <div v-for="entry in knowledgeHeatEntries" :key="entry.label" class="heat-row">
              <span>{{ entry.label }}</span>
              <div class="heat-row__bar">
                <i :style="{ width: `${entry.percent}%` }"></i>
              </div>
              <strong>{{ formatNumber(entry.value) }}</strong>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import {
  Search as SearchIcon,
  Sun,
  BellRing,
  User,
  Edit,
  Plus,
  Brain,
  Magic,
  LinkOne,
  Notes,
  TagOne,
  DataServer,
  DatabaseSearch,
  ChartHistogram,
} from '@icon-park/vue-next';
import { useSearch } from '@renderer/features/search';
import { useWorkspace, type Note } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { useSettings } from '@renderer/features/settings';
import { useSyncPresentation, useSyncStore } from '@renderer/features/sync';
import { useLocalSmartRecommendations } from '../composables/useLocalSmartRecommendations';
import { WORKBENCH_LIMITS, type WorkbenchQuestionEntry } from '../constants/workbench.constants';

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

interface OverviewMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  icon: Component;
}

interface TodayStatItem {
  label: string;
  value: string;
}

interface HeatEntry {
  label: string;
  value: number;
  percent: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const WORKBENCH_DISPLAY_LIMITS = {
  RECENT_ACTIVITY: 6,
  RECENT_QUESTIONS: 4,
  SMART_RECOMMENDATIONS: 4,
} as const;

const TOPIC_PATTERNS = [
  { label: 'RAG', pattern: /\brag\b/gi },
  { label: 'Vector', pattern: /向量|vector|embedding|lancedb/gi },
  { label: 'Local', pattern: /本地|local[-\s]?first|offline/gi },
  { label: 'E2EE', pattern: /e2ee|端到端|encrypt|encryption/gi },
  { label: 'AI', pattern: /\bai\b|智能|模型|model/gi },
] as const;

const TODO_TASK_REGEX = /^[-*+]\s+\[\s\]\s+(.+)$/;
const TODO_MARKER_REGEX = /(?:^|\s)(?:TODO|TBD|FIXME)\b:?\s*(.+)?$/i;
const CODE_FENCE_REGEX = /^\s*(?:```|~~~)/;
const TAG_REGEX = /(^|\s)#([^\s#]+)/g;
const LINK_REGEX = /\[\[[^[\]]+\]\]|\[[^\]]+\]\([^)]+\)/g;
const HEADING_REGEX = /^#{1,6}\s+/gm;

const { t } = useI18n();
const { openGlobalSearch } = useSearch();
const { openSettings } = useSettings();
const { notes, createNote, selectNote } = useWorkspace();
const appShellStore = useAppShellStore();
const workbenchStore = useWorkbenchStore();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const { recentQuestions } = storeToRefs(workbenchStore);
const { statusLabel, statusToneClass, summaryItems, formattedLastSynced } = useSyncPresentation();

const hasNotes = computed<boolean>(() => notes.value.length > 0);
const noteMap = computed<Map<string, Note>>(() => new Map(notes.value.map((note) => [note.id, note])));
const sortedNotesByUpdated = computed<Note[]>(() => [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt));
const recentQuestionEntries = computed<WorkbenchQuestionEntry[]>(() => recentQuestions.value);
const recentQuestionEntriesPreview = computed<WorkbenchQuestionEntry[]>(() => {
  return recentQuestionEntries.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_QUESTIONS);
});

const { smartRecommendations } = useLocalSmartRecommendations({
  notes: sortedNotesByUpdated,
});
const smartRecommendationsPreview = computed(() => {
  return smartRecommendations.value.slice(0, WORKBENCH_DISPLAY_LIMITS.SMART_RECOMMENDATIONS);
});

const behaviorFeedback = computed(() => {
  const now = Date.now();
  const todayStart = getDayStartTimestamp(now);
  const sevenDayThreshold = todayStart - (6 * DAY_MS);
  const activeDays = new Set(notes.value.map((note) => getLocalDateKey(note.updatedAt)));

  let streakDays = 0;
  let cursor = todayStart;
  while (activeDays.has(getLocalDateKey(cursor))) {
    streakDays += 1;
    cursor -= DAY_MS;
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
  const savedActivities: ActivityEntry[] = sortedNotesByUpdated.value.slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY).map((note) => ({
    id: `saved:${note.id}:${note.updatedAt}`,
    kind: 'saved',
    timestamp: note.updatedAt,
    note,
  }));

  const questionedActivities: ActivityEntry[] = recentQuestionEntries.value
    .slice(0, WORKBENCH_LIMITS.RECENT_ACTIVITY)
    .map((entry) => ({
      id: `questioned:${entry.id}`,
      kind: 'questioned',
      timestamp: entry.askedAt,
      question: entry,
      note: entry.sourceNoteIds.length > 0 ? noteMap.value.get(entry.sourceNoteIds[0]) : undefined,
    }));

  return [...savedActivities, ...questionedActivities]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_ACTIVITY);
});

const recentActivityPreview = computed<ActivityEntry[]>(() => recentActivity.value);

const uniqueTagsCount = computed<number>(() => {
  const tags = new Set<string>();
  notes.value.forEach((note) => {
    const matches = note.content.match(TAG_REGEX);
    if (!matches) {
      return;
    }
    matches.forEach((rawTag) => {
      const normalized = rawTag.trim().replace(/^#/, '').toLowerCase();
      if (normalized) {
        tags.add(normalized);
      }
    });
  });
  return tags.size;
});

const knowledgePointCount = computed<number>(() => {
  return notes.value.reduce((total, note) => {
    const linkCount = note.content.match(LINK_REGEX)?.length ?? 0;
    const headingCount = note.content.match(HEADING_REGEX)?.length ?? 0;
    return total + linkCount + headingCount;
  }, 0);
});

const topicScores = computed(() => {
  return TOPIC_PATTERNS.map((topic) => {
    const score = notes.value.reduce((total, note) => {
      const haystack = `${note.title}\n${note.content}`;
      const matches = haystack.match(topic.pattern);
      return total + (matches?.length ?? 0);
    }, 0);

    return {
      label: topic.label,
      value: score,
    };
  });
});

const topTopicLabels = computed<string[]>(() => {
  const nonZero = topicScores.value.filter((topic) => topic.value > 0).sort((left, right) => right.value - left.value);
  if (nonZero.length > 0) {
    return nonZero.slice(0, 4).map((topic) => topic.label);
  }
  return TOPIC_PATTERNS.slice(0, 4).map((topic) => topic.label);
});

const knowledgeHeatEntries = computed<HeatEntry[]>(() => {
  const sorted = [...topicScores.value].sort((left, right) => right.value - left.value).slice(0, 5);
  const maxValue = Math.max(1, ...sorted.map((entry) => entry.value));
  return sorted.map((entry) => ({
    label: entry.label,
    value: entry.value,
    percent: Math.max(8, Math.round((entry.value / maxValue) * 100)),
  }));
});

const weekStart = computed<number>(() => getDayStartTimestamp(Date.now()) - (6 * DAY_MS));
const notesUpdatedThisWeek = computed<number>(() => notes.value.filter((note) => note.updatedAt >= weekStart.value).length);
const questionsThisWeek = computed<number>(() => recentQuestionEntries.value.filter((entry) => entry.askedAt >= weekStart.value).length);

const overviewMetrics = computed<OverviewMetric[]>(() => {
  return [
    {
      id: 'documents',
      label: t('workbench.stats.noteCount'),
      value: formatNumber(notes.value.length),
      trend: `${formatNumber(notesUpdatedThisWeek.value)} ${t('workbench.stats.activeLast7Days')}`,
      icon: DataServer,
    },
    {
      id: 'tags',
      label: t('workbench.module.favorites'),
      value: formatNumber(uniqueTagsCount.value),
      trend: `${formatNumber(uniqueTagsCount.value)} #`,
      icon: TagOne,
    },
    {
      id: 'knowledge',
      label: t('search.semanticSearch'),
      value: formatNumber(knowledgePointCount.value),
      trend: `${formatNumber(knowledgePointCount.value)}+`,
      icon: DatabaseSearch,
    },
    {
      id: 'questions',
      label: t('workbench.module.recentQuestions'),
      value: formatNumber(recentQuestionEntries.value.length),
      trend: `${formatNumber(questionsThisWeek.value)} ${t('workbench.stats.activeLast7Days')}`,
      icon: Brain,
    },
    {
      id: 'writing',
      label: t('workbench.behavior.sevenDayCharacters'),
      value: formatNumber(behaviorFeedback.value.sevenDayCharacters),
      trend: `${formatNumber(behaviorFeedback.value.todayCharacters)} ${t('workbench.behavior.todayCharacters')}`,
      icon: ChartHistogram,
    },
  ];
});

const dailyWordsSeries = computed<number[]>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const buckets = new Array<number>(7).fill(0);

  notes.value.forEach((note) => {
    const diffDays = Math.floor((todayStart - getDayStartTimestamp(note.updatedAt)) / DAY_MS);
    if (diffDays < 0 || diffDays > 6) {
      return;
    }
    const bucketIndex = 6 - diffDays;
    buckets[bucketIndex] += getCharacterCount(note.content);
  });

  return buckets;
});

const growthPolyline = computed<string>(() => {
  const points = dailyWordsSeries.value;
  if (points.length === 0) {
    return '0,100 100,100';
  }
  const max = Math.max(1, ...points);
  return points
    .map((value, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - ((value / max) * 92 + 4);
      return `${x},${Math.max(2, Math.min(98, y))}`;
    })
    .join(' ');
});

const thisWeekWords = computed<number>(() => dailyWordsSeries.value.reduce((total, value) => total + value, 0));
const previousWeekWords = computed<number>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const prevWeekStart = todayStart - (13 * DAY_MS);
  const prevWeekEnd = todayStart - (6 * DAY_MS);

  return notes.value
    .filter((note) => note.updatedAt >= prevWeekStart && note.updatedAt < prevWeekEnd)
    .reduce((total, note) => total + getCharacterCount(note.content), 0);
});

const growthLabel = computed<string>(() => {
  const prev = previousWeekWords.value;
  const current = thisWeekWords.value;
  if (prev <= 0) {
    return `${t('workbench.stats.activeLast7Days')} +100%`;
  }
  const delta = Math.round(((current - prev) / prev) * 100);
  const sign = delta >= 0 ? '+' : '';
  return `${t('workbench.stats.activeLast7Days')} ${sign}${delta}%`;
});

const recentEditedTime = computed<string>(() => {
  const targetNote = sortedNotesByUpdated.value[0];
  if (!targetNote) {
    return t('workbench.empty.noData');
  }
  return formatRelativeTime(targetNote.updatedAt);
});

const aiEnabled = computed<boolean>(() => {
  return settingsStore.config.aiAssistant.enabled && settingsStore.config.aiAssistant.sourceId.trim().length > 0;
});

const syncStatusText = computed<string>(() => {
  const label = statusLabel.value;
  if (label.startsWith('syncStatus.')) {
    if (syncStore.isSyncing) {
      return t('button.syncing');
    }
    return t('syncStatus.idle');
  }
  return label;
});

const syncSummaryItems = computed<string[]>(() => {
  return summaryItems.value.slice(0, 3);
});

const todayStatItems = computed<TodayStatItem[]>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const todayQuestionCount = recentQuestionEntries.value.filter((entry) => entry.askedAt >= todayStart).length;
  const todayNewNoteCount = notes.value.filter((note) => note.updatedAt >= todayStart).length;
  const todaySmartCount = smartRecommendationsPreview.value.length;

  return [
    { label: t('workbench.behavior.todayCharacters'), value: formatNumber(behaviorFeedback.value.todayCharacters) },
    { label: t('workbench.module.recentQuestions'), value: formatNumber(todayQuestionCount) },
    { label: t('workbench.stats.noteCount'), value: formatNumber(todayNewNoteCount) },
    { label: t('workbench.module.smartRecommendation'), value: formatNumber(todaySmartCount) },
  ];
});

const greetingText = computed<string>(() => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return `${t('workbench.greeting.morning')}, ${t('common.appName')}`;
  }
  if (hour < 18) {
    return `${t('workbench.greeting.afternoon')}, ${t('common.appName')}`;
  }
  return `${t('workbench.greeting.evening')}, ${t('common.appName')}`;
});

function normalizeTodoSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 72);
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

async function createFirstNote(): Promise<void> {
  await createNote(null);
  await appShellStore.setActiveMainView('workspace');
}

async function openNoteInWorkspace(noteId: string): Promise<void> {
  selectNote(noteId);
  await appShellStore.setActiveMainView('workspace');
}

async function handlePrimaryAction(): Promise<void> {
  if (!hasNotes.value) {
    await createFirstNote();
    return;
  }

  const primaryNote = smartRecommendationsPreview.value[0]?.note ?? sortedNotesByUpdated.value[0] ?? null;
  if (primaryNote) {
    await openNoteInWorkspace(primaryNote.id);
  }
}

function openAIAssistantSettings(): void {
  openSettings('ai-sources');
}

function openSyncSettings(): void {
  openSettings('sync');
}

function openGeneralSettings(): void {
  openSettings('general');
}

function triggerSearch(): void {
  openGlobalSearch();
}

function getCharacterCount(content: string): number {
  return content.replace(/\s+/g, '').length;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function getDayStartTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRelativeTime(timestamp: number): string {
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

function getActivityTitle(entry: ActivityEntry): string {
  if (entry.kind === 'questioned') {
    return entry.question?.query ?? t('workbench.empty.noData');
  }
  return entry.note?.title ?? t('workbench.empty.noData');
}

function getActivityReason(entry: ActivityEntry): string {
  if (entry.kind === 'questioned') {
    return t('workbench.activity.questioned');
  }
  return t('workbench.activity.saved');
}

function getActivityTooltip(entry: ActivityEntry): string {
  return `${getActivityTitle(entry)} / ${getActivityReason(entry)}`;
}

async function handleActivityClick(entry: ActivityEntry): Promise<void> {
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
  padding: 16px;
  background:
    radial-gradient(1200px 400px at 24% -10%, rgba(67, 114, 246, 0.12), transparent 60%),
    radial-gradient(1000px 420px at 92% -8%, rgba(244, 114, 182, 0.1), transparent 64%),
    var(--bg);
  overflow-y: auto;
}

.workbench-topbar {
  height: 54px;
  display: grid;
  grid-template-columns: 140px minmax(0, 520px) auto;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 80%, white);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  backdrop-filter: blur(10px);
}

.topbar-brand {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.topbar-search {
  width: 100%;
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg) 82%, white);
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.topbar-search:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 5%, var(--panel));
}

.topbar-search__text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-search__shortcut {
  font-size: 0.7rem;
  color: var(--text-muted);
  border: 1px solid color-mix(in srgb, var(--panel-border) 80%, white);
  border-radius: 6px;
  padding: 2px 6px;
  background: color-mix(in srgb, var(--panel) 90%, white);
}

.topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.topbar-icon-button,
.topbar-avatar {
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 80%, white);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 94%, white);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.topbar-avatar {
  border-radius: 999px;
}

.workbench-layout {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 38%);
  gap: 12px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--panel-border));
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.86) 0%, rgba(247, 248, 255, 0.86) 40%, rgba(244, 246, 255, 0.9) 100%),
    color-mix(in srgb, var(--panel) 92%, white);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.hero-copy {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 11px;
}

.hero-copy h1 {
  margin: 0;
  font-size: 1.95rem;
  line-height: 1.04;
  color: #111a2f;
}

.hero-copy p {
  margin: 0;
  color: color-mix(in srgb, var(--text-muted) 86%, #f7f8ff);
  line-height: 1.5;
  font-size: 0.95rem;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 0.83rem;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-action {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  color: var(--text);
  cursor: pointer;
}

.hero-action--primary {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--panel-border));
  background: linear-gradient(140deg, color-mix(in srgb, var(--accent) 92%, #6b7cf8), color-mix(in srgb, var(--accent-hover) 88%, #8b5cf6));
  color: #ffffff;
}

.hero-art {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--panel-border));
  background: linear-gradient(170deg, rgba(194, 197, 250, 0.44), rgba(235, 236, 255, 0.68));
}

.hero-art__sun {
  position: absolute;
  top: 14%;
  right: 20%;
  width: 58px;
  aspect-ratio: 1;
  border-radius: 999px;
  background: radial-gradient(circle at 42% 38%, #ffffff 0%, rgba(255, 255, 255, 0.88) 36%, rgba(255, 255, 255, 0.24) 72%, transparent 100%);
}

.hero-art__ridge {
  position: absolute;
  left: -6%;
  width: 112%;
  border-radius: 52% 48% 0 0 / 84% 76% 0 0;
}

.hero-art__ridge--a {
  bottom: 8%;
  height: 40%;
  background: linear-gradient(180deg, rgba(146, 158, 232, 0.74), rgba(123, 139, 218, 0.8));
}

.hero-art__ridge--b {
  bottom: -5%;
  height: 32%;
  background: linear-gradient(180deg, rgba(108, 126, 212, 0.8), rgba(89, 106, 190, 0.86));
}

.hero-art__ridge--c {
  bottom: -16%;
  height: 28%;
  background: linear-gradient(180deg, rgba(78, 96, 180, 0.9), rgba(66, 84, 161, 0.96));
}

.overview-section {
  display: grid;
  gap: 10px;
}

.overview-section h2 {
  margin: 0;
  font-size: 1.01rem;
  color: var(--text);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.overview-card {
  min-width: 0;
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, white);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel) 94%, white);
}

.overview-card__head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.81rem;
  white-space: nowrap;
}

.overview-card strong {
  font-size: 2rem;
  line-height: 1;
  color: var(--text);
}

.overview-card__trend {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.panel {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, white);
  border-radius: 16px;
  background: color-mix(in srgb, var(--panel) 94%, white);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel__header h2 {
  margin: 0;
  font-size: 1rem;
}

.panel-badge {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--accent-hover) 82%, #4f46e5);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--panel-border));
  border-radius: 999px;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}

.feed-list,
.smart-list {
  display: grid;
  gap: 8px;
}

.feed-row {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, white);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.feed-row:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 4%, var(--panel));
}

.feed-row__icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-hover);
  flex-shrink: 0;
}

.feed-row__main {
  min-width: 0;
  display: grid;
  flex: 1;
  gap: 2px;
}

.feed-row__title {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.88rem;
  color: var(--text);
}

.feed-row__subtitle {
  min-width: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-row__time {
  font-size: 0.76rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.smart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.smart-insight {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--panel-border));
  border-radius: 12px;
  background:
    radial-gradient(circle at 12% 8%, rgba(121, 108, 255, 0.2), transparent 42%),
    linear-gradient(150deg, rgba(244, 244, 255, 0.86), rgba(250, 250, 255, 0.96));
}

.smart-insight__icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  color: var(--accent-hover);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.smart-insight p {
  margin: 0;
  line-height: 1.6;
  color: color-mix(in srgb, var(--text-muted) 86%, #3b3f53);
  font-size: 0.84rem;
}

.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topic-chips span {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  background: color-mix(in srgb, var(--panel) 90%, white);
  color: var(--text-muted);
  font-size: 0.74rem;
}

.smart-insight__action {
  height: 34px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--panel-border));
  border-radius: 10px;
  background: linear-gradient(140deg, var(--accent), var(--accent-hover));
  color: #ffffff;
  cursor: pointer;
}

.workbench-side {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 10px;
}

.side-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, white);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel) 95%, white);
}

.side-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-card__header h3 {
  margin: 0;
  font-size: 0.92rem;
}

.state-pill {
  font-size: 0.72rem;
  color: var(--text-muted);
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 999px;
  padding: 2px 8px;
}

.state-pill.is-active,
.state-pill.is-idle {
  color: color-mix(in srgb, #16a34a 86%, #22c55e);
  border-color: color-mix(in srgb, #22c55e 32%, var(--panel-border));
  background: color-mix(in srgb, #22c55e 9%, var(--panel));
}

.state-pill.is-syncing {
  color: color-mix(in srgb, #1d4ed8 88%, #3b82f6);
  border-color: color-mix(in srgb, #3b82f6 30%, var(--panel-border));
  background: color-mix(in srgb, #3b82f6 8%, var(--panel));
}

.state-pill.is-error {
  color: color-mix(in srgb, #ef4444 88%, #f87171);
  border-color: color-mix(in srgb, #ef4444 30%, var(--panel-border));
  background: color-mix(in srgb, #ef4444 8%, var(--panel));
}

.side-card__muted {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.81rem;
  line-height: 1.55;
}

.side-card__action {
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--panel-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  color: var(--accent-hover);
  cursor: pointer;
}

.side-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.79rem;
}

.stats-list {
  display: grid;
  gap: 6px;
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.stats-row strong {
  color: var(--text);
  font-size: 0.88rem;
}

.growth-chart {
  height: 104px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 10px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, white), color-mix(in srgb, var(--panel) 86%, white));
  overflow: hidden;
}

.growth-chart svg {
  width: 100%;
  height: 100%;
}

.growth-chart polyline {
  fill: none;
  stroke: color-mix(in srgb, var(--accent-hover) 88%, #4f46e5);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.heat-list {
  display: grid;
  gap: 8px;
}

.heat-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  font-size: 0.79rem;
}

.heat-row span {
  color: var(--text);
}

.heat-row strong {
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 600;
}

.heat-row__bar {
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-border) 70%, white);
  overflow: hidden;
}

.heat-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 88%, #6366f1), color-mix(in srgb, var(--accent-hover) 86%, #4f46e5));
}

.module-empty {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed color-mix(in srgb, var(--panel-border) 84%, white);
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.84rem;
}

@media (max-width: 1380px) {
  .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .workbench-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-art {
    min-height: 200px;
  }
}

@media (max-width: 860px) {
  .workbench-dashboard {
    padding: 12px;
  }

  .workbench-topbar {
    grid-template-columns: 1fr;
    height: auto;
    padding: 10px;
  }

  .topbar-actions {
    justify-content: flex-end;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .smart-grid {
    grid-template-columns: 1fr;
  }

  .workbench-side {
    grid-template-columns: 1fr;
  }

  .hero-copy h1 {
    font-size: 1.6rem;
  }
}

@media (max-width: 580px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .feed-row {
    min-height: 42px;
  }

  .hero-meta {
    gap: 6px;
    font-size: 0.78rem;
  }
}
</style>
