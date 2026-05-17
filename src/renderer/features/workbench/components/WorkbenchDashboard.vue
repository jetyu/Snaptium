<template>
  <div class="workbench-dashboard">
    <div class="workbench-layout">
      <main class="workbench-main">
        <section class="hero-card">
          <div class="hero-copy">
            <em class="hero-quote">
              <BookmarkOne theme="outline" :size="12" />
              <strong>{{ t('workbench.hero.dailyQuote') }}</strong>
              <span>{{ dailyQuoteText }}</span>
            </em>
            <p class="hero-greeting">{{ greetingText }}</p>
            <h1>{{ heroLeadText }}</h1>
            <div class="hero-meta">
              <span v-if="hasNotes">{{ t('workbench.label.recentEdited') }} {{ recentEditedTime }}</span>
            </div>
            <div class="hero-actions">
              <button type="button" class="hero-action hero-action--primary" @click="handlePrimaryAction">
                <Edit v-if="hasNotes" theme="outline" :size="14" />
                <Plus v-else theme="outline" :size="14" />
                <span>{{ hasNotes ? t('workbench.action.continueWriting') : t('workbench.action.newDocument') }}</span>
              </button>
              <button v-if="hasNotes" type="button" class="hero-action" @click="createFirstNote">
                <Plus theme="outline" :size="14" />
                <span>{{ t('workbench.action.newDocument') }}</span>
              </button>
            </div>
          </div>

          <div class="hero-art">
            <img class="hero-art__image" :src="wallpaperSrc" :alt="wallpaperAlt" @error="handleWallpaperImageError" />
            <button type="button" class="hero-art__source-button" :disabled="wallpaperLoading"
              :aria-label="t('workbench.action.nextWallpaper')" @click="loadNextWallpaper">
              <Picture theme="outline" :size="15" />
            </button>
            <div v-if="wallpaperTitleText || wallpaperMetaText || wallpaperSourceUrl" class="hero-art__info">
              <div v-if="wallpaperTitleText" class="hero-art__info-title">{{ wallpaperTitleText }}</div>
              <div v-if="wallpaperMetaText || wallpaperSourceUrl" class="hero-art__info-meta">
                <span v-if="wallpaperMetaText">{{ wallpaperMetaText }}</span>
                <a v-if="wallpaperSourceUrl" :href="wallpaperSourceUrl" target="_blank"
                  rel="noopener noreferrer nofollow">
                  {{ wallpaperSourceText }}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section class="overview-section">
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

        <section class="panel panel--smart">
          <header class="panel__header">
            <h2>{{ t('workbench.module.smartRecommendation') }}</h2>
            <span class="panel-badge">{{ t('workbench.tag.aiEnhanced') }}</span>
          </header>

          <div v-if="primarySmartRecommendation" class="smart-grid">
            <article class="smart-focus" :title="primarySmartRecommendation.note.title">
              <span class="smart-focus__head">
                <button type="button" class="smart-focus__open"
                  @click="openSmartRecommendation(primarySmartRecommendation)">
                  <span class="smart-focus__icon">
                    <component :is="getSmartReasonIcon(primarySmartRecommendation.reasonType)" theme="outline"
                      :size="18" />
                  </span>
                  <span class="smart-focus__reason">{{ t(primarySmartRecommendation.reasonKey) }}</span>
                  <span class="smart-focus__score">{{ formatSmartScore(primarySmartRecommendation.score) }}</span>
                </button>
                <span class="smart-feedback">
                  <button type="button" class="smart-feedback__button"
                    @click="openSmartRecommendation(primarySmartRecommendation)">
                    {{ t('workbench.action.continueWriting') }}
                  </button>
                  <button type="button" class="smart-feedback__button"
                    @click="handleRecommendationFeedback(primarySmartRecommendation, 'snoozed')">
                    {{ t('workbench.action.snoozeRecommendation') }}
                  </button>
                  <button type="button" class="smart-feedback__button smart-feedback__button--muted"
                    @click="handleRecommendationFeedback(primarySmartRecommendation, 'dismissed')">
                    {{ t('workbench.action.dismissRecommendation') }}
                  </button>
                </span>
              </span>
              <button type="button" class="smart-focus__body"
                @click="openSmartRecommendation(primarySmartRecommendation)">
                <span class="smart-focus__title">{{ primarySmartRecommendation.note.title }}</span>
                <span class="smart-focus__preview">{{ getSmartNotePreview(primarySmartRecommendation.note) }}</span>
                <span class="smart-focus__meta">
                  <span>{{ formatRelativeTime(primarySmartRecommendation.note.updatedAt) }}</span>
                  <span v-for="topic in topTopicLabels.slice(0, 3)" :key="topic">{{ topic }}</span>
                </span>
              </button>
            </article>

            <div class="smart-lanes">
              <article v-for="item in smartRecommendationLaneItems" :key="item.note.id" class="smart-lane"
                :title="item.note.title">
                <button type="button" class="smart-lane__open" @click="openSmartRecommendation(item)">
                  <span class="smart-lane__icon">
                    <component :is="getSmartReasonIcon(item.reasonType)" theme="outline" :size="14" />
                  </span>
                  <span class="smart-lane__main">
                    <span class="smart-lane__reason">{{ t(item.reasonKey) }}</span>
                    <span class="smart-lane__title">{{ item.note.title }}</span>
                  </span>
                  <span class="smart-lane__meta">
                    <span>{{ formatSmartScore(item.score) }}</span>
                    <span>{{ formatRelativeTime(item.note.updatedAt) }}</span>
                  </span>
                </button>
                <span class="smart-lane__actions">
                  <button type="button" class="smart-feedback__button smart-feedback__button--compact"
                    @click="openSmartRecommendation(item)">
                    {{ t('workbench.action.continueWriting') }}
                  </button>
                  <button type="button" class="smart-feedback__button smart-feedback__button--compact"
                    @click="handleRecommendationFeedback(item, 'snoozed')">
                    {{ t('workbench.action.snoozeRecommendation') }}
                  </button>
                  <button type="button"
                    class="smart-feedback__button smart-feedback__button--compact smart-feedback__button--muted"
                    @click="handleRecommendationFeedback(item, 'dismissed')">
                    {{ t('workbench.action.dismissRecommendation') }}
                  </button>
                </span>
              </article>
            </div>
          </div>

          <div v-else class="module-empty">
            {{ t('workbench.empty.noNotesBody') }}
          </div>
        </section>

      </main>

      <aside class="workbench-side">
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

        <section class="side-card side-card--tags">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--tags">
                <TagOne theme="outline" :size="14" />
              </span>
              {{ t('workbench.sidebar.activeTags') }}
            </h3>
            <button type="button" class="side-card__link" @click="openTagsView">
              {{ t('workbench.action.viewAllTags') }}
            </button>
          </header>

          <div v-if="activeTagEntries.length > 0" class="active-tag-list">
            <button v-for="entry in activeTagEntries" :key="entry.name" type="button" class="active-tag-row"
              :title="entry.name" @click="openTagsView">
              <span class="active-tag-row__main">
                <span class="active-tag-row__name">#{{ entry.name }}</span>
                <span class="active-tag-row__meta">
                  {{ t('workbench.tags.noteCount', { count: entry.count }) }}
                </span>
              </span>
            </button>
          </div>
          <div v-else class="side-card__empty">{{ t('workbench.empty.noActiveTags') }}</div>
        </section>

        <section class="side-card side-card--topic">
          <header class="side-card__header">
            <h3>
              <span class="side-card__title-icon side-card__title-icon--topic">
                <ConnectionPoint theme="outline" :size="14" />
              </span>
              {{ t('workbench.sidebar.knowledgeTopics') }}
            </h3>
          </header>
          <div v-if="knowledgeTopicEntries.length > 0" class="topic-list">
            <div v-for="entry in knowledgeTopicEntries" :key="entry.id" class="topic-row" :title="entry.label">
              <span class="topic-row__main">
                <span class="topic-row__title">{{ entry.label }}</span>
                <span class="topic-row__meta">
                  {{ t('workbench.topic.noteCount', { count: entry.noteCount }) }}
                  <span>{{ formatRelativeTime(entry.updatedAt) }}</span>
                </span>
              </span>
              <span class="topic-row__heat">
                <span class="topic-row__bar"><i :style="{ width: `${entry.percent}%` }"></i></span>
                <strong>{{ t('workbench.topic.heat', { score: Math.round(entry.heat) }) }}</strong>
              </span>
            </div>
          </div>
          <div v-else class="side-card__empty">{{ t('workbench.empty.noKnowledgeTopics') }}</div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import defaultHeroUrl from '@assets/images/default-hero.png';
