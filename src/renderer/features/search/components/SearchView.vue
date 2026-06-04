<template>
  <div class="search-view panel">
    <header class="search-view__header">
      <div class="search-view__title-wrap">
        <span class="search-view__title-icon">
          <DatabaseSearch theme="outline" :size="18" />
        </span>
        <h1 class="search-view__title">{{ $t('search.knowledgeSearch') }}</h1>
      </div>
    </header>
    <section class="search-view__query">
      <div class="search-view__input-shell" :class="{ 'is-disabled': !canUseKnowledgeSearch }">
        <Search class="search-view__input-icon" theme="outline" :size="16" />
        <input ref="searchInput" v-model="searchQuery" type="text" class="search-view__input"
          :disabled="!canUseKnowledgeSearch" :placeholder="$t('search.semanticPlaceholder')"
          @keydown.enter.prevent="handleAsk" />
        <button v-if="searchQuery" type="button" class="search-view__icon-button" :title="$t('button.clear')"
          @click="clearQuery">
          <Close theme="outline" :size="14" />
        </button>
      </div>
      <button type="button" class="search-view__ask-button" :disabled="!canAsk"
        :title="canUseKnowledgeSearch ? $t('search.knowledgeAsk') : knowledgeUnavailableReason" @click="handleAsk">
        <Search theme="outline" :size="17" />
      </button>
    </section>

    <main class="search-view__content">
      <aside class="search-view__history-pane">
        <header class="search-view__pane-header">
          <h2>{{ $t('search.knowledgeHistory') }}</h2>
        </header>
        <div v-if="filteredRecentQuestions.length > 0" class="search-view__history-list">
          <div v-for="question in filteredRecentQuestions" :key="question.id" class="search-view__history-item"
            :class="{ 'is-active': selectedQuestion?.id === question.id }">
            <button type="button" class="search-view__history-open" :title="question.query"
              @click="selectQuestion(question)">
              <span class="search-view__history-query">{{ question.query }}</span>
              <span class="search-view__history-answer">{{ getQuestionPreview(question) }}</span>
              <span class="search-view__history-meta">{{ formatAskedAt(question.askedAt) }}</span>
            </button>
            <button v-if="!isGeneratingQuestion(question)" type="button" class="search-view__history-delete" :title="$t('common.delete')"
              @click.stop.prevent="deleteRecentQuestion(question)">
              <Delete theme="outline" :size="14" />
            </button>
          </div>
        </div>
        <div v-else class="search-view__history-empty">
          {{ $t('search.knowledgeHistoryEmpty') }}
        </div>
      </aside>

      <section class="search-view__answer-pane">
        <header class="search-view__pane-header">
          <h2 :title="answerPaneTitle">{{ answerPaneTitle }}</h2>
        </header>

        <div v-if="isBusy" class="search-view__status">
          <div class="search-view__spinner"></div>
          <p class="search-view__status-text">{{ $t('label.aiRAGThinking') }}</p>
        </div>
        <div v-else-if="searchError" class="search-view__status">
          <p class="search-view__status-text search-view__status-text--error">{{ searchError }}</p>
        </div>
        <div v-else-if="!canUseKnowledgeSearch" class="search-view__status">
          <p class="search-view__status-text">{{ knowledgeUnavailableReason }}</p>
        </div>
        <div v-else-if="!hasAsked && !selectedQuestion" class="search-view__status">
          <p class="search-view__status-text">{{ $t('search.semanticHint') }}</p>
        </div>
        <article v-else-if="displayAnswer" class="search-view__answer">
          <div v-if="displayFallbackNotice" class="search-view__fallback-notice">
            {{ $t('message.rag.noChatModel') }}
          </div>
          <div class="search-view__answer-content" v-html="renderedAnswer"></div>
          <div v-if="displaySources.length > 0" class="search-view__sources">
            <h3>{{ $t('search.knowledgeSources') }}</h3>
            <button v-for="source in displaySources" :key="source.noteId" type="button" class="search-view__source-card"
              :title="source.noteTitle" @click="openSourceNote(source)">
              <span class="search-view__source-card-head">
                <FileText theme="outline" :size="15" />
                <span>{{ source.noteTitle }}</span>
              </span>
            </button>
          </div>
        </article>
        <div v-else class="search-view__status">
          <p class="search-view__status-text">{{ $t('search.noResultsSemantic') }}</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { Close, DatabaseSearch, Delete, FileText, Search } from '@icon-park/vue-next';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';
