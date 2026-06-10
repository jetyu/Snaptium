<template>
  <div class="search-view panel">
    <header class="search-view__header">
      <div class="search-view__title-wrap">
        <span class="search-view__title-icon">
          <IconDatabaseSearch :size="18" />
        </span>
        <h1 class="search-view__title">{{ $t('search.knowledgeSearch') }}</h1>
      </div>
    </header>

    <main class="search-view__content">
      <aside class="search-view__history-pane">
        <header class="search-view__pane-header">
          <h2>{{ $t('search.knowledgeHistory') }}</h2>
          <button type="button" class="search-view__new-thread icon-action-button" :disabled="isBusy"
            :title="$t('search.newKnowledgeChat')" @click="startNewThread">
            <IconPlus :size="14" />
            <span>{{ $t('search.newKnowledgeChat') }}</span>
          </button>
        </header>
        <div v-if="questionThreads.length > 0" class="search-view__history-list">
          <div v-for="thread in questionThreads" :key="thread.id" class="search-view__history-item"
            :class="{ 'is-active': activeThreadId === thread.id, 'is-draft': thread.isDraft }">
            <button type="button" class="search-view__history-open" :title="thread.title" @click="selectThread(thread)">
              <span class="search-view__history-query">{{ thread.title }}</span>
              <span class="search-view__history-answer">{{ thread.preview }}</span>
              <span class="search-view__history-meta">{{ formatAskedAt(thread.askedAt) }}</span>
            </button>
            <button v-if="!isGeneratingThread(thread)" type="button" class="search-view__history-delete"
              :title="$t('common.delete')" @click.stop.prevent="deleteQuestionThread(thread)">
              <IconTrash :size="14" />
            </button>
          </div>
        </div>
        <div v-else class="search-view__history-empty">
          {{ $t('search.knowledgeHistoryEmpty') }}
        </div>
      </aside>

      <section class="search-view__answer-pane">
        <header class="search-view__pane-header">
          <h2>{{ $t('label.aiRAGSearch') }}</h2>
        </header>

        <div ref="messageListRef" class="search-view__chat-scroll">
          <div v-if="searchError && !hasChatMessages" class="search-view__status">
            <p class="search-view__status-text search-view__status-text--error">{{ searchError }}</p>
          </div>
          <div v-else-if="!canUseKnowledgeSearch && !hasChatMessages" class="search-view__status">
            <p class="search-view__status-text">{{ knowledgeUnavailableReason }}</p>
          </div>
          <div v-else-if="!hasChatMessages" class="search-view__status">
            <p class="search-view__status-text">{{ $t('search.semanticHint') }}</p>
          </div>
          <div v-else class="search-view__chat-inner">
            <article v-for="question in chatQuestions" :key="question.id" class="search-view__chat-turn"
              :class="{ 'is-active': selectedQuestion?.id === question.id }" :data-question-id="question.id">
              <div class="search-view__message search-view__message--user">
                <div class="search-view__user-bubble">
                  {{ question.query }}
                </div>
              </div>
              <div class="search-view__message search-view__message--assistant">
                <span class="search-view__assistant-avatar">
                  <IconDatabaseSearch :size="15" />
                </span>
                <div class="search-view__assistant-card">
                  <div v-if="isGeneratingQuestion(question)" class="search-view__thinking">
                    <div class="search-view__spinner"></div>
                    <span>{{ $t('label.aiRAGThinking') }}</span>
                  </div>
                  <p v-else-if="getQuestionError(question)"
                    class="search-view__status-text search-view__status-text--error">
                    {{ getQuestionError(question) }}
                  </p>
                  <template v-else>
                    <div v-if="shouldDisplayFallbackNotice(question)" class="search-view__fallback-notice">
                      {{ $t('message.rag.noChatModel') }}
                    </div>
                    <div v-if="getQuestionAnswer(question)" class="search-view__answer-content"
                      v-html="renderQuestionAnswer(question)"></div>
                    <p v-else class="search-view__status-text">{{ $t('search.noResultsSemantic') }}</p>
                    <div v-if="getQuestionSources(question).length > 0" class="search-view__sources">
                      <h3>{{ $t('search.knowledgeSources') }}</h3>
                      <button v-for="source in getQuestionSources(question)" :key="source.noteId" type="button"
                        class="search-view__source-card" :title="source.noteTitle" @click="openSourceNote(source)">
                        <span class="search-view__source-card-head">
                          <IconFileText :size="15" />
                          <span>{{ source.noteTitle }}</span>
                        </span>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </article>
          </div>
        </div>

        <section class="search-view__query">
          <div class="search-view__input-shell" :class="{ 'is-disabled': !canUseKnowledgeSearch }">
            <textarea ref="searchInput" v-model="searchQuery" class="search-view__input" rows="1"
              :disabled="!canUseKnowledgeSearch" :placeholder="$t('search.semanticPlaceholder')" @input="resizeComposer"
              @keydown="handleComposerKeydown" />
            <button v-if="searchQuery" type="button" class="search-view__icon-button" :title="$t('button.clear')"
              @click="clearQuery">
              <IconX :size="14" />
            </button>
            <button type="button" class="search-view__ask-button icon-action-button" :disabled="!canAsk"
              :title="canUseKnowledgeSearch ? $t('search.knowledgeAsk') : knowledgeUnavailableReason"
              @click="handleAsk">
              <span>{{ $t('search.knowledgeAskShortcut') }}</span>
            </button>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { IconX, IconDatabaseSearch, IconTrash, IconFileText, IconPlus } from '@tabler/icons-vue';
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