import {
  Search as SearchIcon,
  Edit,
  Plus,
  Picture,
  Brain,
  LinkOne,
  Notes,
  Dot,
  RadarChart,
  ConnectionPoint,
  Star,
  ApplicationTwo,
  DatabaseSearch,
  ChartHistogram,
  Time,
  Fire,
  FolderFocus,
  BookmarkOne,
  TagOne,
} from '@icon-park/vue-next';
import { useSearch } from '@renderer/features/search';
import { useWorkspace, type Note } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { electronApi, type WallpaperResult } from '@renderer/core/bridge/electronApi';
import {
  useLocalSmartRecommendations,
  type LocalRecommendationReasonType,
  type LocalSmartRecommendationItem,
} from '../composables/useLocalSmartRecommendations';
import { useKnowledgeTopicClusters } from '../composables/useKnowledgeTopicClusters';
import {
  WORKBENCH_LIMITS,
  type WorkbenchQuestionEntry,
  type WorkbenchRecommendationFeedbackAction,
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

interface ActiveTagEntry {
  name: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const WORKBENCH_DISPLAY_LIMITS = {
  RECENT_ACTIVITY: 5,
  RECENT_QUESTIONS: 5,
  SMART_RECOMMENDATIONS: 5,
  ACTIVE_TAGS: 10,
  DAILY_QUOTES: 30,
} as const;
const SMART_RECOMMENDATION_LANE_LIMIT = Math.max(
  0,
  WORKBENCH_DISPLAY_LIMITS.SMART_RECOMMENDATIONS - 1,
);

const TODO_TASK_REGEX = /^[-*+]\s+\[\s\]\s+(.+)$/;
const TODO_MARKER_REGEX = /(?:^|\s)(?:TODO|TBD|FIXME)\b:?\s*(.+)?$/i;
const CODE_FENCE_REGEX = /^\s*(?:```|~~~)/;
const LINK_REGEX = /\[\[[^[\]]+\]\]|\[[^\]]+\]\([^)]+\)/g;
const HEADING_REGEX = /^#{1,6}\s+/gm;

const { t } = useI18n();
const { openGlobalSearch } = useSearch();
const { notes, notebooks, allTags, createNote, selectNote } = useWorkspace();
const appShellStore = useAppShellStore();
const workbenchStore = useWorkbenchStore();
const { recentQuestions, recommendationFeedback } = storeToRefs(workbenchStore);
const wallpaper = ref<WallpaperResult | null>(null);
const wallpaperLoading = ref<boolean>(false);
const wallpaperSrc = ref<string>(defaultHeroUrl);

const hasNotes = computed<boolean>(() => notes.value.length > 0);
const noteMap = computed<Map<string, Note>>(() => new Map(notes.value.map((note) => [note.id, note])));
const sortedNotesByUpdated = computed<Note[]>(() => [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt));
const recentQuestionEntries = computed<WorkbenchQuestionEntry[]>(() => recentQuestions.value);
const recentQuestionEntriesPreview = computed<WorkbenchQuestionEntry[]>(() => {
  return recentQuestionEntries.value.slice(0, WORKBENCH_DISPLAY_LIMITS.RECENT_QUESTIONS);
});

const { smartRecommendations } = useLocalSmartRecommendations({
  notes: sortedNotesByUpdated,
  feedback: recommendationFeedback,
  limit: WORKBENCH_DISPLAY_LIMITS.SMART_RECOMMENDATIONS,
});
const { topicClusters: knowledgeTopicEntries } = useKnowledgeTopicClusters({
  notes: sortedNotesByUpdated,
});
const smartRecommendationsPreview = computed<LocalSmartRecommendationItem[]>(() => {
  return smartRecommendations.value.slice(0, WORKBENCH_DISPLAY_LIMITS.SMART_RECOMMENDATIONS);
});
const primarySmartRecommendation = computed<LocalSmartRecommendationItem | null>(() => {
  return smartRecommendations.value[0] ?? null;
});
const smartRecommendationLaneItems = computed<LocalSmartRecommendationItem[]>(() => {
  const lanes: LocalSmartRecommendationItem[] = [];
  const usedReasonTypes = new Set<LocalRecommendationReasonType>();

  for (const item of smartRecommendations.value.slice(1)) {
    if (usedReasonTypes.has(item.reasonType)) {
      continue;
    }

    lanes.push(item);
    usedReasonTypes.add(item.reasonType);

    if (lanes.length >= SMART_RECOMMENDATION_LANE_LIMIT) {
      break;
    }
  }

  if (lanes.length >= SMART_RECOMMENDATION_LANE_LIMIT) {
    return lanes;
  }

  for (const item of smartRecommendations.value.slice(1)) {
    if (lanes.some((lane) => lane.note.id === item.note.id)) {
      continue;
    }

    lanes.push(item);
    if (lanes.length >= SMART_RECOMMENDATION_LANE_LIMIT) {
      break;
    }
  }

  return lanes;
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
    activeLast7Days: notes.value.filter((note) => note.updatedAt >= sevenDayThreshold).length,
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

const topTopicLabels = computed<string[]>(() => {
  const clusterLabels = knowledgeTopicEntries.value.slice(0, 4).map((topic) => topic.label);
  if (clusterLabels.length > 0) {
    return clusterLabels;
  }
  return ['Notes', 'Focus', 'Review'];
});

const heroNote = computed<Note | null>(() => sortedNotesByUpdated.value[0] ?? null);

const heroLeadText = computed<string>(() => {
  const note = heroNote.value;
  if (!note) {
    return t('workbench.hero.firstNoteLead');
  }

  return t('workbench.hero.continueNote', { title: note.title });
});

const todayUpdatedNoteCount = computed<number>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  return notes.value.filter((note) => note.updatedAt >= todayStart).length;
});

const activeTagEntries = computed<ActiveTagEntry[]>(() => {
  return [...allTags.value]
    .sort((left, right) => {
      if (right.updatedAt !== left.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, WORKBENCH_DISPLAY_LIMITS.ACTIVE_TAGS)
    .map((tag) => ({
      name: tag.name,
      count: tag.count,
    }));
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
  ];
});

const dailyUpdatedNoteSeries = computed<number[]>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const buckets = new Array<number>(7).fill(0);

  notes.value.forEach((note) => {
    const diffDays = Math.floor((todayStart - getDayStartTimestamp(note.updatedAt)) / DAY_MS);
    if (diffDays < 0 || diffDays > 6) {
      return;
    }
    const bucketIndex = 6 - diffDays;
    buckets[bucketIndex] += 1;
  });

  return buckets;
});

const growthPolyline = computed<string>(() => {
  const points = dailyUpdatedNoteSeries.value;
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

const thisWeekUpdatedNoteCount = computed<number>(() => dailyUpdatedNoteSeries.value.reduce((total, value) => total + value, 0));
const previousWeekUpdatedNoteCount = computed<number>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const prevWeekStart = todayStart - (13 * DAY_MS);
  const prevWeekEnd = todayStart - (6 * DAY_MS);

  return notes.value.filter((note) => note.updatedAt >= prevWeekStart && note.updatedAt < prevWeekEnd).length;
});

const weeklyGrowthPercentText = computed<string>(() => {
  const prev = previousWeekUpdatedNoteCount.value;
  const current = thisWeekUpdatedNoteCount.value;
  if (prev <= 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const delta = Math.round(((current - prev) / prev) * 100);
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}%`;
});

const growthLabel = computed<string>(() => {
  return `${t('workbench.stats.weeklyGrowth')} ${weeklyGrowthPercentText.value}`;
});

const recentEditedTime = computed<string>(() => {
  const targetNote = sortedNotesByUpdated.value[0];
  if (!targetNote) {
    return t('workbench.empty.noData');
  }
  return formatRelativeTime(targetNote.updatedAt);
});

const todayStatItems = computed<TodayStatItem[]>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  const todayQuestionCount = recentQuestionEntries.value.filter((entry) => entry.askedAt >= todayStart).length;
  const todayStarredCount = notes.value.filter((note) => note.starred && (note.starredAt ?? 0) >= todayStart).length
    + notebooks.value.filter((notebook) => notebook.starred && (notebook.starredAt ?? 0) >= todayStart).length;

  return [
    { label: t('workbench.stats.todayUpdatedNotes'), value: formatNumber(todayUpdatedNoteCount.value) },
    { label: t('workbench.stats.todayQuestions'), value: formatNumber(todayQuestionCount) },
    { label: t('workbench.stats.todayFavorites'), value: formatNumber(todayStarredCount) },
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

const dailyQuoteText = computed<string>(() => {
  const key = getLocalDateKey(Date.now());
  const index = getStableQuoteIndex(key, WORKBENCH_DISPLAY_LIMITS.DAILY_QUOTES);
  return t(`workbench.hero.quote.${index + 1}`);
});

const wallpaperAlt = computed<string>(() => wallpaper.value?.title || '');

const currentWallpaper = computed<WallpaperResult | null>(() => {
  return wallpaper.value?.success ? wallpaper.value : null;
});

const wallpaperTitleText = computed<string>(() => {
  const current = currentWallpaper.value;
  return current?.title || current?.description || '';
});

const wallpaperMetaText = computed<string>(() => {
  const current = currentWallpaper.value;
  if (!current) {
    return '';
  }

  const description = current.description === current.title ? '' : current.description;
  return description;
});

const wallpaperSourceText = computed<string>(() => {
  const current = currentWallpaper.value;
  if (!current) {
    return '';
  }

  return current.source === 'bing' ? 'Bing 4K' : getWallpaperSourceLabel(current.source);
});

const wallpaperSourceUrl = computed<string>(() => {
  const current = currentWallpaper.value;
  return current?.originUrl || '';
});

async function loadWallpaper(nextArchive = false): Promise<void> {
  if (wallpaperLoading.value) {
    return;
  }

  wallpaperLoading.value = true;
  try {
    const result = await electronApi.workspace.getDailyWallpaper({
      nextArchive,
      currentArchiveIndex: wallpaper.value?.archiveIndex,
    });
    wallpaper.value = result;
    if (result.success && result.dataUrl) {
      wallpaperSrc.value = result.dataUrl;
    } else {
      wallpaperSrc.value = defaultHeroUrl;
    }
  } catch {
    wallpaperSrc.value = defaultHeroUrl;
  } finally {
    wallpaperLoading.value = false;
  }
}

function loadNextWallpaper(): void {
  void loadWallpaper(true);
}

function handleWallpaperImageError(): void {
  if (wallpaperSrc.value !== defaultHeroUrl) {
    wallpaperSrc.value = defaultHeroUrl;
  }
}

function getWallpaperSourceLabel(source: WallpaperResult['source']): string {
  if (source === 'bing') {
    return 'Bing';
  }
  if (source === 'cache') {
    return 'Cache';
  }
  return '';
}

function getSmartReasonIcon(reasonType: LocalRecommendationReasonType): Component {
  if (reasonType === 'draft_signal') {
    return Edit;
  }
  if (reasonType === 'semantic_related') {
    return LinkOne;
  }
  if (reasonType === 'long_gap') {
    return Time;
  }
  if (reasonType === 'recent_focus') {
    return Fire;
  }
  if (reasonType === 'same_notebook') {
    return FolderFocus;
  }
  return BookmarkOne;
}

function formatSmartScore(score: number): string {
  return `${Math.max(1, Math.min(99, Math.round(score * 100)))}%`;
}

function getSmartNotePreview(note: Note): string {
  const text = note.content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text || t('workbench.empty.noContent');
}

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

async function openTagsView(): Promise<void> {
  await appShellStore.setActiveMainView('tags');
}

async function openSmartRecommendation(item: LocalSmartRecommendationItem): Promise<void> {
  await workbenchStore.recordRecommendationFeedback({
    noteId: item.note.id,
    reasonType: item.reasonType,
    action: 'opened',
  });
  await openNoteInWorkspace(item.note.id);
}

async function handleRecommendationFeedback(
  item: LocalSmartRecommendationItem,
  action: Extract<WorkbenchRecommendationFeedbackAction, 'snoozed' | 'dismissed'>,
): Promise<void> {
  await workbenchStore.recordRecommendationFeedback({
    noteId: item.note.id,
    reasonType: item.reasonType,
    action,
  });
}

async function handlePrimaryAction(): Promise<void> {
  if (!hasNotes.value) {
    await createFirstNote();
    return;
  }

  const primaryRecommendation = smartRecommendationsPreview.value[0] ?? null;
  if (primaryRecommendation) {
    await openSmartRecommendation(primaryRecommendation);
    return;
  }

  const primaryNote = sortedNotesByUpdated.value[0] ?? null;
  if (primaryNote) {
    await openNoteInWorkspace(primaryNote.id);
  }
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

function getStableQuoteIndex(seed: string, count: number): number {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash % count;
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

onMounted(() => {
  void loadWallpaper();
});

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
  width: min(100%, 2560px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(300px, 20vw, 420px);
  gap: clamp(16px, 2vw, 32px);
  align-items: start;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  display: grid;
  gap: 20px;
}

.hero-card {
  min-height: clamp(176px, 13vw, 240px);
  display: grid;
  grid-template-columns: minmax(292px, 0.82fr) minmax(380px, 1fr);
  gap: 16px;
  padding: 18px 0 16px 22px;
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
  align-content: start;
  gap: 11px;
  padding-top: clamp(4px, 0.7vw, 12px);
  position: relative;
  z-index: 2;
}

.hero-copy h1 {
  max-width: 380px;
  margin: 0;
  color: var(--workbench-ink);
  display: -webkit-box;
  overflow: hidden;
  font-size: clamp(1.34rem, 1.18vw, 1.6rem);
  font-weight: 740;
  letter-spacing: -0.03em;
  line-height: 1.08;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.hero-greeting {
  margin: 0;
  color: color-mix(in srgb, var(--workbench-ink) 72%, var(--workbench-muted));
  font-size: 1.04rem;
  font-weight: 780;
  line-height: 1.18;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  color: var(--workbench-muted);
  font-size: 0.76rem;
  font-weight: 610;
}

.hero-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
}

.hero-quote {
  width: fit-content;
  max-width: min(100%, 430px);
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px 4px 8px;
  border: 1px solid color-mix(in srgb, var(--workbench-blue) 24%, var(--workbench-border));
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(61, 124, 255, 0.14), rgba(115, 167, 255, 0.08)),
    rgba(255, 255, 255, 0.54);
  color: color-mix(in srgb, var(--workbench-blue) 76%, var(--workbench-ink));
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 700;
  line-height: 1.32;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68), 0 5px 14px rgba(61, 124, 255, 0.08);
  min-width: 0;
}

.hero-quote :deep(.i-icon),
.hero-quote :deep(svg) {
  flex: 0 0 auto;
}

.hero-quote strong {
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--workbench-blue) 84%, var(--workbench-ink));
  font-size: 0.66rem;
  font-weight: 820;
}

