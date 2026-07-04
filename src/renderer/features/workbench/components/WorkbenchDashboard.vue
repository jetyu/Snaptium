<template>
  <div class="workbench-dashboard">
    <div class="workbench-layout">
      <main class="workbench-main">
        <section class="hero-card">
          <div class="hero-copy">
            <em class="hero-quote">
              <IconBookmark :size="12" />
              <strong>{{ t('workbench.hero.dailyQuote') }}</strong>
              <span>{{ dailyQuoteText }}</span>
            </em>
            <div class="hero-copy-body">
              <p class="hero-greeting">{{ greetingText }}</p>
              <h1>{{ heroLeadText }}</h1>
              <div class="hero-meta">
                <span v-if="hasNotes">{{ t('workbench.label.recentEdited') }} {{ recentEditedTime }}</span>
              </div>
              <div class="hero-actions">
                <button type="button" class="hero-action hero-action--primary" @click="handlePrimaryAction">
                  <IconPencil :size="14" />
                  <span>{{ t('workbench.action.continueWriting') }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="hero-art">
            <img class="hero-art__image" :src="wallpaperSrc" :alt="wallpaperAlt" @error="handleWallpaperImageError" />
            <button type="button" class="hero-art__source-button" :disabled="wallpaperLoading"
              :aria-label="t('workbench.action.nextWallpaper')" @click="loadNextWallpaper">
              <IconPhoto :size="15" />
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

        <div class="panel-row panel-row--recent">
          <section class="panel panel--half">
            <header class="panel__header">
              <h2 class="module-title">
                <span class="module-title__icon">
                  <IconClock :size="14" />
                </span>
                {{ t('workbench.module.recentActivity') }}
              </h2>
            </header>

            <div v-if="recentActivityPreview.length > 0" class="feed-list feed-list--interactive">
              <button v-for="entry in recentActivityPreview" :key="entry.id" type="button" class="feed-row"
                :title="getActivityTooltip(entry)" @click="handleActivityClick(entry)">
                <span class="feed-row__icon">
                  <IconPencil v-if="entry.kind === 'saved'" :size="14" />
                  <IconBrain v-else :size="14" />
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
              <h2 class="module-title">
                <span class="module-title__icon">
                  <IconSubtitlesAi :size="14" />
                </span>
                {{ t('workbench.module.recentQuestions') }}
              </h2>
            </header>

            <div v-if="recentQuestionEntriesPreview.length > 0" class="feed-list feed-list--interactive">
              <button v-for="question in recentQuestionEntriesPreview" :key="question.id" type="button" class="feed-row"
                :title="question.query" @click="openSearchView({ query: question.query, mode: 'semantic', run: true })">
                <span class="feed-row__icon">
                  <IconSubtitlesAi :size="14" />
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
                  <IconFileText :size="14" />
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
            <h2 class="module-title">
              <span class="module-title__icon">
                <IconBrain :size="14" />
              </span>
              {{ t('workbench.module.smartRecommendation') }}
            </h2>
          </header>

          <div v-if="primarySmartRecommendation" class="smart-grid">
            <article class="smart-focus" :title="primarySmartRecommendation.note.title">
              <span class="smart-focus__head">
                <button type="button" class="smart-focus__open"
                  @click="openSmartRecommendation(primarySmartRecommendation)">
                  <span class="smart-focus__icon">
                    <component :is="getSmartReasonIcon(primarySmartRecommendation.reasonType)" :size="18" />
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
              <div class="smart-focus__body" role="button" tabindex="0"
                @click="openSmartRecommendation(primarySmartRecommendation)"
                @keydown.enter.prevent="openSmartRecommendation(primarySmartRecommendation)"
                @keydown.space.prevent="openSmartRecommendation(primarySmartRecommendation)">
                <span class="smart-focus__title">{{ primarySmartRecommendation.note.title }}</span>
                <span class="smart-focus__meta">
                  <span>{{ formatRelativeTime(primarySmartRecommendation.note.updatedAt) }}</span>
                  <span v-for="topic in topTopicLabels.slice(0, 3)" :key="topic">{{ topic }}</span>
                </span>
                <div class="smart-focus__preview smart-focus__preview--markdown markdown-body"
                  v-html="getSmartNotePreviewHtml(primarySmartRecommendation.note)" />
              </div>
            </article>

            <div class="smart-lanes">
              <article v-for="item in smartRecommendationLaneItems" :key="item.note.id" class="smart-lane"
                :title="item.note.title">
                <button type="button" class="smart-lane__open" @click="openSmartRecommendation(item)">
                  <span class="smart-lane__icon">
                    <component :is="getSmartReasonIcon(item.reasonType)" :size="14" />
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
        <section class="side-card side-card--insights">
          <header class="side-card__header side-card__header--insights">
            <h3 class="module-title">
              <span class="module-title__icon">
                <IconChartRadar :size="14" />
              </span>
              {{ t('workbench.sidebar.achievements') }}
            </h3>
          </header>

          <div class="insights-block insights-block--stats">
            <article v-if="primaryInsightSummaryItem" class="insight-achievement-hero">
              <span class="insight-achievement-hero__main">
                <span class="insight-achievement-hero__label">{{ primaryInsightSummaryItem.label }}</span>
                <strong class="insight-achievement-hero__value">{{ primaryInsightSummaryItem.value }}</strong>
              </span>
              <span class="insight-achievement-hero__icon">
                <component :is="primaryInsightSummaryItem.icon" :size="20" />
              </span>
            </article>

            <div class="insight-summary-grid">
              <article v-for="item in secondaryInsightSummaryItems" :key="item.id" class="insight-summary-item">
                <span class="insight-summary-item__icon">
                  <component :is="item.icon" :size="13" />
                </span>
                <span class="insight-summary-item__label">{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </article>
            </div>
          </div>
        </section>

        <section class="side-card side-card--tags">
          <header class="side-card__header">
            <h3 class="module-title">
              <span class="module-title__icon">
                <IconTag :size="14" />
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
            <h3 class="module-title">
              <span class="module-title__icon">
                <IconHierarchy :size="14" />
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
  <WorkbenchOnboardingGuide v-if="shouldShowOnboardingGuide" @create-template="handleOnboardingCreateTemplate"
    @dismiss="dismissOnboardingGuide" @import-markdown="handleOnboardingImportMarkdown"
    @open-sync="handleOnboardingOpenSync" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import defaultHeroUrl from '@assets/images/default-hero.png';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';
import {
  IconPencil,
  IconPhoto,
  IconBrain,
  IconLink,
  IconFileText,
  IconChartRadar,
  IconHierarchy,
  IconAlignBoxBottomCenter,
  IconSubtitlesAi,
  IconChartHistogram,
  IconClock,
  IconFlame,
  IconFolderOpen,
  IconBookmark,
  IconTag,
} from '@tabler/icons-vue';
import { useSearch } from '@renderer/features/search';
import {
  buildNoteTemplate,
  useWorkspace,
  useWorkspaceStore,
  workspaceService,
  type Note,
  type NoteTemplate,
  type NoteTemplateId,
} from '@renderer/features/workspace';
import { useSettings, useSettingsStore } from '@renderer/features/settings';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { electronApi, type WallpaperResult } from '@renderer/core/bridge/electronApi';
import WorkbenchOnboardingGuide from './WorkbenchOnboardingGuide.vue';
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

interface InsightSummaryItem {
  id: string;
  label: string;
  value: string;
  icon: Component;
}

interface ActiveTagEntry {
  name: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const WORKBENCH_DISPLAY_LIMITS = {
  RECENT_ACTIVITY: 5,
  RECENT_QUESTIONS: 5,
  SMART_RECOMMENDATIONS: 6,
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

const { t } = useI18n();
const { openSearchView } = useSearch();
const { notes, notebooks, allTags, createNote, selectNote } = useWorkspace();
const { openSettings } = useSettings();
const appShellStore = useAppShellStore();
const workspaceStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const workbenchStore = useWorkbenchStore();
const { recentQuestions, recommendationFeedback } = storeToRefs(workbenchStore);
const wallpaper = ref<WallpaperResult | null>(null);
const wallpaperLoading = ref<boolean>(false);
const wallpaperSrc = ref<string>(defaultHeroUrl);

const hasNotes = computed<boolean>(() => notes.value.length > 0);
const isEmptyWorkspace = computed<boolean>(() => notes.value.length === 0 && notebooks.value.length === 0);
const shouldShowOnboardingGuide = computed<boolean>(() => {
  return workspaceStore.initialized
    && (settingsStore.config.workbench.onboardingGuideActivated || isEmptyWorkspace.value)
    && !settingsStore.config.workbench.onboardingGuideDismissed;
});
const shouldActivateOnboardingGuide = computed<boolean>(() => {
  return workspaceStore.initialized
    && isEmptyWorkspace.value
    && !settingsStore.config.workbench.onboardingGuideActivated
    && !settingsStore.config.workbench.onboardingGuideDismissed;
});
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
  const activeDays = new Set(notes.value.map((note) => getLocalDateKey(note.updatedAt)));

  let streakDays = 0;
  let cursor = todayStart;
  while (activeDays.has(getLocalDateKey(cursor))) {
    streakDays += 1;
    cursor -= DAY_MS;
  }

  return {
    totalCharacters: notes.value.reduce((total, note) => total + getCharacterCount(note.content), 0),
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

const todayQuestionCount = computed<number>(() => {
  const todayStart = getDayStartTimestamp(Date.now());
  return recentQuestionEntries.value.filter((entry) => entry.askedAt >= todayStart).length;
});

const insightSummaryItems = computed<InsightSummaryItem[]>(() => {
  return [
    {
      id: 'total-writing',
      label: t('workbench.behavior.totalCharacters'),
      value: formatNumber(behaviorFeedback.value.totalCharacters),
      icon: IconAlignBoxBottomCenter,
    },
    {
      id: 'documents',
      label: t('workbench.stats.noteCount'),
      value: formatNumber(notes.value.length),
      icon: IconFileText,
    },
    {
      id: 'today-updated',
      label: t('workbench.stats.todayUpdatedNotes'),
      value: formatNumber(todayUpdatedNoteCount.value),
      icon: IconPencil,
    },
    {
      id: 'today-questions',
      label: t('workbench.stats.todayQuestions'),
      value: formatNumber(todayQuestionCount.value),
      icon: IconSubtitlesAi,
    },
    {
      id: 'streak',
      label: t('workbench.behavior.streakDays'),
      value: formatNumber(behaviorFeedback.value.streakDays),
      icon: IconChartHistogram,
    },
  ];
});
const primaryInsightSummaryItem = computed<InsightSummaryItem | null>(() => insightSummaryItems.value[0] ?? null);
const secondaryInsightSummaryItems = computed<InsightSummaryItem[]>(() => insightSummaryItems.value.slice(1));

const recentEditedTime = computed<string>(() => {
  const targetNote = sortedNotesByUpdated.value[0];
  if (!targetNote) {
    return t('workbench.empty.noData');
  }
  return formatRelativeTime(targetNote.updatedAt);
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
    return IconPencil;
  }
  if (reasonType === 'semantic_related') {
    return IconLink;
  }
  if (reasonType === 'long_gap') {
    return IconClock;
  }
  if (reasonType === 'recent_focus') {
    return IconFlame;
  }
  if (reasonType === 'same_notebook') {
    return IconFolderOpen;
  }
  return IconBookmark;
}

function formatSmartScore(score: number): string {
  return `${Math.max(1, Math.min(99, Math.round(score * 100)))}%`;
}

function getSmartNotePreviewHtml(note: Note): string {
  const previewMarkdown = note.content
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '- ')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => {
      if (line.trim()) {
        return true;
      }
      const previousLine = lines[index - 1];
      return Boolean(previousLine?.trim());
    })
    .slice(0, 15)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1440);

  if (!previewMarkdown) {
    return t('workbench.empty.noContent');
  }

  const renderedHtml = renderMarkdown(previewMarkdown, {
    allowHtml: false,
    allowInlineSvg: false,
    remoteImageMode: 'blocked',
    blockedImageLabel: t('preview.remoteImageBlocked'),
    copyCodeButtonLabel: t('preview.copyCode'),
    contentId: note.contentId,
    workspaceRoot: workspaceService.getCurrentWorkspaceRoot(),
  });

  return renderedHtml.trim();
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

async function createTemplateNote(template: NoteTemplate): Promise<void> {
  await createNote(null, template.title, template.content);
  await appShellStore.setActiveMainView('workspace');
}

async function dismissOnboardingGuide(): Promise<void> {
  if (settingsStore.config.workbench.onboardingGuideDismissed) {
    return;
  }

  await settingsStore.updateSetting('workbench', {
    ...settingsStore.config.workbench,
    onboardingGuideActivated: true,
    onboardingGuideDismissed: true,
  });
}

async function activateOnboardingGuide(): Promise<void> {
  if (settingsStore.config.workbench.onboardingGuideActivated) {
    return;
  }

  await settingsStore.updateSetting('workbench', {
    ...settingsStore.config.workbench,
    onboardingGuideActivated: true,
  });
}

async function handleOnboardingCreateTemplate(templateId: NoteTemplateId): Promise<void> {
  await createTemplateNote(buildNoteTemplate(templateId, t));
}

async function handleOnboardingImportMarkdown(): Promise<void> {
  await workspaceStore.importMarkdown();
  if (notes.value.length > 0) {
    await appShellStore.setActiveMainView('workspace');
  }
}

async function handleOnboardingOpenSync(): Promise<void> {
  openSettings('sync');
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
    await openSearchView({ query: entry.question.query, mode: 'semantic', run: true });
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

watch(
  shouldActivateOnboardingGuide,
  (shouldActivate) => {
    if (shouldActivate) {
      void activateOnboardingGuide();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.workbench-dashboard {
  --workbench-page: color-mix(in srgb, var(--surface-base) 92%, white);
  --workbench-page-end: color-mix(in srgb, var(--surface-soft) 86%, var(--surface-raised));
  --workbench-card: var(--workbench-card-solid);
  --workbench-card-solid: var(--surface-raised);
  --workbench-panel: var(--workbench-card-solid);
  --workbench-border: var(--status-neutral-border);
  --workbench-border-strong: color-mix(in srgb, var(--status-neutral-border) 82%, var(--border-strong));
  --workbench-ink: var(--text-primary);
  --workbench-muted: var(--text-secondary);
  --workbench-soft: var(--surface-soft);
  --workbench-blue: var(--accent);
  --workbench-blue-soft: color-mix(in srgb, var(--accent) 64%, white);
  --workbench-teal: var(--status-success-text);
  --workbench-amber: var(--status-warning-text);
  --workbench-rose: var(--status-danger-text);
  --workbench-shadow: var(--shadow-md);
  --workbench-shadow-soft: var(--shadow-soft);
  --workbench-page-padding: var(--workbench-gap);
  --workbench-gap: 10px;
  --workbench-card-radius: 16px;
  --workbench-sidebar-min: 300px;
  --workbench-overview-card-height: 220px;
  --workbench-overview-row-height: 103px;
  --workbench-feed-card-height: clamp(344px, 19vw, 420px);
  --workbench-recommendation-card-height: var(--workbench-feed-card-height);
  --workbench-panel-header-padding: 14px 18px 8px;
  --workbench-panel-body-padding: 0 18px 14px;
  --workbench-feed-row-min-height: 38px;
  --workbench-side-card-padding: 16px 18px;
  --workbench-hero-copy-offset: 6px;
  flex: 1;
  min-height: 0;
  padding: var(--workbench-page-padding);
  background: linear-gradient(180deg, var(--workbench-page) 0%, var(--workbench-page-end) 100%);
  color: var(--workbench-ink);
  overflow-y: auto;
}

:global([data-theme='dark']) .workbench-dashboard {
  --workbench-page: color-mix(in srgb, var(--surface-base) 94%, black);
  --workbench-page-end: color-mix(in srgb, var(--surface-soft) 72%, var(--surface-base));
  --workbench-card: var(--workbench-card-solid);
  --workbench-card-solid: var(--surface-raised);
  --workbench-panel: var(--workbench-card-solid);
  --workbench-border: var(--status-neutral-border);
  --workbench-border-strong: color-mix(in srgb, var(--status-neutral-border) 88%, var(--border-strong));
  --workbench-ink: var(--text);
  --workbench-muted: var(--text-muted);
  --workbench-soft: var(--surface-soft);
  --workbench-shadow: var(--shadow-md);
  --workbench-shadow-soft: var(--shadow-soft);
}

:global(.main-shell.main-shell--maximized) .workbench-dashboard {
  --workbench-overview-card-height: 220px;
  --workbench-overview-row-height: 103px;
  --workbench-hero-copy-offset: 6px;
}

.workbench-layout {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(var(--workbench-sidebar-min), 1fr);
  grid-template-areas:
    "hero insights"
    "hero insights"
    "recent tags"
    "smart topic";
  grid-template-rows:
    var(--workbench-overview-row-height) var(--workbench-overview-row-height) var(--workbench-feed-card-height) var(--workbench-recommendation-card-height);
  gap: var(--workbench-gap);
  align-items: stretch;
  min-height: 0;
}

.workbench-main,
.workbench-side {
  min-width: 0;
  display: contents;
}

.hero-card {
  grid-area: hero;
  height: var(--workbench-overview-card-height);
  min-height: var(--workbench-overview-card-height);
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: var(--workbench-gap);
  padding: 14px 0 10px 20px;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: var(--workbench-card-radius);
  background: var(--workbench-card-solid);
  box-shadow: var(--workbench-shadow-soft);
}

:global([data-theme='dark']) .hero-card {
  background: var(--workbench-card-solid);
}

.hero-copy {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  padding-top: 0;
  position: relative;
  z-index: 2;
}

.hero-copy-body {
  display: grid;
  gap: 7px;
  padding-top: var(--workbench-hero-copy-offset);
}

.hero-copy h1 {
  max-width: 380px;
  margin: 0;
  color: var(--workbench-ink);
  display: -webkit-box;
  overflow: hidden;
  font-size: 1.42rem;
  font-weight: 740;
  letter-spacing: 0;
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
  border: 1px solid var(--workbench-border);
  border-radius: 999px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 72%, var(--workbench-ink));
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 700;
  line-height: 1.32;
  box-shadow: none;
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
  background: var(--workbench-soft);
  box-shadow: none;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 0;
  margin-top: 20px;
}

.hero-action {
  min-width: 88px;
  min-height: 34px;
  padding: 0.42rem 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  border: 1px solid color-mix(in srgb, var(--workbench-border-strong) 82%, var(--border-strong));
  border-radius: 8px;
  background: var(--surface-overlay);
  color: color-mix(in srgb, var(--workbench-ink) 92%, var(--text-primary));
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    border-color 0.18s ease,
    color 0.15s ease,
    box-shadow 0.18s ease;
}

.hero-action:hover,
.hero-action:focus-visible {
  background: var(--surface-scrim);
  border-color: color-mix(in srgb, var(--accent) 56%, var(--border-strong));
  color: var(--workbench-ink);
}

.hero-action:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.hero-action:active {
  background: color-mix(in srgb, var(--surface-soft) 92%, var(--surface-raised));
}

.hero-action--primary {
  box-shadow: var(--shadow-soft);
}

:global([data-theme='dark']) .hero-action {
  background: var(--surface-overlay);
  border-color: color-mix(in srgb, var(--status-neutral-border) 100%, var(--border-strong));
  color: color-mix(in srgb, var(--workbench-ink) 96%, white);
  box-shadow: var(--shadow-soft);
}

:global([data-theme='dark']) .hero-action:hover,
:global([data-theme='dark']) .hero-action:focus-visible {
  background: color-mix(in srgb, var(--surface-soft) 88%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--accent) 52%, var(--border-strong));
  color: color-mix(in srgb, var(--workbench-ink) 98%, white);
}

:global([data-theme='dark']) .hero-action:active {
  background: color-mix(in srgb, var(--surface-soft) 96%, var(--surface-raised));
}

.hero-art {
  position: relative;
  align-self: stretch;
  height: var(--workbench-overview-card-height);
  min-height: 0;
  margin: -14px 0 -10px;
  overflow: hidden;
  border-radius: 0 var(--workbench-card-radius) var(--workbench-card-radius) 0;
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
  border: 1px solid color-mix(in srgb, white 18%, transparent);
  border-radius: 9px;
  background: rgba(17, 23, 38, 0.9);
  color: var(--notebook-icon-white);
  opacity: 0;
  transform: translateY(-4px);
  cursor: pointer;
  backdrop-filter: none;
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
  color: var(--notebook-icon-white);
  font-size: 0.72rem;
  font-weight: 650;
  opacity: 0;
  text-shadow: none;
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
  color: var(--notebook-icon-white);
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

.module-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--workbench-ink);
  font-size: 0.98rem;
  font-weight: 760;
  letter-spacing: 0;
  line-height: 1.2;
}

.module-title__icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
}

.panel {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: var(--workbench-card-radius);
  background: var(--workbench-panel);
  box-shadow: var(--workbench-shadow-soft);
  backdrop-filter: none;
}

.panel-row {
  display: grid;
  gap: var(--workbench-gap);
}

.panel-row--recent {
  grid-area: recent;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.panel-row--recent .panel__header {
  padding: 16px 18px 12px;
}

.panel-row--recent .feed-list {
  gap: 7px;
}

.panel-row--recent .feed-row {
  gap: 9px;
  padding: 5px 9px;
  border: 1px solid transparent;
  border-radius: 12px;
}

.panel-row--recent .module-empty {
  margin: 0 18px 14px;
}

.panel--half {
  min-height: 0;
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: var(--workbench-panel-header-padding);
}

.feed-list {
  display: grid;
  align-content: start;
  padding: var(--workbench-panel-body-padding);
}

.feed-row {
  width: 100%;
  min-height: var(--workbench-feed-row-min-height);
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 6px;
  border: 0;
  border-bottom: 1px solid var(--workbench-border);
  border-radius: 0;
  background: transparent;
  color: var(--workbench-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.feed-row:last-child {
  border-color: transparent;
}

.feed-list--interactive .feed-row:hover {
  border-color: var(--workbench-border);
  border-radius: 12px;
  background: var(--workbench-soft);
  box-shadow: none;
}

.feed-row__icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--workbench-soft);
  color: var(--workbench-blue);
}

.feed-row__main {
  min-width: 0;
  display: grid;
  flex: 1;
  gap: 4px;
}

.feed-row__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.82rem;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-row__subtitle {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-muted);
  font-size: 0.68rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-row__time {
  flex-shrink: 0;
  color: var(--workbench-muted);
  font-size: 0.68rem;
  font-weight: 650;
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
  border: 1px solid var(--workbench-border);
  border-radius: 999px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 78%, var(--workbench-ink));
  font-size: 0.74rem;
  font-weight: 760;
}

:global([data-theme='dark']) .topic-chips span {
  color: color-mix(in srgb, var(--workbench-blue) 76%, white);
}

.panel--smart .module-empty {
  margin-top: 4px;
}

.panel--smart {
  grid-area: smart;
}

.panel--smart .panel__header {
  padding: var(--workbench-panel-header-padding);
}

.smart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 12px;
  padding: var(--workbench-panel-body-padding);
}

.smart-focus {
  min-width: 0;
  min-height: 120px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--workbench-border);
  border-radius: 12px;
  background: var(--workbench-card-solid);
  color: var(--workbench-ink);
  text-align: left;
  font: inherit;
  box-shadow: var(--workbench-shadow-soft);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

:global([data-theme='dark']) .smart-focus {
  background: var(--workbench-card-solid);
  box-shadow: var(--workbench-shadow-soft);
}

.smart-focus:hover {
  border-color: var(--workbench-border-strong);
  box-shadow: var(--workbench-shadow-soft);
}

.smart-focus__open {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
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
  align-content: start;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 4px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.smart-focus__body:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--workbench-blue) 42%, transparent);
  outline-offset: 4px;
  border-radius: 10px;
}

