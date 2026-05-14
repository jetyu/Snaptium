<template>
  <div class="workbench-dashboard">
    <div class="workbench-layout">
      <main class="workbench-main">
        <section class="hero-card">
          <div class="hero-copy">
            <h1>{{ greetingText }}</h1>
            <p>{{ t('workbench.hero.focus') }}</p>

            <div class="hero-meta">
              <span>{{ t('workbench.label.recentEdited') }} {{ recentEditedTime }}</span>
              <span>{{ t('workbench.label.streak') }} {{ formatNumber(behaviorFeedback.streakDays) }}</span>
              <span>{{ t('workbench.stats.activeLast7Days') }} {{ formatNumber(activeDaysLast7) }}/7</span>
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
              <p class="overview-card__content">{{ metric.value }}</p>
            </article>
          </div>
        </section>

        <div class="panel-row panel-row--recent">
          <section class="panel panel--half">
            <header class="panel__header">
              <h2>{{ t('workbench.module.recentActivity') }}</h2>
            </header>

            <div v-if="recentActivityPreview.length > 0" class="feed-list feed-list--interactive">
              <button v-for="entry in recentActivityPreview" :key="entry.id" type="button" class="feed-row"
                :title="getActivityTooltip(entry)" @click="handleActivityClick(entry)">
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

          <section class="panel panel--half">
            <header class="panel__header">
              <h2>{{ t('workbench.module.recentQuestions') }}</h2>
            </header>

            <div v-if="recentQuestionEntriesPreview.length > 0" class="feed-list feed-list--interactive">
              <button v-for="question in recentQuestionEntriesPreview" :key="question.id" type="button" class="feed-row"
                :title="question.query" @click="openGlobalSearch(question.query)">
                <span class="feed-row__icon">
                  <SearchIcon theme="outline" :size="14" />
                </span>
                <span class="feed-row__main">
                  <span class="feed-row__title">{{ question.query }}</span>
                  <span class="feed-row__subtitle">{{ question.answer || t('workbench.empty.noAnswer') }}</span>
                </span>
                <span class="feed-row__time">{{ formatRelativeTime(question.askedAt) }}</span>
              </button>
            </div>
            <div v-else-if="todoFallbackEntries.length > 0" class="feed-list feed-list--interactive">
              <button v-for="entry in todoFallbackEntries" :key="entry.id" type="button" class="feed-row"
                :title="entry.snippet" @click="openNoteInWorkspace(entry.noteId)">
                <span class="feed-row__icon">
                  <Notes theme="outline" :size="14" />
                </span>
                <span class="feed-row__main">
                  <span class="feed-row__title">{{ entry.snippet }}</span>
                  <span class="feed-row__subtitle">{{ entry.noteTitle }}</span>
                </span>
                <span class="feed-row__time">{{ formatRelativeTime(entry.updatedAt) }}</span>
              </button>
            </div>
            <div v-else class="module-empty">{{ t('workbench.empty.noQuestions') }}</div>
          </section>
        </div>

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
              <button v-for="item in smartRecommendationsPreview" :key="item.note.id" type="button" class="feed-row"
                :title="item.note.title" @click="openNoteInWorkspace(item.note.id)">
                <span class="feed-row__icon">
                  <LinkOne theme="outline" :size="14" />
                </span>
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

      </main>

      <aside class="workbench-side">
        <section class="side-card side-card--ai">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--ai">
                <Magic theme="outline" :size="14" />
              </span>
              {{ t('pref.pane.aiAssistant') }}
            </h3>
            <span class="state-pill" :class="{ 'is-active': aiEnabled }">
              {{ aiEnabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </header>
          <p class="side-card__muted">{{ aiStatusText }}</p>
          <button v-if="showAISetupAction" type="button" class="side-card__action side-card__action--subtle"
            @click="openAIAssistantSettings">
            {{ t('workbench.sidebar.aiModel') }}
          </button>
        </section>

        <section class="side-card side-card--sync">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--sync">
                <DataServer theme="outline" :size="14" />
              </span>
              {{ t('label.syncStatus') }}
            </h3>
            <span class="state-pill" :class="statusToneClass">{{ syncStatusText }}</span>
          </header>
          <p v-if="formattedLastSynced" class="side-card__muted">{{ formattedLastSynced }}</p>
          <ul class="side-list">
            <li v-for="item in syncSummaryItems" :key="item">
              <CheckOne theme="outline" :size="12" class="side-list__icon" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <section class="side-card side-card--stats">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--stats">
                <ChartHistogram theme="outline" :size="14" />
              </span>
              {{ t('workbench.sidebar.todayStats') }}
            </h3>
          </header>
          <div class="stats-list">
            <div v-for="item in todayStatItems" :key="item.label" class="stats-row">
              <Dot theme="outline" :size="12" class="stats-row__icon" />
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="side-card side-card--growth">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--growth">
                <RadarChart theme="outline" :size="14" />
              </span>
              {{ t('workbench.sidebar.growth') }}
            </h3>
          </header>
          <div class="growth-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline :points="growthPolyline" />
            </svg>
          </div>
          <p class="side-card__muted">{{ growthLabel }}</p>
        </section>

        <section class="side-card side-card--heat">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--heat">
                <ConnectionPoint theme="outline" :size="14" />
              </span>
              {{ t('workbench.sidebar.knowledgeHeat') }}
            </h3>
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
  Edit,
  Plus,
  Brain,
  Magic,
  LinkOne,
  Notes,
  DataServer,
  CheckOne,
  Dot,
  RadarChart,
  ConnectionPoint,
  Star,
  ApplicationTwo,
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
const LINK_REGEX = /\[\[[^[\]]+\]\]|\[[^\]]+\]\([^)]+\)/g;
const HEADING_REGEX = /^#{1,6}\s+/gm;