.hero-quote strong::after {
  content: "";
  display: inline-block;
  width: 1px;
  height: 10px;
  margin-left: 6px;
  background: color-mix(in srgb, var(--workbench-blue) 28%, transparent);
  vertical-align: -1px;
}

.hero-quote span {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--workbench-ink) 62%, var(--workbench-muted));
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global([data-theme='dark']) .hero-quote {
  background:
    linear-gradient(135deg, rgba(61, 124, 255, 0.18), rgba(115, 167, 255, 0.1)),
    rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
  align-self: stretch;
  min-height: 0;
  margin: -18px 0 -16px;
  overflow: hidden;
  border-radius: 0 20px 20px 0;
  opacity: 0.94;
}

.hero-art__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.hero-art__source-button {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: 9px;
  background: rgba(14, 18, 29, 0.48);
  color: #ffffff;
  opacity: 0;
  transform: translateY(-4px);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.18s ease;
}

.hero-art:hover .hero-art__source-button,
.hero-art:focus-within .hero-art__source-button {
  opacity: 1;
  transform: translateY(0);
}

.hero-art__source-button:disabled {
  cursor: default;
}

.hero-art:hover .hero-art__source-button:disabled,
.hero-art:focus-within .hero-art__source-button:disabled {
  opacity: 0.72;
}