import { useRAGConfig, useRAGSearch, useRAGChat } from '@renderer/features/rag';
import { useLicenseGate } from '@renderer/features/license';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { useWorkspace } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import type { RagSearchResult } from '@renderer/core/bridge/electronApi';
import type { WorkbenchQuestionEntry, WorkbenchQuestionSource } from '@renderer/features/workbench/constants/workbench.constants';
import { useSearch } from '../composables/useSearch';

const searchViewLogger = createLogger('SearchView');
const { t } = useI18n();
const workbenchStore = useWorkbenchStore();
const { recentQuestions } = storeToRefs(workbenchStore);
const appShellStore = useAppShellStore();
const { selectNote } = useWorkspace();
const { searchViewRequest } = useSearch();
const { search: ragSearch } = useRAGSearch();
const { isEnabled: ragEnabled, isConfigured: ragConfigured } = useRAGConfig();
const { askQuestion, isGenerating: isAIGenerating, answer: aiAnswer, usedSearchFallback } = useRAGChat();
const ragLicenseGate = useLicenseGate('rag');

const searchQuery = ref('');
const semanticResults = ref<RagSearchResult[]>([]);
const isSearching = ref(false);
const hasAsked = ref(false);
const searchError = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const selectedQuestion = ref<WorkbenchQuestionEntry | null>(null);
const generatingQuestionId = ref('');
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const canUseKnowledgeSearch = computed(() => ragLicenseGate.allowed.value && ragEnabled.value && ragConfigured.value);
const isBusy = computed(() => isSearching.value || isAIGenerating.value);
const canAsk = computed(() => canUseKnowledgeSearch.value && Boolean(searchQuery.value.trim()) && !isBusy.value);
const knowledgeUnavailableReason = computed(() => {
  if (!ragLicenseGate.allowed.value) {
    return t('license.gate.rag.title');
  }
  if (!ragEnabled.value) {
    return t('search.knowledgeUnavailableDisabled');
  }
  if (!ragConfigured.value) {
    return t('message.error.ragNotConfigured');
  }
  return '';
});
const renderedAnswer = computed(() => {
  if (!displayAnswer.value) {
    return '';
  }

  return renderMarkdown(displayAnswer.value, {
    allowHtml: false,
    allowInlineSvg: false,
    remoteImageMode: 'blocked',
    blockedImageLabel: t('preview.remoteImageBlocked'),
    copyCodeButtonLabel: t('preview.copyCode'),
  });
});
const filteredRecentQuestions = computed(() => {
  return recentQuestions.value;
});
const currentSources = computed<WorkbenchQuestionSource[]>(() => {
  const sourceMap = new Map<string, WorkbenchQuestionSource>();

  semanticResults.value.forEach((result) => {
    const noteId = result.chunk.noteId;
    if (!noteId || sourceMap.has(noteId)) {
      return;
    }

    sourceMap.set(noteId, {
      noteId,
      noteTitle: result.noteTitle || t('common.untitledNote'),
    });
  });

  return Array.from(sourceMap.values());
});
const displayAnswer = computed(() => {
  if (selectedQuestion.value) {
    return selectedQuestion.value.fullAnswer || selectedQuestion.value.answer;
  }

  return aiAnswer.value;
});
const displaySources = computed<WorkbenchQuestionSource[]>(() => {
  if (selectedQuestion.value?.sources?.length) {
    return selectedQuestion.value.sources;
  }

  return currentSources.value;
});
const displayFallbackNotice = computed(() => {
  return !selectedQuestion.value && usedSearchFallback.value;
});
const answerPaneTitle = computed(() => {
  if (usedSearchFallback.value && !selectedQuestion.value) {
    return t('search.knowledgeResults');
  }

  return selectedQuestion.value?.query || t('label.aiRAGSearch');
});

function focusSearchInput(): void {
  void nextTick(() => {
    searchInput.value?.focus();
  });
}

function clearPendingSearch(): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
}

function resetAnswer(): void {
  semanticResults.value = [];
  searchError.value = '';
  hasAsked.value = false;
  aiAnswer.value = '';
  usedSearchFallback.value = false;
  selectedQuestion.value = null;
  generatingQuestionId.value = '';
}

function clearQuery(): void {
  searchQuery.value = '';
  focusSearchInput();
}