const { t } = useI18n();
const { openGlobalSearch } = useSearch();
const { openSettings } = useSettings();
const { notes, notebooks, createNote, selectNote } = useWorkspace();
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

const starredCount = computed<number>(() => {
  const sNotes = notes.value.filter((note) => note.starred).length;
  const sNotebooks = notebooks.value.filter((nb) => nb.starred).length;
  return sNotes + sNotebooks;
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
const activeDaysLast7 = computed<number>(() => {
  const dayKeys = new Set(
    notes.value
      .filter((note) => note.updatedAt >= weekStart.value)
      .map((note) => getLocalDateKey(note.updatedAt)),
  );
  return dayKeys.size;
});

const overviewMetrics = computed<OverviewMetric[]>(() => {
  return [
    {
      id: 'total-writing',
      label: t('workbench.behavior.totalCharacters'),
      value: formatNumber(behaviorFeedback.value.totalCharacters),
      icon: ApplicationTwo,
    },
    {
      id: 'streak',
      label: t('workbench.behavior.streakDays'),
      value: formatNumber(behaviorFeedback.value.streakDays),
      icon: ChartHistogram,
    },
    {
      id: 'documents',
      label: t('workbench.stats.noteCount'),
      value: formatNumber(notes.value.length),
      icon: Notes,
    },
    {
      id: 'favorites',
      label: t('workbench.module.favorites'),
      value: formatNumber(starredCount.value),
      icon: Star,
    },
    {
      id: 'knowledge',
      label: t('search.semanticSearch'),
      value: formatNumber(knowledgePointCount.value),
      icon: DatabaseSearch,
    },
    {
      id: 'weekly-writing',
      label: t('workbench.behavior.sevenDayCharacters'),
      value: formatNumber(behaviorFeedback.value.sevenDayCharacters),
      icon: ApplicationTwo,
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

const weeklyGrowthPercentText = computed<string>(() => {
  const prev = previousWeekWords.value;
  const current = thisWeekWords.value;
  if (prev <= 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const delta = Math.round(((current - prev) / prev) * 100);
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}%`;
});

const growthLabel = computed<string>(() => {
  return `${t('workbench.stats.activeLast7Days')} ${weeklyGrowthPercentText.value}`;
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

const aiStatusText = computed<string>(() => {
  if (!settingsStore.config.aiAssistant.enabled) {
    return t('text.noAISourcesFound');
  }

  const sourceId = settingsStore.config.aiAssistant.sourceId.trim();
  if (!sourceId) {
    return t('text.noAISourcesFound');
  }

  const source = settingsStore.config.aiSources.find((item) => item.id === sourceId);
  const sourceName = source?.name.trim() ?? '';
  const modelName = settingsStore.config.aiAssistant.model.trim() || source?.aiModel.trim() || '';

  if (sourceName || modelName) {
    const fallbackText = t('workbench.empty.noData');
    const safeSourceName = sourceName || fallbackText;
    const safeModelName = modelName || fallbackText;
    return `${t('workbench.sidebar.aiModel')}：${safeSourceName} ${t('label.aiModel')}：${safeModelName}`;
  }
  return t('text.noAISourcesFound');
});

const showAISetupAction = computed<boolean>(() => {
  return !aiEnabled.value;
});

const todayStatItems = computed<TodayStatItem[]>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const todayQuestionCount = recentQuestionEntries.value.filter((entry) => entry.askedAt >= todayStart).length;
  const todayUpdatedNoteCount = notes.value.filter((note) => note.updatedAt >= todayStart).length;
  const todayStarredCount = notes.value.filter((note) => note.starred && (note.starredAt ?? 0) >= todayStart).length
    + notebooks.value.filter((notebook) => notebook.starred && (notebook.starredAt ?? 0) >= todayStart).length;

  return [
    { label: t('workbench.behavior.todayCharacters'), value: formatNumber(behaviorFeedback.value.todayCharacters) },
    { label: t('workbench.stats.noteCount'), value: formatNumber(todayUpdatedNoteCount) },
    { label: t('workbench.module.recentQuestions'), value: formatNumber(todayQuestionCount) },
    { label: t('workbench.module.favorites'), value: formatNumber(todayStarredCount) },
  ];
});

const greetingText = computed<string>(() => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return `${t('workbench.greeting.morning')}`;
  }
  if (hour < 18) {
    return `${t('workbench.greeting.afternoon')}`;
  }
  return `${t('workbench.greeting.evening')}`;
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
  --workbench-page: #fbfbff;
  --workbench-page-end: #f6f8fe;
  --workbench-card: rgba(255, 255, 255, 0.84);
  --workbench-card-solid: #ffffff;
  --workbench-panel: rgba(255, 255, 255, 0.9);
  --workbench-border: rgba(126, 136, 166, 0.16);
  --workbench-border-strong: rgba(126, 136, 166, 0.22);
  --workbench-ink: #121625;
  --workbench-muted: #727b91;
  --workbench-soft: rgba(245, 247, 253, 0.84);
  --workbench-blue: #3d7cff;
  --workbench-blue-soft: #73a7ff;
  --workbench-teal: #2eb889;
  --workbench-amber: #ef8a25;
  --workbench-rose: #f0508b;
  --workbench-shadow: 0 16px 38px rgba(43, 52, 82, 0.085), inset 0 1px 0 rgba(255, 255, 255, 0.88);
  --workbench-shadow-soft: 0 10px 26px rgba(43, 52, 82, 0.065), inset 0 1px 0 rgba(255, 255, 255, 0.84);
  flex: 1;
  min-height: 0;
  padding: 16px 20px 24px;
  background:
    radial-gradient(1050px 460px at 30% -12%, rgba(61, 124, 255, 0.14), transparent 62%),
    radial-gradient(850px 420px at 96% 6%, rgba(83, 164, 255, 0.1), transparent 58%),
    linear-gradient(180deg, var(--workbench-page) 0%, var(--workbench-page-end) 100%);
  color: var(--workbench-ink);
  overflow-y: auto;
}

:global([data-theme='dark']) .workbench-dashboard {
  --workbench-page: #11141c;
  --workbench-page-end: #161a25;
  --workbench-card: rgba(28, 32, 44, 0.82);
  --workbench-card-solid: #1c202c;
  --workbench-panel: rgba(27, 31, 43, 0.9);
  --workbench-border: rgba(151, 162, 194, 0.16);
  --workbench-border-strong: rgba(151, 162, 194, 0.24);
  --workbench-ink: var(--text);
  --workbench-muted: var(--text-muted);
  --workbench-soft: rgba(34, 39, 54, 0.82);
  --workbench-shadow: 0 16px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --workbench-shadow-soft: 0 10px 28px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.workbench-layout {
  width: min(100%, 1600px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(292px, 23vw, 360px);
  gap: clamp(16px, 1.4vw, 22px);
  align-items: start;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  display: grid;
  gap: 20px;
}

.hero-card {
  min-height: clamp(172px, 13.6vw, 206px);
  display: grid;
  grid-template-columns: minmax(300px, 0.86fr) minmax(320px, 1fr);
  gap: 16px;
  padding: 20px 0 18px 24px;
  overflow: hidden;
  border: 1px solid rgba(95, 151, 232, 0.18);
  border-radius: 20px;
  background:
    radial-gradient(circle at 9% 13%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.54) 38%, transparent 64%),
    linear-gradient(126deg, rgba(255, 255, 255, 0.94) 0%, rgba(251, 250, 255, 0.9) 44%, rgba(238, 234, 255, 0.7) 100%);
  box-shadow: var(--workbench-shadow-soft);
}

:global([data-theme='dark']) .hero-card {
  background:
    radial-gradient(circle at 9% 13%, rgba(52, 56, 76, 0.72), rgba(36, 40, 56, 0.52) 38%, transparent 64%),
    linear-gradient(126deg, rgba(31, 35, 49, 0.96) 0%, rgba(29, 32, 46, 0.92) 44%, rgba(44, 39, 72, 0.68) 100%);
}

.hero-copy {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 11px;
  position: relative;
  z-index: 2;
}

.hero-copy h1 {
  margin: 0;
  color: var(--workbench-ink);
  font-size: clamp(1.34rem, 1.18vw, 1.6rem);
  font-weight: 740;
  letter-spacing: -0.03em;
  line-height: 1.08;
}

.hero-copy p {
  max-width: 340px;
  margin: -2px 0 0;
  color: color-mix(in srgb, var(--workbench-ink) 62%, var(--workbench-muted));
  font-size: 0.84rem;
  font-weight: 540;
  line-height: 1.45;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--workbench-muted);
  font-size: 0.76rem;
  font-weight: 610;
}

.hero-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
}

.hero-meta span+span::before {
  content: "";
  width: 3px;
  height: 3px;
  margin-right: 10px;
  border-radius: 999px;
  background: rgba(126, 136, 166, 0.42);
}

.hero-meta span:nth-child(2) {
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.42);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 0;
}

.hero-action {
  min-width: 112px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid var(--workbench-border-strong);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--workbench-ink);
  box-shadow: 0 6px 16px rgba(43, 52, 82, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.82);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.hero-action--primary {
  border-color: rgba(61, 124, 255, 0.26);
  background: linear-gradient(150deg, #56a2ff 0%, #3d7cff 54%, #2f68e6 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(61, 124, 255, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.hero-art {
  position: relative;
  min-height: 100%;
  margin: -20px 0 -18px;
  overflow: hidden;
  border-radius: 0 20px 20px 0;
  opacity: 0.9;
  background:
    radial-gradient(circle at 56% 35%, rgba(255, 255, 255, 0.7) 0 32px, rgba(255, 255, 255, 0.2) 33px 60px, transparent 61px),
    linear-gradient(180deg, rgba(225, 216, 255, 0.84) 0%, rgba(210, 218, 255, 0.78) 53%, rgba(186, 203, 246, 0.72) 100%);
}

.hero-art::before,
.hero-art::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.hero-art::before {
  inset: 0;
  background:
    radial-gradient(12px 6px at 18% 22%, rgba(92, 98, 184, 0.46), transparent 62%),
    radial-gradient(10px 5px at 26% 18%, rgba(92, 98, 184, 0.34), transparent 62%),
    radial-gradient(14px 7px at 70% 34%, rgba(92, 98, 184, 0.28), transparent 62%),
    linear-gradient(160deg, transparent 0 46%, rgba(255, 255, 255, 0.3) 46.4% 47.1%, transparent 47.5%),
    linear-gradient(180deg, transparent 0 73%, rgba(255, 255, 255, 0.3) 73.2%, rgba(121, 138, 214, 0.13) 74%, transparent 100%);
  opacity: 0.74;
}

.hero-art::after {
  right: 10%;
  bottom: 17%;
  width: 96px;
  height: 104px;
  background:
    linear-gradient(180deg, rgba(42, 66, 132, 0.86), rgba(31, 51, 112, 0.84)) 4% 47% / 22px 77px no-repeat,
    linear-gradient(180deg, rgba(42, 66, 132, 0.92), rgba(31, 51, 112, 0.88)) 37% 31% / 27px 102px no-repeat,
    linear-gradient(180deg, rgba(42, 66, 132, 0.78), rgba(31, 51, 112, 0.76)) 73% 41% / 22px 86px no-repeat;
  clip-path: polygon(44% 0, 56% 21%, 51% 21%, 64% 43%, 57% 43%, 72% 67%, 55% 67%, 55% 100%, 45% 100%, 45% 67%, 28% 67%, 43% 43%, 36% 43%, 49% 21%, 44% 21%);
  filter: drop-shadow(40px 14px 0 rgba(30, 50, 112, 0.48)) drop-shadow(-42px 20px 0 rgba(30, 50, 112, 0.36));
  opacity: 0.76;
}

.hero-art__sun {
  position: absolute;
  top: 31%;
  right: 28%;
  width: 52px;
  aspect-ratio: 1;
  border-radius: 999px;
  background: radial-gradient(circle at 42% 38%, #ffffff 0%, rgba(255, 255, 255, 0.97) 44%, rgba(255, 255, 255, 0.28) 70%, transparent 100%);
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.58);
  opacity: 0.84;
}

.hero-art__ridge {
  position: absolute;
  left: -6%;
  width: 112%;
  pointer-events: none;
}

.hero-art__ridge--a {
  bottom: 34%;
  height: 44%;
  clip-path: polygon(0 72%, 12% 58%, 24% 70%, 38% 38%, 52% 62%, 64% 30%, 78% 58%, 92% 32%, 100% 52%, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(209, 202, 250, 0.9), rgba(178, 184, 239, 0.72));
}

.hero-art__ridge--b {
  bottom: 18%;
  height: 42%;
  clip-path: polygon(0 58%, 13% 37%, 27% 56%, 41% 28%, 55% 58%, 72% 33%, 86% 54%, 100% 24%, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(151, 162, 229, 0.8), rgba(120, 136, 214, 0.76));
}

.hero-art__ridge--c {
  bottom: -2%;
  height: 38%;
  clip-path: polygon(0 42%, 12% 30%, 26% 46%, 42% 20%, 58% 44%, 76% 24%, 92% 42%, 100% 30%, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(103, 121, 202, 0.84), rgba(76, 96, 179, 0.9));
}

.overview-section {
  display: grid;
  gap: 12px;
}

.overview-section h2,
.panel__header h2 {
  margin: 0;
  color: var(--workbench-ink);
  font-size: 1.08rem;
  font-weight: 760;
  letter-spacing: -0.035em;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
}

.overview-card {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto;
  align-content: center;
  justify-items: start;
  gap: 4px;
  padding: 10px 11px;
  border: 1px solid var(--workbench-border);
  border-radius: 11px;
  background: var(--workbench-card);
  box-shadow: var(--workbench-shadow-soft);
  cursor: default;
  backdrop-filter: blur(16px);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.overview-card__head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--workbench-blue);
  font-size: 0.72rem;
  font-weight: 720;
  white-space: nowrap;
}

.overview-card__head span {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--workbench-ink) 62%, var(--workbench-muted));
  text-overflow: ellipsis;
}

.overview-card__content {
  margin: 0;
  color: var(--workbench-ink);
  font-size: 0.9rem;
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: 18px;
  background: var(--workbench-panel);
  box-shadow: var(--workbench-shadow-soft);
  backdrop-filter: blur(18px);
}

.panel-row {
  display: grid;
  gap: 12px;
}

.panel-row--recent {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.panel--half {
  min-height: 0;
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 6px;
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  min-height: 23px;
  padding: 0 9px;
  border: 1px solid rgba(61, 124, 255, 0.18);
  border-radius: 999px;
  background: rgba(61, 124, 255, 0.1);
  color: var(--workbench-blue);
  font-size: 0.74rem;
  font-weight: 760;
}

.feed-list,
.smart-list {
  display: grid;
}

.feed-list {
  padding: 0 18px 16px;
}

.feed-row {
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 6px;
  border: 0;
  border-bottom: 1px solid var(--workbench-border);
  border-radius: 0;
  background: transparent;
  color: var(--workbench-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.feed-row:last-child {
  border-bottom: 0;
}

.feed-list--interactive .feed-row:hover {
  transform: translateY(-1px);
  border-bottom-color: transparent;
  border-radius: 12px;
  background: rgba(61, 124, 255, 0.05);
  box-shadow: inset 0 0 0 1px rgba(61, 124, 255, 0.1);
}

.feed-row__icon {
  width: 27px;
  height: 27px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: rgba(61, 124, 255, 0.09);
  color: var(--workbench-blue);
}

.feed-row__main {
  min-width: 0;
  display: grid;
  flex: 1;
  gap: 3px;
}

.feed-row__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.86rem;
  font-weight: 730;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-row__subtitle {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-muted);
  font-size: 0.76rem;
  font-weight: 540;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-row__time {
  flex-shrink: 0;
  color: var(--workbench-muted);
  font-size: 0.76rem;
  font-weight: 620;
  white-space: nowrap;
}

.smart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.75fr);
  margin-top: 6px;
  border-top: 1px solid var(--workbench-border);
}

.smart-insight {
  min-height: 166px;
  display: grid;
  align-content: center;
  gap: 12px;
  padding: 22px 28px;
  background:
    radial-gradient(circle at 12% 50%, rgba(61, 124, 255, 0.17), transparent 22%),
    radial-gradient(circle at 58% 80%, rgba(61, 124, 255, 0.12), transparent 28%),
    linear-gradient(120deg, rgba(255, 255, 255, 0.7) 0%, rgba(244, 242, 255, 0.82) 68%, rgba(235, 239, 255, 0.72) 100%);
}

:global([data-theme='dark']) .smart-insight {
  background:
    radial-gradient(circle at 12% 50%, rgba(61, 124, 255, 0.2), transparent 24%),
    radial-gradient(circle at 58% 80%, rgba(61, 124, 255, 0.12), transparent 30%),
    linear-gradient(120deg, rgba(32, 36, 50, 0.82) 0%, rgba(39, 35, 60, 0.84) 100%);
}

.smart-insight__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--workbench-blue) 18%, transparent);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--workbench-blue);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.smart-insight p {
  max-width: 440px;
  margin: 0;
  color: color-mix(in srgb, var(--workbench-ink) 70%, var(--workbench-muted));
  font-size: 0.86rem;
  font-weight: 620;
  line-height: 1.62;
}

.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topic-chips span {
  display: inline-flex;
  align-items: center;
  min-height: 23px;
  padding: 0 9px;
  border: 1px solid rgba(61, 124, 255, 0.14);
  border-radius: 999px;
  background: rgba(61, 124, 255, 0.1);
  color: #2f68e6;
  font-size: 0.74rem;
  font-weight: 760;
}

:global([data-theme='dark']) .topic-chips span {
  color: #9cc1ff;
}

.smart-insight__action {
  justify-self: start;
  min-width: 124px;
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(150deg, #56a2ff 0%, #3d7cff 100%);
  color: #ffffff;
  box-shadow: 0 15px 25px rgba(61, 124, 255, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.24);
  cursor: pointer;
  font: inherit;
  font-weight: 760;
}

.smart-list {
  padding: 16px 18px;
  border-left: 1px solid var(--workbench-border);
  background: rgba(255, 255, 255, 0.34);
}

.smart-list .feed-row {
  min-height: 48px;
  gap: 10px;
}

.smart-list .feed-row__icon {
  width: 27px;
  height: 27px;
}

.workbench-side {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 14px;
}

.side-card {
  display: grid;
  gap: 12px;
  padding: 18px 19px;
  border: 1px solid var(--workbench-border);
  border-radius: 18px;
  background: var(--workbench-card);
  box-shadow: var(--workbench-shadow-soft);
  backdrop-filter: blur(18px);
}

.side-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
}

.side-card__header h3 {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--workbench-ink);
  font-size: 0.98rem;
  font-weight: 760;
  letter-spacing: -0.03em;
}

.side-card__title-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.side-card__title-icon--ai {
  background: color-mix(in srgb, var(--workbench-blue) 14%, transparent);
  color: color-mix(in srgb, var(--workbench-blue) 90%, #1e3a8a);
}

.side-card__title-icon--sync,
.side-card__title-icon--stats,
.side-card__title-icon--growth,
.side-card__title-icon--heat {
  background: color-mix(in srgb, var(--workbench-blue) 14%, transparent);
  color: color-mix(in srgb, var(--workbench-blue) 90%, #1e3a8a);
}

.state-pill {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid var(--workbench-border);
  border-radius: 999px;
  background: var(--workbench-soft);
  color: var(--workbench-muted);
  font-size: 0.74rem;
  font-weight: 760;
}

.state-pill.is-active,
.state-pill.is-idle {
  border-color: rgba(46, 184, 137, 0.2);
  background: rgba(46, 184, 137, 0.1);
  color: #1a946d;
}

.state-pill.is-syncing {
  border-color: rgba(61, 124, 255, 0.2);
  background: rgba(61, 124, 255, 0.1);
  color: #2760ce;
}

.state-pill.is-error {
  border-color: rgba(240, 80, 139, 0.2);
  background: rgba(240, 80, 139, 0.1);
  color: #c93068;
}

.side-card__muted {
  margin: 0;
  color: color-mix(in srgb, var(--workbench-ink) 58%, var(--workbench-muted));
  font-size: 0.84rem;
  font-weight: 560;
  line-height: 1.58;
}

.side-card__action {
  height: 40px;
  border: 1px solid var(--workbench-border-strong);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--workbench-blue);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font: inherit;
  font-weight: 760;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.side-card__action--subtle {
  height: 34px;
  border-color: color-mix(in srgb, var(--workbench-blue) 24%, var(--workbench-border));
  background: rgba(61, 124, 255, 0.05);
  color: color-mix(in srgb, var(--workbench-blue) 88%, #1e3a8a);
  font-size: 0.8rem;
  font-weight: 700;
}

.side-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--workbench-muted);
  font-size: 0.82rem;
  font-weight: 650;
}

.side-list li {
  display: grid;
  grid-template-columns: 15px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.side-list__icon {
  color: color-mix(in srgb, var(--workbench-blue) 84%, white);
  flex-shrink: 0;
}

.stats-list {
  display: grid;
  gap: 10px;
}

.stats-row {
  display: grid;
  grid-template-columns: 15px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  color: var(--workbench-muted);
  font-size: 0.82rem;
  font-weight: 630;
}

.stats-row__icon {
  color: color-mix(in srgb, var(--workbench-blue) 84%, white);
  flex-shrink: 0;
}

.stats-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-row strong {
  color: var(--workbench-ink);
  font-size: 0.9rem;
  font-weight: 780;
  letter-spacing: -0.02em;
}

.growth-chart {
  height: 118px;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(61, 124, 255, 0.14), rgba(61, 124, 255, 0.03) 72%, transparent),
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(248, 249, 255, 0.42));
}

:global([data-theme='dark']) .growth-chart {
  background:
    linear-gradient(180deg, rgba(61, 124, 255, 0.2), rgba(61, 124, 255, 0.05) 72%, transparent),
    linear-gradient(180deg, rgba(35, 39, 54, 0.82), rgba(29, 33, 46, 0.48));
}

.growth-chart svg {
  width: 100%;
  height: 100%;
  padding: 18px 14px 14px;
}

.growth-chart polyline {
  fill: none;
  stroke: var(--workbench-blue);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3.6;
  filter: drop-shadow(0 8px 14px rgba(61, 124, 255, 0.24));
}

.heat-list {
  display: grid;
  gap: 12px;
}

.heat-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) 28px;
  gap: 9px;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 650;
}

.heat-row span {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.heat-row strong {
  color: color-mix(in srgb, var(--workbench-ink) 70%, var(--workbench-muted));
  font-size: 0.78rem;
  font-weight: 760;
  text-align: right;
}

.heat-row__bar {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(61, 124, 255, 0.14);
}

.heat-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5aa7ff 0%, #3d7cff 100%);
  box-shadow: 0 0 14px rgba(61, 124, 255, 0.24);
}

.module-empty {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 18px 16px;
  border: 1px dashed var(--workbench-border-strong);
  border-radius: 13px;
  color: var(--workbench-muted);
  font-size: 0.82rem;
  font-weight: 610;
  background: rgba(255, 255, 255, 0.36);
}

@media (max-width: 1520px) {
  .workbench-dashboard {
    padding: 14px 18px 22px;
  }

  .workbench-layout {
    grid-template-columns: minmax(0, 1fr) minmax(276px, 320px);
    gap: 16px;
  }

  .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .overview-card {
    padding: 9px 10px;
  }

  .overview-card__content {
    font-size: 0.86rem;
  }
}

@media (max-width: 1280px) {
  .workbench-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card {
    grid-template-columns: minmax(0, 1fr);
    padding-right: 24px;
  }

  .hero-art {
    min-height: 152px;
    margin: 0;
    border-radius: 16px;
  }
}

@media (max-width: 900px) {
  .workbench-dashboard {
    padding: 12px;
  }

  .workbench-main {
    gap: 16px;
  }

  .hero-card {
    padding: 18px;
    border-radius: 16px;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .smart-grid {
    grid-template-columns: 1fr;
  }

  .panel-row--recent {
    grid-template-columns: 1fr;
  }

  .smart-list {
    border-top: 1px solid var(--workbench-border);
    border-left: 0;
  }

  .workbench-side {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1281px) and (max-height: 840px) {
  .workbench-dashboard {
    padding: 12px 16px 18px;
  }

  .workbench-main {
    gap: 14px;
  }

  .hero-card {
    min-height: clamp(150px, 12vw, 178px);
    padding: 16px 0 14px 20px;
    gap: 12px;
  }

  .hero-copy {
    gap: 8px;
  }

  .hero-copy h1 {
    font-size: clamp(1.24rem, 1.02vw, 1.44rem);
  }

  .hero-copy p {
    font-size: 0.78rem;
    line-height: 1.36;
  }

  .hero-actions {
    gap: 6px;
  }

  .hero-action {
    min-height: 34px;
    font-size: 0.76rem;
  }
}

@media (max-width: 620px) {
  .hero-card {
    padding: 15px;
  }

  .hero-copy h1 {
    font-size: 1.28rem;
  }

  .hero-action {
    width: 100%;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .panel__header,
  .feed-list,
  .smart-list {
    padding-right: 16px;
    padding-left: 16px;
  }

  .feed-row {
    align-items: flex-start;
    min-height: 54px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .feed-row__time {
    display: none;
  }

  .side-card {
    padding: 16px;
  }
}
</style>