.smart-focus__head,
.smart-focus__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.smart-focus__head {
  position: relative;
  gap: 8px;
  justify-content: space-between;
}

.smart-focus__head .smart-feedback {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 2;
  margin-left: 0;
  transform: translateY(-50%) translateX(4px);
}

.smart-focus__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
}

.smart-focus__reason {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
  font-size: 0.69rem;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-focus__score {
  margin-left: 0;
  color: color-mix(in srgb, var(--workbench-ink) 62%, var(--workbench-muted));
  font-size: 0.66rem;
  font-weight: 760;
  transition: opacity 0.18s ease;
}

.smart-focus__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.88rem;
  font-weight: 760;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-focus__preview {
  min-height: calc(1.28em * 12);
  max-height: calc(1.28em * 12);
  overflow: hidden;
  margin-top: 12px;
  color: color-mix(in srgb, var(--workbench-ink) 60%, var(--workbench-muted));
  display: block;
  font-size: 0.68rem;
  font-weight: 540;
  line-height: 1.28;
  overflow-wrap: break-word;
  word-break: break-word;
}

.smart-focus__preview--markdown {
  padding-right: 2px;
}

.smart-focus__preview--markdown :deep(> :first-child) {
  margin-top: 0;
}

.smart-focus__preview--markdown :deep(p) {
  margin: 0 0 0.32rem;
}

.smart-focus__preview--markdown :deep(h1),
.smart-focus__preview--markdown :deep(h2),
.smart-focus__preview--markdown :deep(h3),
.smart-focus__preview--markdown :deep(h4),
.smart-focus__preview--markdown :deep(h5),
.smart-focus__preview--markdown :deep(h6) {
  margin: 0 0 0.32rem;
  border: 0;
  padding: 0;
  color: color-mix(in srgb, var(--workbench-ink) 84%, var(--workbench-muted));
  font-weight: 760;
  line-height: 1.32;
}

.smart-focus__preview--markdown :deep(h1) {
  font-size: 1.28em;
}

.smart-focus__preview--markdown :deep(h2) {
  font-size: 1.18em;
}

.smart-focus__preview--markdown :deep(h3) {
  font-size: 1.1em;
}

.smart-focus__preview--markdown :deep(h4) {
  font-size: 1.02em;
}

.smart-focus__preview--markdown :deep(h5) {
  font-size: 0.96em;
}

.smart-focus__preview--markdown :deep(h6) {
  font-size: 0.92em;
  color: color-mix(in srgb, var(--workbench-ink) 72%, var(--workbench-muted));
}

.smart-focus__preview--markdown :deep(ul),
.smart-focus__preview--markdown :deep(ol) {
  margin: 0 0 0.36rem;
  padding-left: 1rem;
}

.smart-focus__preview--markdown :deep(li) {
  margin: 0;
}

.smart-focus__preview--markdown :deep(blockquote) {
  margin: 0 0 0.36rem;
  padding-left: 0.56rem;
}

.smart-focus__preview--markdown :deep(pre) {
  margin: 0 0 0.36rem;
}

.smart-focus__preview--markdown :deep(pre code) {
  white-space: pre-wrap;
}

.smart-focus__preview--markdown :deep(code) {
  padding: 0 0.18rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--workbench-soft) 88%, white);
  color: color-mix(in srgb, var(--workbench-ink) 82%, var(--workbench-muted));
  font-size: 0.92em;
}