.hero-art__source-button:not(:disabled):hover {
  background: rgba(14, 18, 29, 0.62);
}

.hero-art__info {
  position: absolute;
  max-width: calc(100% - 24px);
  bottom: 12px;
  left: 12px;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 650;
  opacity: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
  transform: translateY(4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.hero-art__info-title,
.hero-art__info-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-art__info-title {
  font-weight: 720;
}

.hero-art__info-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.68rem;
  font-weight: 560;
}

.hero-art__info-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-art__info-meta a {
  flex-shrink: 0;
  color: #ffffff;
  text-decoration: none;
}

.hero-art__info-meta a:hover {
  text-decoration: underline;
}

.hero-art:hover .hero-art__info,
.hero-art:focus-within .hero-art__info {
  opacity: 1;
  transform: translateY(0);
}

.overview-section {
  display: grid;
  gap: 12px;
}

.panel__header h2 {
  margin: 0;
  color: var(--workbench-ink);
  font-size: 1.08rem;
  font-weight: 760;
  letter-spacing: -0.035em;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(8px, 1.2vw, 20px);
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

.feed-list {
  display: grid;
}

.feed-list {
  padding: 0 18px 16px;
}

.feed-row {
  width: 100%;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 6px;
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
  gap: 5px;
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

.panel--smart .module-empty {
  margin-top: 8px;
}

.smart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(280px, 0.94fr);
  gap: 12px;
  padding: 8px 18px 18px;
}

.smart-focus {
  min-width: 0;
  min-height: 166px;
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--workbench-blue) 18%, var(--workbench-border));
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(244, 248, 255, 0.7)),
    color-mix(in srgb, var(--workbench-blue) 6%, var(--workbench-card));
  color: var(--workbench-ink);
  text-align: left;
  font: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