interface QuestionThread {
  id: string;
  title: string;
  preview: string;
  askedAt: number;
  questions: WorkbenchQuestionEntry[];
  latestQuestion: WorkbenchQuestionEntry | null;
  isDraft: boolean;
}

const searchViewLogger = createLogger('SearchView');
const { t } = useI18n();
const workbenchStore = useWorkbenchStore();
const { recentQuestions } = storeToRefs(workbenchStore);
const appShellStore = useAppShellStore();
const { selectNote } = useWorkspace();
const { searchViewRequest } = useSearch();
const { search: ragSearch } = useRAGSearch();
const { isEnabled: ragEnabled, isConfigured: ragConfigured } = useRAGConfig();
const { askQuestion, isGenerating: isAIGenerating, usedSearchFallback } = useRAGChat();
const ragLicenseGate = useLicenseGate('rag');

const searchQuery = ref('');
const semanticResults = ref<RagSearchResult[]>([]);
const isSearching = ref(false);
const searchError = ref('');
const searchInput = ref<HTMLTextAreaElement | null>(null);
const messageListRef = ref<HTMLElement | null>(null);
const selectedQuestion = ref<WorkbenchQuestionEntry | null>(null);
const activeThreadId = ref<string | null>(null);
const draftThreadId = ref<string | null>(null);
const draftThreadCreatedAt = ref(0);
const generatingQuestionId = ref('');
const activeFallbackQuestionId = ref('');
const activeErrorQuestionId = ref('');
const activeErrorMessage = ref('');
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
const questionThreads = computed<QuestionThread[]>(() => {
  const threadMap = new Map<string, WorkbenchQuestionEntry[]>();

  recentQuestions.value.forEach((question) => {
    const threadId = getQuestionThreadId(question);
    const threadQuestions = threadMap.get(threadId) ?? [];
    threadQuestions.push(question);
    threadMap.set(threadId, threadQuestions);
  });

  const threads = Array.from(threadMap.entries())
    .map(([threadId, questions]) => {
      const sortedQuestions = [...questions].sort((left, right) => left.askedAt - right.askedAt);
      const firstQuestion = sortedQuestions[0];
      const latestQuestion = sortedQuestions[sortedQuestions.length - 1];

      return {
        id: threadId,
        title: firstQuestion.query,
        preview: getQuestionPreview(latestQuestion),
        askedAt: latestQuestion.askedAt,
        questions: sortedQuestions,
        latestQuestion,
        isDraft: false,
      };
    })
    .sort((left, right) => right.askedAt - left.askedAt);

  if (draftThreadId.value && !threads.some((thread) => thread.id === draftThreadId.value)) {
    return [
      {
        id: draftThreadId.value,
        title: t('search.newKnowledgeChat'),
        preview: t('search.newKnowledgeChatPreview'),
        askedAt: draftThreadCreatedAt.value,
        questions: [],
        latestQuestion: null,
        isDraft: true,
      },
      ...threads,
    ];
  }

  return threads;
});
const chatQuestions = computed<WorkbenchQuestionEntry[]>(() => {
  if (!activeThreadId.value) {
    return [];
  }

  return questionThreads.value.find((thread) => thread.id === activeThreadId.value)?.questions ?? [];
});
const hasChatMessages = computed(() => chatQuestions.value.length > 0);
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