.smart-focus__preview--markdown :deep(a) {
  color: inherit;
  text-decoration: none;
}

.smart-focus__meta {
  flex-wrap: wrap;
  gap: 4px;
}

.smart-focus__meta span {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 720;
}

.smart-focus__meta span {
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-ink) 64%, var(--workbench-muted));
}

.smart-feedback {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.smart-focus:hover .smart-feedback,
.smart-focus:focus-within .smart-feedback,
.smart-lane:hover .smart-lane__actions,
.smart-lane:focus-within .smart-lane__actions {
  opacity: 1;
  pointer-events: auto;
}

.smart-focus:hover .smart-feedback,
.smart-focus:focus-within .smart-feedback {
  transform: translateY(-50%) translateX(0);
}

.smart-focus:hover .smart-focus__score,
.smart-focus:focus-within .smart-focus__score {
  opacity: 0;
}

.smart-feedback__button {
  min-height: 22px;
  padding: 0 7px;
  border: 1px solid var(--workbench-border);
  border-radius: 999px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 72%, var(--workbench-ink));
  cursor: pointer;
  font: inherit;
  font-size: 0.66rem;
  font-weight: 720;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.smart-feedback__button:hover {
  border-color: var(--workbench-border-strong);
  background: color-mix(in srgb, var(--workbench-soft) 88%, white);
}

.smart-feedback__button--muted {
  border-color: var(--workbench-border);
  color: color-mix(in srgb, var(--workbench-ink) 58%, var(--workbench-muted));
}

.smart-feedback__button--compact {
  min-height: 21px;
  padding: 0 6px;
  font-size: 0.64rem;
}

.smart-lanes {
  min-width: 0;
  height: 100%;
  display: grid;
  align-content: stretch;
  grid-auto-rows: minmax(50px, 1fr);
  gap: 5px;
}

.smart-lane {
  position: relative;
  min-width: 0;
  min-height: 50px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--workbench-border);
  border-radius: 12px;
  background: var(--workbench-card-solid);
  color: var(--workbench-ink);
  text-align: left;
  font: inherit;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

:global([data-theme='dark']) .smart-lane {
  background: var(--workbench-card-solid);
}

.smart-lane:hover {
  border-color: var(--workbench-border-strong);
  background: var(--workbench-soft);
}

.smart-lane__open {
  min-width: 0;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
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

.smart-lane__icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
}

.smart-lane__main {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.smart-lane__reason {
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
  font-size: 0.65rem;
  font-weight: 760;
}

.smart-lane__title {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.76rem;
  font-weight: 730;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-lane__meta {
  display: grid;
  justify-items: end;
  gap: 1px;
  color: var(--workbench-muted);
  font-size: 0.62rem;
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

.side-card {
  display: grid;
  gap: 12px;
  padding: var(--workbench-side-card-padding);
  border: 1px solid var(--workbench-border);
  border-radius: var(--workbench-card-radius);
  background: var(--workbench-card-solid);
  box-shadow: var(--workbench-shadow-soft);
  backdrop-filter: none;
}

.side-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
}

.side-card__header--insights {
  align-items: flex-start;
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
  border-color: var(--status-success-border);
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.state-pill.is-syncing {
  border-color: var(--status-info-border);
  background: var(--status-info-bg);
  color: var(--status-info-text);
}

.state-pill.is-error {
  border-color: var(--status-danger-border);
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
}

.side-card__action {
  height: 40px;
  border: 1px solid var(--workbench-border-strong);
  border-radius: 10px;
  background: var(--workbench-soft);
  color: var(--workbench-blue);
  box-shadow: none;
  cursor: pointer;
  font: inherit;
  font-weight: 760;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.side-card__action--subtle {
  height: 34px;
  border-color: var(--workbench-border);
  background: var(--workbench-soft);
  color: color-mix(in srgb, var(--workbench-blue) 80%, var(--workbench-ink));
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

.insights-block {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.insights-block--stats {
  align-content: start;
}

.insight-achievement-hero {
  min-width: 0;
  min-height: 60px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26px;
  align-items: start;
  gap: 8px;
  overflow: hidden;
  padding: 0;
}

.insight-achievement-hero__main {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.insight-achievement-hero__label {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--workbench-blue) 70%, var(--workbench-ink));
  font-size: 0.68rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.insight-achievement-hero__value {
  min-width: 0;
  overflow: visible;
  color: var(--workbench-ink);
  font-size: 1.4rem;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1.05;
  white-space: nowrap;
}

.insight-achievement-hero__icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: start;
  color: color-mix(in srgb, var(--workbench-blue) 82%, var(--workbench-ink));
}

.insight-summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  background: transparent;
}

.insight-summary-item {
  min-width: 0;
  min-height: 18px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 0;
}

.insight-summary-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--workbench-blue) 78%, var(--workbench-muted));
}

.insight-summary-item__label {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-muted);
  font-size: 0.66rem;
  font-weight: 660;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.insight-summary-item strong {
  min-width: 0;
  overflow: hidden;
  color: var(--workbench-ink);
  font-size: 0.86rem;
  font-weight: 780;
  letter-spacing: 0;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-tag-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.active-tag-row {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  align-items: center;
  padding: 5px 9px;
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
  border-color: var(--workbench-border);
  background: var(--workbench-soft);
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
  background: var(--workbench-soft);
}

.topic-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--workbench-blue);
  box-shadow: none;
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
  background: var(--workbench-soft);
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
  background: var(--workbench-soft);
}

.side-card--insights {
  grid-area: insights;
  align-self: stretch;
  height: var(--workbench-overview-card-height);
  grid-template-rows: auto auto;
  gap: 10px;
  padding: 8px 14px 12px;
}

.side-card--tags {
  grid-area: tags;
}

.side-card--topic {
  grid-area: topic;
}

@media (min-width: 1121px) {

  .panel-row--recent .panel--half,
  .side-card--tags {
    height: 100%;
  }

  .panel--smart,
  .side-card--topic {
    height: 100%;
  }

  .panel-row--recent .panel--half,
  .panel--smart,
  .side-card--tags,
  .side-card--topic {
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .panel-row--recent .feed-list,
  .panel-row--recent .module-empty,
  .panel--smart .smart-grid,
  .panel--smart .module-empty,
  .side-card--tags .active-tag-list,
  .side-card--tags .side-card__empty,
  .side-card--topic .topic-list,
  .side-card--topic .side-card__empty {
    min-height: 0;
    overflow-y: auto;
  }

  .side-card--tags .active-tag-list,
  .side-card--topic .topic-list {
    align-content: start;
    padding-right: 2px;
  }

  .side-card--tags .side-card__empty,
  .side-card--topic .side-card__empty {
    height: 100%;
  }
}

@media (max-width: 1520px) {
  .workbench-dashboard {
    --workbench-page-padding: var(--workbench-gap);
    --workbench-sidebar-min: 276px;
  }
}

@media (max-width: 1120px) {
  .workbench-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "main"
      "side";
    grid-template-rows: auto;
    align-items: start;
  }

  .workbench-main {
    grid-area: main;
  }

  .workbench-side {
    grid-area: side;
  }

  .workbench-main,
  .workbench-side {
    min-width: 0;
    display: grid;
    gap: var(--workbench-gap);
  }

  .hero-card,
  .panel-row--recent,
  .panel--smart,
  .side-card--insights,
  .side-card--tags,
  .side-card--topic {
    grid-area: auto;
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
    border-radius: 16px;
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
    --workbench-page-padding: var(--workbench-gap);
  }

  .workbench-main {
    gap: 10px;
  }

  .hero-card {
    padding: 18px;
    border-radius: 16px;
  }

  .smart-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 2px 16px 12px;
  }

  .panel-row--recent,
  .workbench-side {
    grid-template-columns: 1fr;
    gap: 10px;
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

  .panel__header,
  .feed-list,
  .smart-grid {
    padding-right: 16px;
    padding-left: 16px;
  }

  .panel--smart .panel__header {
    padding-top: 12px;
    padding-bottom: 2px;
  }

  .panel--smart .smart-grid {
    padding-top: 2px;
    padding-bottom: 12px;
  }

  .feed-row {
    align-items: flex-start;
    min-height: 62px;
    height: auto;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .panel-row--recent .feed-list {
    grid-auto-rows: auto;
  }

  .feed-row__time {
    display: none;
  }

  .side-card {
    padding: 16px;
  }
}
</style>