:global([data-theme='dark']) .smart-focus {
  background:
    linear-gradient(135deg, rgba(36, 42, 58, 0.86), rgba(30, 35, 49, 0.72)),
    color-mix(in srgb, var(--workbench-blue) 9%, var(--workbench-card));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.smart-focus:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--workbench-blue) 32%, var(--workbench-border));
  box-shadow: 0 12px 28px rgba(61, 124, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.smart-focus__open {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.smart-focus__body {
  min-width: 0;
  display: grid;
  gap: 10px;
  margin-top: -6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.smart-focus__head,
.smart-focus__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.smart-focus__head {
  gap: 8px;
  justify-content: space-between;
  margin-top: -6px;
}

.smart-focus__head .smart-feedback {
  margin-left: auto;
}

.smart-focus__icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: color-mix(in srgb, var(--workbench-blue) 12%, transparent);
  color: var(--workbench-blue);
}

.smart-focus__reason {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-blue);
  font-size: 0.75rem;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-focus__score {
  margin-left: auto;
  color: color-mix(in srgb, var(--workbench-ink) 62%, var(--workbench-muted));
  font-size: 0.72rem;
  font-weight: 760;
}

.smart-focus__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 1rem;
  font-weight: 780;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-focus__preview {
  min-height: 38px;
  overflow: hidden;
  color: color-mix(in srgb, var(--workbench-ink) 60%, var(--workbench-muted));
  display: -webkit-box;
  font-size: 0.8rem;
  font-weight: 560;
  line-height: 1.55;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.smart-focus__meta {
  flex-wrap: wrap;
  gap: 6px;
}

.smart-focus__meta span {
  display: inline-flex;
  align-items: center;
  min-height: 23px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 720;
}

.smart-focus__meta span {
  background: rgba(61, 124, 255, 0.08);
  color: color-mix(in srgb, var(--workbench-ink) 64%, var(--workbench-muted));
}

.smart-feedback {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.smart-focus:hover .smart-feedback,
.smart-focus:focus-within .smart-feedback,
.smart-lane:hover .smart-lane__actions,
.smart-lane:focus-within .smart-lane__actions {
  opacity: 1;
  pointer-events: auto;
}

.smart-feedback__button {
  min-height: 25px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--workbench-blue) 18%, var(--workbench-border));
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  color: color-mix(in srgb, var(--workbench-blue) 78%, var(--workbench-ink));
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 720;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.smart-feedback__button:hover {
  border-color: color-mix(in srgb, var(--workbench-blue) 32%, var(--workbench-border));
  background: rgba(61, 124, 255, 0.09);
}

.smart-feedback__button--muted {
  border-color: color-mix(in srgb, var(--workbench-muted) 24%, var(--workbench-border));
  color: color-mix(in srgb, var(--workbench-ink) 58%, var(--workbench-muted));
}

.smart-feedback__button--compact {
  min-height: 23px;
  padding: 0 7px;
  font-size: 0.68rem;
}

.smart-lanes {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.smart-lane {
  position: relative;
  min-width: 0;
  min-height: 50px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--workbench-border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.46);
  color: var(--workbench-ink);
  text-align: left;
  font: inherit;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

:global([data-theme='dark']) .smart-lane {
  background: rgba(255, 255, 255, 0.04);
}

.smart-lane:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--workbench-blue) 24%, var(--workbench-border));
  background: rgba(61, 124, 255, 0.06);
}

.smart-lane__open {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.smart-lane__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--workbench-blue) 10%, transparent);
  color: var(--workbench-blue);
}