function handleAsk(): void {
  clearPendingSearch();

  const query = searchQuery.value.trim();
  if (!query) {
    return;
  }

  searchTimeout = setTimeout(() => {
    void askKnowledgeQuestion(query);
  }, 0);
}

async function askKnowledgeQuestion(query: string): Promise<void> {
  if (!canUseKnowledgeSearch.value) {
    searchError.value = knowledgeUnavailableReason.value;
    hasAsked.value = true;
    return;
  }

  hasAsked.value = false;
  selectedQuestion.value = null;
  aiAnswer.value = '';
  usedSearchFallback.value = false;
  searchError.value = '';
  isSearching.value = true;

  try {
    const askedAt = Date.now();
    const draftQuestion = await workbenchStore.recordQuestion({ query, askedAt });
    selectedQuestion.value = draftQuestion;
    generatingQuestionId.value = draftQuestion?.id ?? '';

    const ragResults = await ragSearch(query);
    semanticResults.value = ragResults;

    let generatedAnswer = '';
    if (ragResults.length > 0) {
      try {
        generatedAnswer = await askQuestion(query);
      } catch (error) {
        const message = getErrorMessage(error);
        searchViewLogger.error(`Knowledge answer generation failed: ${message}`);
        searchError.value = message;
      }
    }

    const recordedQuestion = await workbenchStore.recordQuestion({
      query,
      askedAt,
      answer: generatedAnswer,
      sourceNoteIds: Array.from(new Set(ragResults.map((result) => result.chunk.noteId))),
      sources: currentSources.value,
    });
    selectedQuestion.value = recordedQuestion;
  } catch (error) {
    const message = getErrorMessage(error);
    searchViewLogger.error(`Knowledge question failed: ${message}`);
    searchError.value = message;
    semanticResults.value = [];
  } finally {
    isSearching.value = false;
    generatingQuestionId.value = '';
    hasAsked.value = true;
  }
}

async function openNoteResult(noteId: string, title?: string): Promise<void> {
  await appShellStore.setActiveMainView('workspace');
  selectNote(noteId);

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('workspace-search-jump', {
      detail: { noteId, title },
    }));
  }, 100);
}

function openSourceNote(source: WorkbenchQuestionSource): void {
  void openNoteResult(source.noteId, source.noteTitle);
}

function selectQuestion(question: WorkbenchQuestionEntry): void {
  selectedQuestion.value = question;
  searchError.value = '';
  semanticResults.value = [];
  aiAnswer.value = '';
  usedSearchFallback.value = false;
  hasAsked.value = true;
}

async function deleteRecentQuestion(question: WorkbenchQuestionEntry): Promise<void> {
  const deleted = await workbenchStore.deleteQuestion(question.id);
  if (deleted && selectedQuestion.value?.id === question.id) {
    resetAnswer();
  }
}

function getQuestionPreview(question: WorkbenchQuestionEntry): string {
  if (isGeneratingQuestion(question)) {
    return t('label.aiRAGThinking');
  }

  return question.answer || t('workbench.empty.noAnswer');
}

function isGeneratingQuestion(question: WorkbenchQuestionEntry): boolean {
  return generatingQuestionId.value === question.id;
}

function formatAskedAt(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  return new Date(timestamp).toLocaleString();
}

function applySearchRequest(): void {
  const request = searchViewRequest.value;
  searchQuery.value = request.query;
  resetAnswer();
  focusSearchInput();

  if (request.run && request.query.trim()) {
    handleAsk();
  }
}

watch(
  () => searchViewRequest.value.id,
  () => {
    applySearchRequest();
  },
);

watch(canUseKnowledgeSearch, () => {
  resetAnswer();
});

onMounted(() => {
  applySearchRequest();
  focusSearchInput();
});

onBeforeUnmount(() => {
  clearPendingSearch();
});
</script>

<style scoped>
.search-view {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.search-view__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel);
}

.search-view__title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-view__title-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.search-view__title {
  margin: 0;
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
}


.search-view__query {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 72%, var(--bg));
}

.search-view__input-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 40px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.search-view__input-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}

.search-view__input-shell.is-disabled {
  opacity: 0.64;
}

.search-view__input-icon {
  flex: 0 0 auto;
  margin-left: 12px;
  color: var(--text-muted);
}

.search-view__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
}

.search-view__input:disabled {
  cursor: not-allowed;
}