function focusSearchInput(): void {
  void nextTick(() => {
    searchInput.value?.focus();
  });
}

function createThreadId(askedAt: number): string {
  return `${askedAt}:thread`;
}

function getQuestionThreadId(question: WorkbenchQuestionEntry): string {
  return question.threadId || question.id;
}

function resizeComposer(): void {
  const textarea = searchInput.value;
  if (!textarea) {
    return;
  }

  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
}

function scrollChatToBottom(): void {
  void nextTick(() => {
    const messageList = messageListRef.value;
    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  });
}

function scrollQuestionIntoView(questionId: string): void {
  void nextTick(() => {
    const messageList = messageListRef.value;
    if (!messageList) {
      return;
    }

    const target = Array.from(messageList.querySelectorAll<HTMLElement>('[data-question-id]'))
      .find((element) => element.dataset.questionId === questionId);
    target?.scrollIntoView({ block: 'center' });
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
  usedSearchFallback.value = false;
  selectedQuestion.value = null;
  generatingQuestionId.value = '';
  activeFallbackQuestionId.value = '';
  activeErrorQuestionId.value = '';
  activeErrorMessage.value = '';
}

function startNewThread(): void {
  if (isBusy.value) {
    return;
  }

  clearPendingSearch();

  if (!draftThreadId.value) {
    draftThreadCreatedAt.value = Date.now();
    draftThreadId.value = createThreadId(draftThreadCreatedAt.value);
  }

  activeThreadId.value = draftThreadId.value;
  resetAnswer();
  void nextTick(resizeComposer);
  focusSearchInput();
}

function clearQuery(): void {
  searchQuery.value = '';
  void nextTick(resizeComposer);
  focusSearchInput();
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  handleAsk();
}

function handleAsk(): void {
  clearPendingSearch();

  const query = searchQuery.value.trim();
  if (!query) {
    return;
  }

  if (!canUseKnowledgeSearch.value) {
    searchError.value = knowledgeUnavailableReason.value;
    return;
  }

  if (isBusy.value) {
    return;
  }

  searchQuery.value = '';
  void nextTick(resizeComposer);

  searchTimeout = setTimeout(() => {
    void askKnowledgeQuestion(query);
  }, 0);
}

async function askKnowledgeQuestion(query: string): Promise<void> {
  if (!canUseKnowledgeSearch.value) {
    searchError.value = knowledgeUnavailableReason.value;
    return;
  }

  selectedQuestion.value = null;
  usedSearchFallback.value = false;
  searchError.value = '';
  activeFallbackQuestionId.value = '';
  activeErrorQuestionId.value = '';
  activeErrorMessage.value = '';
  isSearching.value = true;
  let draftQuestion: WorkbenchQuestionEntry | null = null;

  try {
    const askedAt = Date.now();
    const threadId = activeThreadId.value ?? createThreadId(askedAt);
    activeThreadId.value = threadId;
    draftQuestion = await workbenchStore.recordQuestion({ query, threadId, askedAt });
    if (draftThreadId.value === threadId) {
      draftThreadId.value = null;
      draftThreadCreatedAt.value = 0;
    }
    selectedQuestion.value = draftQuestion;
    generatingQuestionId.value = draftQuestion?.id ?? '';
    if (draftQuestion) {
      scrollQuestionIntoView(draftQuestion.id);
    } else {
      scrollChatToBottom();
    }

    const ragResults = await ragSearch(query);
    semanticResults.value = ragResults;

    let generatedAnswer = '';
    if (ragResults.length > 0) {
      try {
        generatedAnswer = await askQuestion(query);
      } catch (error) {
        const message = getErrorMessage(error);
        searchViewLogger.error(`Knowledge answer generation failed: ${message}`);
        if (draftQuestion) {
          activeErrorQuestionId.value = draftQuestion.id;
          activeErrorMessage.value = message;
        } else {
          searchError.value = message;
        }
      }
    }

    if (draftQuestion && usedSearchFallback.value) {
      activeFallbackQuestionId.value = draftQuestion.id;
    }

    const recordedQuestion = await workbenchStore.recordQuestion({
      query,
      threadId,
      askedAt,
      answer: generatedAnswer,
      sourceNoteIds: Array.from(new Set(ragResults.map((result) => result.chunk.noteId))),
      sources: currentSources.value,
    });
    selectedQuestion.value = recordedQuestion;
    if (recordedQuestion) {
      scrollQuestionIntoView(recordedQuestion.id);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    searchViewLogger.error(`Knowledge question failed: ${message}`);
    if (draftQuestion) {
      activeErrorQuestionId.value = draftQuestion.id;
      activeErrorMessage.value = message;
    } else {
      searchError.value = message;
    }
    semanticResults.value = [];
  } finally {
    isSearching.value = false;
    generatingQuestionId.value = '';
    focusSearchInput();
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

function selectThread(thread: QuestionThread): void {
  activeThreadId.value = thread.id;
  selectedQuestion.value = thread.latestQuestion;
  searchError.value = '';
  semanticResults.value = [];
  usedSearchFallback.value = false;
  activeFallbackQuestionId.value = '';
  activeErrorQuestionId.value = '';
  activeErrorMessage.value = '';
  if (thread.latestQuestion) {
    scrollQuestionIntoView(thread.latestQuestion.id);
  } else {
    scrollChatToBottom();
    focusSearchInput();
  }
}

async function deleteQuestionThread(thread: QuestionThread): Promise<void> {
  if (thread.isDraft) {
    draftThreadId.value = null;
    draftThreadCreatedAt.value = 0;
    if (activeThreadId.value === thread.id) {
      activeThreadId.value = null;
      resetAnswer();
    }
    return;
  }

  let hasDeleted = false;

  for (const question of thread.questions) {
    const deleted = await workbenchStore.deleteQuestion(question.id);
    hasDeleted = hasDeleted || deleted;
  }

  if (hasDeleted && activeThreadId.value === thread.id) {
    activeThreadId.value = null;
    resetAnswer();
  }
}

function getQuestionPreview(question: WorkbenchQuestionEntry): string {
  if (isGeneratingQuestion(question)) {
    return t('label.aiRAGThinking');
  }

  return question.answer || t('workbench.empty.noAnswer');
}

function getQuestionAnswer(question: WorkbenchQuestionEntry): string {
  return question.fullAnswer || question.answer;
}

function getQuestionSources(question: WorkbenchQuestionEntry): WorkbenchQuestionSource[] {
  if (question.sources?.length) {
    return question.sources;
  }

  return [];
}

function getQuestionError(question: WorkbenchQuestionEntry): string {
  if (activeErrorQuestionId.value !== question.id) {
    return '';
  }

  return activeErrorMessage.value;
}

function shouldDisplayFallbackNotice(question: WorkbenchQuestionEntry): boolean {
  return activeFallbackQuestionId.value === question.id;
}

function renderQuestionAnswer(question: WorkbenchQuestionEntry): string {
  const answer = getQuestionAnswer(question);
  if (!answer) {
    return '';
  }

  return renderMarkdown(answer, {
    allowHtml: false,
    allowInlineSvg: false,
    remoteImageMode: 'blocked',
    blockedImageLabel: t('preview.remoteImageBlocked'),
    copyCodeButtonLabel: t('preview.copyCode'),
  });
}

function isGeneratingQuestion(question: WorkbenchQuestionEntry): boolean {
  return generatingQuestionId.value === question.id;
}

function isGeneratingThread(thread: QuestionThread): boolean {
  return thread.questions.some((question) => isGeneratingQuestion(question));
}

function formatAskedAt(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  return new Date(timestamp).toLocaleString();
}

function applySearchRequest(): void {
  const request = searchViewRequest.value;
  activeThreadId.value = null;
  draftThreadId.value = null;
  draftThreadCreatedAt.value = 0;
  searchQuery.value = request.query;
  resetAnswer();
  focusSearchInput();
  void nextTick(resizeComposer);

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

watch(questionThreads, (threads) => {
  if (!activeThreadId.value) {
    return;
  }

  if (!threads.some((thread) => thread.id === activeThreadId.value)) {
    activeThreadId.value = null;
    selectedQuestion.value = null;
  }
});

onMounted(() => {
  applySearchRequest();
  focusSearchInput();
  scrollChatToBottom();
});

onBeforeUnmount(() => {
  clearPendingSearch();
});
</script>

<style scoped>
.search-view {
  --search-chat-max-width: 960px;
  --search-chat-surface: color-mix(in srgb, var(--panel) 94%, var(--bg));
  --search-chat-border: color-mix(in srgb, var(--panel-border) 84%, var(--panel));
  --search-chat-accent-border: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  --search-chat-accent-fill: color-mix(in srgb, var(--accent) 5%, var(--panel));
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
  justify-content: center;
  padding: 12px 22px 14px;
  border-top: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 88%, var(--bg));
}

.search-view__input-shell {
  position: relative;
  width: 100%;
  max-width: var(--search-chat-max-width);
  flex: 0 1 var(--search-chat-max-width);
  min-width: 0;
  display: flex;
  align-items: flex-end;
  min-height: 42px;
  border: 1px solid var(--search-chat-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 96%, var(--bg));
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.search-view__input-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}

.search-view__input-shell.is-disabled {
  opacity: 0.64;
}

.search-view__input {
  flex: 1;
  min-width: 0;
  height: auto;
  max-height: 96px;
  padding: 10px 8px 9px 12px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.45;
  overflow-y: auto;
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
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.12s ease, opacity 0.15s ease;
}

.search-view__icon-button {
  width: 28px;
  height: 28px;
  margin: 0 2px 6px 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
}

.search-view__ask-button {
  min-width: 52px;
  height: 32px;
  padding: 0 10px;
  margin: 0 5px 5px 0;
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__icon-button:hover {
  background: var(--panel-hover);
  color: var(--text);
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

.search-view__new-thread {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 9px;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 650;
}

.search-view__chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 22px;
}

.search-view__chat-inner {
  width: 100%;
  max-width: var(--search-chat-max-width);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.search-view__chat-turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-margin: 18px;
}

.search-view__chat-turn.is-active .search-view__assistant-card {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--search-chat-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 6%, transparent);
}

.search-view__message {
  min-width: 0;
  display: flex;
}

.search-view__message--user {
  justify-content: flex-end;
}

.search-view__message--assistant {
  align-items: flex-start;
  gap: 9px;
}

.search-view__user-bubble {
  max-width: min(620px, 76%);
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--panel-border));
  border-radius: 12px 12px 4px 12px;
  background: color-mix(in srgb, var(--accent) 5%, var(--panel));
  color: var(--text);
  font-size: 0.9rem;
  line-height: 1.52;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.search-view__assistant-avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--accent);
  background: color-mix(in srgb, var(--panel-hover) 78%, var(--panel));
  border: 1px solid var(--search-chat-border);
}

.search-view__assistant-card {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--search-chat-border);
  border-radius: 12px 12px 12px 4px;
  background: var(--search-chat-surface);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--panel-border) 22%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-view__thinking {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--text-muted);
  font-size: 0.86rem;
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

.search-view__history-item+.search-view__history-item {
  margin-top: 8px;
}

.search-view__history-item+.search-view__history-item::before {
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



.search-view__history-item.is-draft .search-view__history-query {
  color: var(--accent);
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

.search-view__chat-scroll>.search-view__status {
  min-height: 100%;
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

.search-view__fallback-notice {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--search-chat-accent-border);
  border-left-width: 3px;
  background: var(--search-chat-surface);
  color: var(--text-muted);
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
  border-top: 1px solid var(--search-chat-border);
}

.search-view__sources h3 {
  flex: 0 0 auto;
  margin: 0 4px 0 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__source-card {
  flex: 0 1 auto;
  max-width: min(300px, 100%);
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--search-chat-border);
  border-radius: 7px;
  background: var(--search-chat-surface);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.search-view__source-card:hover {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--search-chat-border));
  background: color-mix(in srgb, var(--panel-hover) 74%, var(--accent) 4%);
}

.search-view__source-card-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.search-view__source-card:hover .search-view__source-card-head {
  color: var(--accent-hover);
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