.smart-lane__main {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.smart-lane__reason {
  color: var(--workbench-blue);
  font-size: 0.72rem;
  font-weight: 760;
}

.smart-lane__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.84rem;
  font-weight: 730;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-lane__meta {
  display: grid;
  justify-items: end;
  gap: 2px;
  color: var(--workbench-muted);
  font-size: 0.7rem;
  font-weight: 680;
  white-space: nowrap;
  transition: opacity 0.18s ease;
}

.smart-lane__actions {
  position: absolute;
  top: 50%;
  right: 8px;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(4px);
  transition: opacity 0.18s ease;
}

.smart-lane:hover .smart-lane__meta,
.smart-lane:focus-within .smart-lane__meta {
  opacity: 0;
}

.smart-lane:hover .smart-lane__actions,
.smart-lane:focus-within .smart-lane__actions {
  transform: translateY(-50%) translateX(0);
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

.side-card__title-icon--stats,
.side-card__title-icon--growth,
.side-card__title-icon--tags,
.side-card__title-icon--topic {
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

.side-card__link {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--workbench-blue) 86%, var(--workbench-ink));
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 760;
}

.side-card__link:hover {
  color: var(--workbench-blue);
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

.active-tag-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.active-tag-row {
  width: 100%;
  min-width: 0;
  min-height: 43px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  align-items: center;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--workbench-ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.active-tag-row:hover {
  border-color: color-mix(in srgb, var(--workbench-blue) 20%, var(--workbench-border));
  background: rgba(61, 124, 255, 0.05);
}

.active-tag-row__main {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.active-tag-row__name {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.82rem;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-tag-row__meta {
  display: flex;
  min-width: 0;
  gap: 6px;
  color: var(--workbench-muted);
  font-size: 0.68rem;
  font-weight: 650;
  white-space: nowrap;
}

.topic-list {
  display: grid;
  gap: 9px;
}

.topic-row {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 78px;
  gap: 10px;
  align-items: center;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--workbench-ink);
  font: inherit;
  text-align: left;
}

.topic-row__main {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.topic-row__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.82rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-row__meta {
  display: flex;
  min-width: 0;
  gap: 6px;
  color: var(--workbench-muted);
  font-size: 0.7rem;
  font-weight: 640;
  white-space: nowrap;
}

.topic-row__heat {
  min-width: 0;
  display: grid;
  justify-items: end;
  gap: 5px;
}

.topic-row__bar {
  width: 64px;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(61, 124, 255, 0.14);
}

.topic-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5aa7ff 0%, #3d7cff 100%);
  box-shadow: 0 0 14px rgba(61, 124, 255, 0.24);
}

.topic-row__heat strong {
  color: color-mix(in srgb, var(--workbench-ink) 70%, var(--workbench-muted));
  font-size: 0.68rem;
  font-weight: 780;
  white-space: nowrap;
}

.side-card__empty {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--workbench-border-strong);
  border-radius: 12px;
  color: var(--workbench-muted);
  font-size: 0.78rem;
  font-weight: 620;
  background: rgba(255, 255, 255, 0.28);
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
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }

  .overview-card {
    padding: 9px 10px;
  }

  .overview-card__content {
    font-size: 0.86rem;
  }
}

@media (max-width: 1120px) {
  .workbench-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .side-card--topic {
    grid-column: 1 / -1;
  }

  .side-card--tags {
    grid-column: 1 / -1;
  }

  .side-card--topic .topic-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card {
    grid-template-columns: minmax(0, 1fr);
    padding-right: 24px;
  }

  .hero-art {
    min-height: 152px;
    margin: 0;
    aspect-ratio: 20 / 9;
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

  .workbench-side {
    grid-template-columns: 1fr;
  }

  .side-card--topic {
    grid-column: auto;
  }

  .side-card--tags {
    grid-column: auto;
  }

  .side-card--topic .topic-list {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1121px) and (max-height: 900px) {
  .workbench-dashboard {
    padding: 10px 14px 14px;
  }

  .workbench-layout {
    gap: 12px;
  }

  .workbench-main {
    gap: 12px;
  }

  .hero-card {
    min-height: clamp(132px, 10vw, 158px);
    gap: 10px;
    padding: 12px 0 12px 18px;
    border-radius: 16px;
  }

  .hero-copy {
    gap: 6px;
    padding-top: 4px;
  }

  .hero-copy h1 {
    font-size: clamp(1.12rem, 0.96vw, 1.34rem);
  }

  .hero-greeting {
    font-size: 0.88rem;
  }

  .hero-quote {
    font-size: 0.66rem;
  }

  .hero-meta {
    font-size: 0.7rem;
  }

  .hero-meta span {
    min-height: 18px;
  }

  .hero-actions {
    gap: 6px;
  }

  .hero-action {
    min-width: 102px;
    min-height: 31px;
    padding: 0 12px;
    font-size: 0.72rem;
  }

  .hero-art {
    margin: -12px 0;
    border-radius: 0 16px 16px 0;
  }

  .overview-grid {
    gap: 8px;
  }

  .overview-card {
    gap: 3px;
    padding: 7px 9px;
    border-radius: 10px;
  }

  .overview-card__head {
    font-size: 0.68rem;
  }

  .overview-card__content {
    font-size: 0.8rem;
  }

  .panel {
    border-radius: 14px;
  }

  .panel-row {
    gap: 10px;
  }

  .panel__header {
    gap: 8px;
    padding: 10px 14px 4px;
  }

  .panel__header h2 {
    font-size: 0.94rem;
  }

  .panel-badge {
    min-height: 20px;
    padding: 0 8px;
    font-size: 0.68rem;
  }

  .feed-list {
    padding: 0 14px 10px;
  }

  .feed-row {
    min-height: 48px;
    gap: 8px;
    padding: 5px 4px;
  }

  .feed-row__icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
  }

  .feed-row__main {
    gap: 3px;
  }

  .feed-row__title {
    font-size: 0.78rem;
  }

  .feed-row__subtitle,
  .feed-row__time {
    font-size: 0.7rem;
  }

  .smart-grid {
    grid-template-columns: minmax(0, 1.02fr) minmax(260px, 0.98fr);
    gap: 10px;
    padding: 6px 14px 12px;
  }

  .smart-focus {
    min-height: 132px;
    gap: 7px;
    padding: 13px;
    border-radius: 12px;
  }

  .smart-focus__open {
    gap: 7px;
  }

  .smart-focus__body {
    gap: 7px;
  }

  .smart-focus__icon {
    width: 29px;
    height: 29px;
    border-radius: 9px;
  }

  .smart-focus__reason {
    font-size: 0.7rem;
  }

  .smart-focus__score {
    font-size: 0.68rem;
  }

  .smart-focus__title {
    font-size: 0.9rem;
    line-height: 1.2;
  }

  .smart-focus__preview {
    min-height: 31px;
    font-size: 0.74rem;
    line-height: 1.38;
  }

  .smart-focus__meta {
    gap: 5px;
  }

  .smart-focus__meta span {
    min-height: 20px;
    padding: 0 7px;
    font-size: 0.66rem;
  }

  .smart-feedback {
    gap: 4px;
  }

  .smart-feedback__button {
    min-height: 22px;
    padding: 0 7px;
    font-size: 0.66rem;
  }

  .smart-feedback__button--compact {
    min-height: 21px;
    padding: 0 6px;
    font-size: 0.64rem;
  }

  .smart-lanes {
    gap: 6px;
  }

  .smart-lane {
    min-height: 39px;
    gap: 6px;
    padding: 7px 9px;
    border-radius: 11px;
  }

  .smart-lane__open {
    grid-template-columns: 26px minmax(0, 1fr) auto;
    gap: 8px;
  }

  .smart-lane__icon {
    width: 26px;
    height: 26px;
    border-radius: 8px;
  }

  .smart-lane__reason {
    font-size: 0.66rem;
  }

  .smart-lane__title {
    font-size: 0.76rem;
  }

  .smart-lane__meta {
    font-size: 0.64rem;
  }

  .workbench-side {
    gap: 10px;
  }

  .side-card {
    gap: 8px;
    padding: 12px 14px;
    border-radius: 14px;
  }

  .side-card__header {
    gap: 7px;
  }

  .side-card__header h3 {
    gap: 7px;
    font-size: 0.84rem;
  }

  .side-card__title-icon {
    width: 20px;
    height: 20px;
    border-radius: 7px;
  }

  .side-card__muted {
    font-size: 0.74rem;
    line-height: 1.35;
  }

  .stats-list {
    gap: 6px;
  }

  .stats-row {
    gap: 6px;
    font-size: 0.74rem;
  }

  .stats-row strong {
    font-size: 0.8rem;
  }

  .growth-chart {
    height: 78px;
    border-radius: 11px;
  }

  .growth-chart svg {
    padding: 12px 10px 10px;
  }

  .active-tag-list {
    gap: 5px;
  }

  .active-tag-row {
    min-height: 34px;
    gap: 3px;
    padding: 5px 7px;
    border-radius: 10px;
  }

  .active-tag-row__name {
    font-size: 0.74rem;
  }

  .active-tag-row__meta {
    gap: 5px;
    font-size: 0.62rem;
  }

  .topic-list {
    gap: 5px;
  }

  .topic-row {
    min-height: 34px;
    grid-template-columns: minmax(0, 1fr) 68px;
    gap: 7px;
    padding: 5px 7px;
    border-radius: 10px;
  }

  .topic-row__main {
    gap: 2px;
  }

  .topic-row__title {
    font-size: 0.74rem;
  }

  .topic-row__meta {
    gap: 5px;
    font-size: 0.64rem;
  }

  .topic-row__heat {
    gap: 3px;
  }

  .topic-row__bar {
    width: 56px;
    height: 4px;
  }

  .topic-row__heat strong {
    font-size: 0.62rem;
  }

  .module-empty,
  .side-card__empty {
    min-height: 54px;
    font-size: 0.74rem;
  }

  .module-empty {
    margin: 0 14px 10px;
    border-radius: 11px;
  }

  .side-card__empty {
    border-radius: 10px;
  }
}

@media (max-width: 620px) {
  .active-tag-list {
    grid-template-columns: 1fr;
  }

  .hero-quote {
    max-width: 100%;
  }

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
  .smart-grid {
    padding-right: 16px;
    padding-left: 16px;
  }

  .feed-row {
    align-items: flex-start;
    min-height: 62px;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .feed-row__time {
    display: none;
  }

  .side-card {
    padding: 16px;
  }
}
</style>