.search-view__input::placeholder {
  color: var(--text-muted);
}

.search-view__icon-button,
.search-view__ask-button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease, opacity 0.15s ease;
}

.search-view__icon-button {
  width: 28px;
  height: 28px;
  margin-right: 6px;
  background: transparent;
  color: var(--text-muted);
}

.search-view__ask-button {
  width: 40px;
  height: 40px;
  background: var(--accent);
  color: #fff;
}

.search-view__icon-button:hover {
  background: var(--panel-hover);
  color: var(--text);
}

.search-view__ask-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.search-view__ask-button:active:not(:disabled) {
  transform: scale(0.97);
}

.search-view__ask-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.search-view__content {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.search-view__history-pane {
  flex: 0 0 300px;
  min-width: 240px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 76%, var(--bg));
}

.search-view__answer-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-view__pane-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 0 20px;
  border-bottom: 1px solid var(--panel-border);
}

.search-view__pane-header h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 700;
}

.search-view__history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.search-view__history-item {
  position: relative;
  width: 100%;
  min-height: 82px;
  display: block;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.search-view__history-item + .search-view__history-item {
  margin-top: 8px;
}

.search-view__history-item + .search-view__history-item::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 10px;
  right: 10px;
  height: 1px;
  background: var(--panel-border);
}

.search-view__history-item:hover,
.search-view__history-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.search-view__history-open {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  padding: 9px 44px 9px 10px;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.search-view__history-delete {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 1;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.72;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.search-view__history-delete:hover {
  background: color-mix(in srgb, var(--color-danger, #ef4444) 12%, transparent);
  color: var(--color-danger, #ef4444);
  opacity: 1;
}

.search-view__history-query,
.search-view__history-answer,
.search-view__history-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-view__history-query {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
  white-space: nowrap;
}

.search-view__history-answer {
  display: -webkit-box;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.42;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.search-view__history-meta {
  color: var(--text-muted);
  font-size: 0.68rem;
  opacity: 0.82;
  white-space: nowrap;
}

.search-view__history-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  color: var(--text-muted);
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.5;
}

.search-view__status {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px;
  color: var(--text-muted);
  text-align: center;
}

.search-view__status-text {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.search-view__status-text--error {
  color: var(--color-danger, #ef4444);
}

.search-view__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--panel-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: search-spin 0.8s linear infinite;
}

@keyframes search-spin {
  to {
    transform: rotate(360deg);
  }
}

.search-view__answer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 22px;
  overflow-y: auto;
}

.search-view__fallback-notice {
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  color: var(--text);
  font-size: 0.82rem;
  line-height: 1.5;
}

.search-view__answer-content {
  color: var(--text);
  font-size: 0.92rem;
  line-height: 1.76;
}

.search-view__answer-content :deep(h1),
.search-view__answer-content :deep(h2),
.search-view__answer-content :deep(h3) {
  margin: 1em 0 0.45em;
  color: var(--text);
  line-height: 1.35;
}

.search-view__answer-content :deep(h1:first-child),
.search-view__answer-content :deep(h2:first-child),
.search-view__answer-content :deep(h3:first-child) {
  margin-top: 0;
}

.search-view__answer-content :deep(p) {
  margin: 0.55em 0;
}

.search-view__answer-content :deep(ul),
.search-view__answer-content :deep(ol) {
  margin: 0.55em 0;
  padding-left: 1.4em;
}

.search-view__answer-content :deep(li + li) {
  margin-top: 0.32em;
}

.search-view__answer-content :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--panel-hover);
  color: var(--text);
}

.search-view__sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--panel-border);
}

.search-view__sources h3 {
  flex: 0 0 auto;
  margin: 0 4px 0 0;
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
}

.search-view__source-card {
  flex: 0 1 auto;
  max-width: min(300px, 100%);
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.search-view__source-card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}

.search-view__source-card-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--accent);
  font-size: 0.78rem;
}

.search-view__source-card-head span {
  flex: 0 1 auto;
  max-width: 240px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-weight: 650;
}

@media (max-width: 980px) {
  .search-view__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-view__content {
    flex-direction: column;
  }

  .search-view__history-pane {
    flex: 0 0 190px;
    min-width: 0;
    border-right: none;
    border-bottom: 1px solid var(--panel-border);
  }

  .search-view__history-item {
    min-height: 70px;
  }
}
</style>
