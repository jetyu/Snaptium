<template>
  <div class="search-view panel">
    <header class="search-view__header">
      <div class="search-view__title-wrap">
        <span class="search-view__title-icon">
          <IconSubtitlesAi :size="18" />
        </span>
        <h1 class="search-view__title">{{ $t('search.knowledgeSearch') }}</h1>
      </div>
    </header>

    <main ref="contentRef" class="search-view__content" :class="{ 'is-resizing-pane': isResizingPane }">
      <aside class="search-view__history-pane" :style="historyPaneStyle">
        <header class="search-view__pane-header">
          <h2>{{ $t('search.recentConversations') }}</h2>
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
              :title="$t('button.delete')" @click.stop.prevent="deleteQuestionThread(thread)">
              <IconTrash :size="14" />
            </button>
          </div>
        </div>
        <div v-else class="search-view__history-empty">
          {{ $t('search.knowledgeHistoryEmpty') }}
        </div>
      </aside>

      <div class="search-view__pane-divider" @pointerdown="handleDividerPointerDown"></div>

      <section class="search-view__answer-pane">
        <header class="search-view__pane-header">
          <h2>{{ $t('label.ConversationContent') }}</h2>
        </header>

        <div ref="messageListRef" class="search-view__chat-scroll">
          <div v-if="searchError && !hasChatMessages" class="search-view__status">
            <p class="search-view__status-text search-view__status-text--error">{{ searchError }}</p>
          </div>
          <div v-else-if="!canUseKnowledgeSearch && !hasChatMessages" class="search-view__status">
            <IconMessageChatbot :size="72" class="search-view__status-icon" />
            <p class="search-view__status-text">{{ knowledgeUnavailableReason }}</p>
          </div>
          <div v-else-if="!hasChatMessages" class="search-view__status">
            <IconMessageChatbot :size="72" class="search-view__status-icon" />
            <p class="search-view__status-text">{{ $t('search.semanticHint') }}</p>
          </div>
          <div v-else class="search-view__chat-inner">
            <article v-for="question in chatQuestions" :key="question.id" class="search-view__chat-turn"
              :class="{ 'is-active': selectedQuestion?.id === question.id }" :data-question-id="question.id">
              <div class="search-view__message search-view__message--user">
                <div class="search-view__user-message">
                  <div class="search-view__user-bubble">
                    {{ question.query }}
                  </div>
                  <span v-if="formatQuestionAskedAt(question)" class="search-view__message-timestamp">
                    {{ formatQuestionAskedAt(question) }}
                  </span>
                </div>
              </div>
              <div class="search-view__message search-view__message--assistant">
                <span class="search-view__assistant-avatar">
                  <IconSubtitlesAi :size="15" />
                </span>
                <div class="search-view__assistant-card">
                  <span v-if="formatQuestionAnsweredAt(question)" class="search-view__message-timestamp">
                    {{ formatQuestionAnsweredAt(question) }}
                  </span>
                  <div v-if="isGeneratingQuestion(question) && !getQuestionAnswer(question)" class="search-view__thinking">
                    <div class="search-view__spinner"></div>
                    <span>{{ getQuestionThinkingLabel(question) }}</span>
                  </div>
                  <p v-else-if="getQuestionError(question)"
                    class="search-view__status-text search-view__status-text--error">
                    {{ getQuestionError(question) }}
                  </p>
                  <template v-else>
                    <div v-if="shouldDisplayFallbackNotice(question)" class="search-view__fallback-notice">
                      {{ $t('message.knowledgeCopilot.noChatModel') }}
                    </div>
                    <div v-if="getQuestionAnswer(question)" class="search-view__answer-content markdown-body"
                      v-html="renderQuestionAnswer(question)"></div>
                    <p v-else class="search-view__status-text">{{ $t('search.noResultsSemantic') }}</p>
                    <div v-if="canSaveQuestionAsNote(question)" class="search-view__answer-actions">
                      <button type="button" class="search-view__save-note-button icon-action-button"
                        :disabled="Boolean(savingSummaryActionId)" @click="saveQuestionAsNote(question)">
                        <IconPlus :size="14" />
                        <span>{{ savingSummaryActionId === `${question.id}:create` ? $t('search.agentTaskApplying') :
                          $t('search.agentTaskSaveAsNote') }}</span>
                      </button>
                    </div>
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
                    <div v-if="getAgentSteps(question).length > 0" class="search-view__agent-steps">
                      <h3>{{ $t('search.agentTaskSteps') }}</h3>
                      <ol>
                        <li v-for="(step, index) in getAgentSteps(question)" :key="`${question.id}:step:${index}`"
                          :class="`is-${step.status}`">
                          <span>{{ formatAgentStepTitle(step) }}</span>
                          <small>{{ formatAgentStepDetail(step) }}</small>
                        </li>
                      </ol>
                    </div>
                    <div v-if="getAgentTraceEvents(question).length > 0" class="search-view__agent-trace">
                      <h3>{{ $t('search.agentTaskTrace') }}</h3>
                      <ol>
                        <li v-for="event in getAgentTraceEvents(question)" :key="event.id"
                          :class="`is-${event.status}`">
                          <span>{{ formatAgentTraceTitle(event) }}</span>
                          <small>{{ formatAgentTraceDetail(event) }}</small>
                        </li>
                      </ol>
                    </div>
                    <div v-if="getPendingActions(question).length > 0" class="search-view__agent-writes">
                      <h3>{{ $t('search.agentTaskApprovalRequired') }}</h3>
                      <article v-for="(action, index) in getPendingActions(question)" :key="`${question.id}:approval:${index}`" class="search-view__agent-write-card">
                        <div class="search-view__agent-write-main">
                          <strong>{{ action.name }}</strong>
                          <p>{{ action.description }}</p>
                          <pre>{{ JSON.stringify(action.args, null, 2) }}</pre>
                        </div>
                        <div class="search-view__agent-write-actions">
                          <button type="button" class="search-view__agent-write-apply icon-action-button" :disabled="isAgentRunning" @click="resumeAgentAction(question, 'approve')">
                            <IconCheck :size="14" />{{ $t('button.approve') }}
                          </button>
                          <button v-if="action.allowedDecisions.includes('edit')" type="button" class="search-view__agent-write-dismiss" :disabled="isAgentRunning" @click="editAndResumeAgentAction(question, action, index)">
                            {{ $t('button.edit') }}
                          </button>
                          <button type="button" class="search-view__agent-write-dismiss" :disabled="isAgentRunning" @click="resumeAgentAction(question, 'reject')">
                            {{ $t('button.reject') }}
                          </button>
                        </div>
                      </article>
                    </div>
                    <div v-if="getVisibleWriteProposals(question).length > 0" class="search-view__agent-writes">
                      <h3>{{ $t('search.agentTaskWriteProposal') }}</h3>
                      <article v-for="proposal in getVisibleWriteProposals(question)" :key="proposal.id"
                        class="search-view__agent-write-card">
                        <div class="search-view__agent-write-main">
                          <strong>{{ getWriteProposalTitle(proposal) }}</strong>
                          <p>{{ proposal.reason }}</p>
                          <pre>{{ getWriteProposalPreview(proposal) }}</pre>
                        </div>
                        <div class="search-view__agent-write-actions">
                          <button type="button" class="search-view__agent-write-apply icon-action-button"
                            :disabled="Boolean(applyingWriteProposalId)"
                            @click="applyWriteProposal(question, proposal)">
                            <IconCheck :size="14" />
                            <span>{{ applyingWriteProposalId === proposal.id ? $t('search.agentTaskApplying') :
                              getWriteProposalActionLabel(proposal) }}</span>
                          </button>
                          <button type="button" class="search-view__agent-write-dismiss"
                            :disabled="Boolean(applyingWriteProposalId)"
                            @click="dismissWriteProposal(question, proposal.id)">
                            {{ $t('search.agentTaskDismissWrite') }}
                          </button>
                        </div>
                      </article>
                    </div>
                    <div v-if="getExecutedWrites(question).length > 0" class="search-view__agent-writes">
                      <h3>{{ $t('search.agentTaskExecutedWrites') }}</h3>
                      <article v-for="write in getExecutedWrites(question)" :key="write.id"
                        class="search-view__agent-write-card search-view__agent-write-card--executed">
                        <div class="search-view__agent-write-main">
                          <strong>{{ write.noteTitle }}</strong>
                          <p>{{ write.reason }}</p>
                          <pre>{{ getExecutedWritePreview(write) }}</pre>
                        </div>
                        <div class="search-view__agent-write-actions">
                          <button type="button" class="search-view__agent-write-apply icon-action-button"
                            @click="openExecutedWrite(write)">
                            <IconFileText :size="14" />
                            <span>{{ $t('search.agentTaskOpenExecutedWrite') }}</span>
                          </button>
                        </div>
                      </article>
                    </div>
                  </template>
                </div>
              </div>
            </article>
          </div>
        </div>

        <section class="search-view__query">
          <div class="search-view__input-shell" :class="{ 'is-disabled': !canUseKnowledgeSearch }">
            <div class="search-view__input-main">
              <textarea ref="searchInput" v-model="searchQuery" class="search-view__input" rows="1"
                :disabled="!canUseKnowledgeSearch" :placeholder="composerPlaceholder" @input="resizeComposer"
                @keydown="handleComposerKeydown" />
              <button v-if="searchQuery" type="button" class="search-view__clear-button" :title="$t('button.clear')"
                @click="clearQuery">
                <IconX :size="14" />
              </button>
            </div>
            <div class="search-view__input-toolbar">
              <div class="search-view__toolbar-left">
                <div class="search-view__mode-selector">
                  <button type="button" class="search-view__mode-button" :disabled="isBusy"
                    :aria-label="$t('search.inputModeLabel')" :aria-expanded="isModeMenuOpen"
                    @click.stop="toggleModeMenu">
                    <IconTextScanAi v-if="inputMode === 'agent-task'" :size="14" />
                    <IconMessage2Bolt v-else :size="14" />
                    <span>{{ $t(activeInputMode.labelKey) }}</span>
                    <IconChevronDown :size="13" />
                  </button>
                  <div v-if="isModeMenuOpen" class="search-view__mode-menu">
                    <button v-for="mode in inputModes" :key="mode.id" type="button" class="search-view__mode-option"
                      :class="{ 'is-active': inputMode === mode.id }" @click="selectInputMode(mode.id)">
                      <span>{{ $t(mode.labelKey) }}</span>
                      <small>{{ $t(mode.descriptionKey) }}</small>
                    </button>
                  </div>
                </div>
                <button v-if="inputMode === 'agent-task'" type="button" class="search-view__execution-button"
                  :disabled="isBusy"
                  :title="$t(agentWriteMode === 'auto' ? 'search.agentWriteModeAutoDescription' : 'search.agentWriteModeConfirmDescription')"
                  @click="toggleAgentWriteMode">
                  {{ $t(agentWriteMode === 'auto' ? 'search.agentWriteModeAuto' : 'search.agentWriteModeConfirm') }}
                </button>
              </div>
              <div class="search-view__toolbar-right">
                <button type="button" class="search-view__ask-button icon-action-button" :disabled="!canAsk"
                  :title="canUseKnowledgeSearch ? $t('search.knowledgeAsk') : knowledgeUnavailableReason"
                  @click="handleAsk">
                  <IconSend :size="15" />
                </button>
              </div>
            </div>
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
import { IconX, IconMessage2Bolt, IconSubtitlesAi, IconTrash, IconFileText, IconPlus, IconTextScanAi, IconChevronDown, IconCheck, IconSend, IconMessageChatbot } from '@tabler/icons-vue';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';
import { renderMarkdownEnhancements } from '@renderer/core/markdown/markdownEnhancements';
import { useKnowledgeCopilotConfig, useKnowledgeCopilotChat, useKnowledgeCopilotTask } from '@renderer/features/knowledge-copilot';
import { useLicenseGate } from '@renderer/features/license';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { LICENSE_FEATURES } from '@shared/license.constants';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { useWorkspace } from '@renderer/features/workspace';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useSettingsStore } from '@renderer/features/settings';
import type {
  KnowledgeCopilotExecutedWrite,
  KnowledgeCopilotPendingAction,
  KnowledgeAnswerStage,
  KnowledgeCopilotStep,
  KnowledgeCopilotTraceEvent,
  KnowledgeCopilotWriteMode,
  KnowledgeCopilotWriteProposal,
  KnowledgeSearchResult,
} from '@renderer/core/bridge/electronApi';
import type { WorkbenchQuestionEntry, WorkbenchQuestionSource } from '@renderer/features/workbench/constants/workbench.constants';
import { KNOWLEDGE_COPILOT_CONVERSATION_LIMITS, type KnowledgeCopilotConversationContext } from '@shared/knowledge-copilot.constants';
import { useSearch } from '../composables/useSearch';

type KnowledgeInputMode = 'ask' | 'agent-task';

interface InputModeOption {
  id: KnowledgeInputMode;
  labelKey: string;
  descriptionKey: string;
}

interface QuestionThread {
  id: string;
  title: string;
  preview: string;
  askedAt: number;
  questions: WorkbenchQuestionEntry[];
  latestQuestion: WorkbenchQuestionEntry | null;
  isDraft: boolean;
}

interface AgentTaskMetadata {
  writeMode: KnowledgeCopilotWriteMode;
  steps: KnowledgeCopilotStep[];
  traceEvents: KnowledgeCopilotTraceEvent[];
  pendingWrites: KnowledgeCopilotWriteProposal[];
  executedWrites: KnowledgeCopilotExecutedWrite[];
  dismissedWriteIds: string[];
  createdWriteIds: string[];
  conversationId: string;
  pendingActions: KnowledgeCopilotPendingAction[];
}

const searchViewLogger = createLogger('SearchView');
const { t } = useI18n();
const workbenchStore = useWorkbenchStore();
const { conversationThreads } = storeToRefs(workbenchStore);
const appShellStore = useAppShellStore();
const settingsStore = useSettingsStore();
const { config } = storeToRefs(settingsStore);
const { selectNote, createNote, initializeWorkspace, applyNoteContentUpdate } = useWorkspace();
const { searchViewRequest } = useSearch();
const { isEnabled: knowledgeCopilotEnabled, isConfigured: knowledgeCopilotConfigured } = useKnowledgeCopilotConfig();
const { askQuestionStream, isGenerating: isAIGenerating, usedSearchFallback } = useKnowledgeCopilotChat();
const { runTask, resumeTask, isRunning: isAgentRunning } = useKnowledgeCopilotTask();
const knowledgeCopilotLicenseGate = useLicenseGate(LICENSE_FEATURES.KNOWLEDGE_COPILOT);

const inputModes: InputModeOption[] = [
  {
    id: 'ask',
    labelKey: 'search.inputModeQa',
    descriptionKey: 'search.inputModeQaDescription',
  },
  {
    id: 'agent-task',
    labelKey: 'search.inputModeAgentTask',
    descriptionKey: 'search.inputModeAgentTaskDescription',
  },
];

const inputMode = ref<KnowledgeInputMode>(config.value.knowledgeCopilot.defaultMode === 'agent' ? 'agent-task' : 'ask');
const isModeMenuOpen = ref(false);
const searchQuery = ref('');
const semanticResults = ref<KnowledgeSearchResult[]>([]);
const isSearching = ref(false);
const searchError = ref('');
const searchInput = ref<HTMLTextAreaElement | null>(null);
const messageListRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const selectedQuestion = ref<WorkbenchQuestionEntry | null>(null);
const activeThreadId = ref<string | null>(null);
const draftThreadId = ref<string | null>(null);
const draftThreadCreatedAt = ref(0);
const generatingQuestionId = ref('');
const generatingQuestionMode = ref<KnowledgeInputMode | null>(null);
const activeFallbackQuestionId = ref('');
const activeErrorQuestionId = ref('');
const activeErrorMessage = ref('');
const questionModes = ref<Record<string, KnowledgeInputMode>>({});
const agentTaskMetadata = ref<Record<string, AgentTaskMetadata>>({});
const streamingAnswers = ref<Record<string, string>>({});
const questionAnswerStages = ref<Record<string, KnowledgeAnswerStage>>({});
const applyingWriteProposalId = ref('');
const savingSummaryActionId = ref('');
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let markdownEnhancementRunId = 0;

const HISTORY_PANE_DEFAULT_WIDTH = 300;
const HISTORY_PANE_MIN_WIDTH = 220;
const HISTORY_PANE_MAX_WIDTH = 480;
const ANSWER_PANE_MIN_WIDTH = 400;

const historyPaneWidth = ref(HISTORY_PANE_DEFAULT_WIDTH);
const isResizingPane = ref(false);

const historyPaneStyle = computed(() => {
  const w = `${historyPaneWidth.value}px`;
  return { width: w, minWidth: w, maxWidth: w, flex: `0 0 ${w}` };
});

function clampHistoryPaneWidth(): void {
  const container = contentRef.value;
  if (!container) return;
  const maxW = Math.min(HISTORY_PANE_MAX_WIDTH, container.clientWidth - ANSWER_PANE_MIN_WIDTH);
  historyPaneWidth.value = Math.round(
    Math.max(HISTORY_PANE_MIN_WIDTH, Math.min(historyPaneWidth.value, maxW)),
  );
}

function handlePaneResizeMove(event: PointerEvent): void {
  const container = contentRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const maxW = Math.min(HISTORY_PANE_MAX_WIDTH, rect.width - ANSWER_PANE_MIN_WIDTH);
  historyPaneWidth.value = Math.round(
    Math.max(HISTORY_PANE_MIN_WIDTH, Math.min(event.clientX - rect.left, maxW)),
  );
}

function handlePaneResizeEnd(): void {
  isResizingPane.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('pointermove', handlePaneResizeMove);
  window.removeEventListener('pointerup', handlePaneResizeEnd);
  window.removeEventListener('pointercancel', handlePaneResizeEnd);
}

function handleDividerPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  isResizingPane.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', handlePaneResizeMove);
  window.addEventListener('pointerup', handlePaneResizeEnd);
  window.addEventListener('pointercancel', handlePaneResizeEnd);
}

const canUseKnowledgeSearch = computed(() => knowledgeCopilotLicenseGate.allowed.value && knowledgeCopilotEnabled.value && knowledgeCopilotConfigured.value);
const isBusy = computed(() => isSearching.value || isAIGenerating.value || isAgentRunning.value);
const canAsk = computed(() => canUseKnowledgeSearch.value && Boolean(searchQuery.value.trim()) && !isBusy.value);
const activeInputMode = computed(() => inputModes.find((mode) => mode.id === inputMode.value) ?? inputModes[0]);
const agentWriteMode = computed<KnowledgeCopilotWriteMode>(() => config.value.workbench.agentWriteMode ?? 'confirm');
const composerPlaceholder = computed(() => (
  inputMode.value === 'agent-task'
    ? t('search.agentTaskPlaceholder')
    : t('search.semanticPlaceholder')
));
const knowledgeUnavailableReason = computed(() => {
  if (!knowledgeCopilotLicenseGate.allowed.value) {
    return t('license.gate.knowledgeCopilot.title');
  }
  if (!knowledgeCopilotEnabled.value) {
    return t('search.knowledgeUnavailableDisabled');
  }
  if (!knowledgeCopilotConfigured.value) {
    return t('message.error.knowledgeCopilotNotConfigured');
  }
  return '';
});
const questionThreads = computed<QuestionThread[]>(() => {
  const threadMap = new Map<string, WorkbenchQuestionEntry[]>();

  conversationThreads.value.forEach((thread) => threadMap.set(thread.id, thread.questions));

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

function toggleModeMenu(): void {
  if (isBusy.value) {
    return;
  }

  isModeMenuOpen.value = !isModeMenuOpen.value;
}

function selectInputMode(mode: KnowledgeInputMode): void {
  inputMode.value = mode;
  isModeMenuOpen.value = false;
  focusSearchInput();
}

function createThreadId(askedAt: number): string {
  return `${askedAt}:thread`;
}

function getThreadConversationContext(threadId: string): KnowledgeCopilotConversationContext {
  const thread = conversationThreads.value.find((entry) => entry.id === threadId);
  return {
    summary: thread?.summary,
    summaryUpToQuestionId: thread?.summaryUpToQuestionId,
    turns: (thread?.questions ?? [])
    .map((question): KnowledgeCopilotConversationContext['turns'][number] | null => {
      const answer = (question.fullAnswer || question.answer).trim();
      if (!answer) {
        return null;
      }

      return {
        id: question.id,
        mode: question.mode === 'agent-task' ? 'agent-task' : 'ask',
        query: question.query.trim().slice(0, KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.QUESTION_LENGTH),
        answer: answer.slice(0, KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.ANSWER_LENGTH),
      };
    })
    .filter((turn): turn is KnowledgeCopilotConversationContext['turns'][number] => turn !== null)
    .slice(-KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.VISIBLE_TURNS),
  };
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

async function syncMarkdownEnhancements(): Promise<void> {
  const runId = ++markdownEnhancementRunId;
  await nextTick();
  if (runId !== markdownEnhancementRunId) {
    return;
  }

  await renderMarkdownEnhancements(messageListRef.value);
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
  generatingQuestionMode.value = null;
  activeFallbackQuestionId.value = '';
  activeErrorQuestionId.value = '';
  activeErrorMessage.value = '';
  streamingAnswers.value = {};
  questionAnswerStages.value = {};
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
  isModeMenuOpen.value = false;

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
    if (inputMode.value === 'agent-task') {
      void runAgentTaskQuestion(query);
      return;
    }

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
  semanticResults.value = [];
  isSearching.value = true;
  let draftQuestion: WorkbenchQuestionEntry | null = null;

  try {
    const askedAt = Date.now();
    const threadId = activeThreadId.value ?? createThreadId(askedAt);
    const context = getThreadConversationContext(threadId);
    activeThreadId.value = threadId;
    draftQuestion = await workbenchStore.recordQuestion({ query, threadId, mode: 'ask', askedAt });
    if (draftThreadId.value === threadId) {
      draftThreadId.value = null;
      draftThreadCreatedAt.value = 0;
    }
    selectedQuestion.value = draftQuestion;
    generatingQuestionId.value = draftQuestion?.id ?? '';
    generatingQuestionMode.value = 'ask';
    if (draftQuestion) {
      questionModes.value = {
        ...questionModes.value,
        [draftQuestion.id]: 'ask',
      };
      questionAnswerStages.value = {
        ...questionAnswerStages.value,
        [draftQuestion.id]: 'preparing',
      };
    }
    if (draftQuestion) {
      scrollQuestionIntoView(draftQuestion.id);
    } else {
      scrollChatToBottom();
    }

    let generatedAnswer = '';
    try {
      const result = await askQuestionStream(query, threadId, context, {
        onEvent: (event) => {
          if (event.type === 'stage' && draftQuestion) {
            questionAnswerStages.value = {
              ...questionAnswerStages.value,
              [draftQuestion.id]: event.stage,
            };
            return;
          }

          if (event.type === 'sources') {
            semanticResults.value = event.sources;
            usedSearchFallback.value = event.usedSearchFallback;
          }
        },
        onDelta: (text) => {
          if (!draftQuestion) {
            return;
          }

          streamingAnswers.value = {
            ...streamingAnswers.value,
            [draftQuestion.id]: `${streamingAnswers.value[draftQuestion.id] || ''}${text}`,
          };
          scrollChatToBottom();
        },
      });
      semanticResults.value = result.sources;
      generatedAnswer = result.answer || (draftQuestion ? streamingAnswers.value[draftQuestion.id] || '' : '');
      await workbenchStore.updateConversationSummary(threadId, result.conversationSummary, result.conversationSummaryUpToQuestionId);
    } catch (error) {
      const message = getErrorMessage(error);
      semanticResults.value = [];
      searchViewLogger.error(`Knowledge answer generation failed: ${message}`);
      if (draftQuestion) {
        activeErrorQuestionId.value = draftQuestion.id;
        activeErrorMessage.value = message;
      } else {
        searchError.value = message;
      }
    }

    if (draftQuestion && usedSearchFallback.value) {
      activeFallbackQuestionId.value = draftQuestion.id;
    }

    const recordedQuestion = await workbenchStore.recordQuestion({
      query,
      threadId,
      askedAt,
      answeredAt: generatedAnswer.trim() ? Date.now() : undefined,
      answer: generatedAnswer,
      sourceNoteIds: Array.from(new Set(semanticResults.value.map((result) => result.chunk.noteId))),
      sources: currentSources.value,
      mode: 'ask',
    });
    selectedQuestion.value = recordedQuestion;
    if (recordedQuestion) {
      if (draftQuestion) {
        const nextStreamingAnswers = { ...streamingAnswers.value };
        delete nextStreamingAnswers[draftQuestion.id];
        streamingAnswers.value = nextStreamingAnswers;
        const nextQuestionAnswerStages = { ...questionAnswerStages.value };
        delete nextQuestionAnswerStages[draftQuestion.id];
        questionAnswerStages.value = nextQuestionAnswerStages;
      }
      questionModes.value = {
        ...questionModes.value,
        [recordedQuestion.id]: 'ask',
      };
    }
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
    generatingQuestionMode.value = null;
    focusSearchInput();
  }
}

function setAgentTaskMetadata(questionId: string, metadata: AgentTaskMetadata): void {
  agentTaskMetadata.value = {
    ...agentTaskMetadata.value,
    [questionId]: metadata,
  };
}

async function toggleAgentWriteMode(): Promise<void> {
  const nextMode: KnowledgeCopilotWriteMode = agentWriteMode.value === 'auto' ? 'confirm' : 'auto';
  await settingsStore.saveSettings({
    workbench: {
      ...config.value.workbench,
      agentWriteMode: nextMode,
    },
  });
}

async function runAgentTaskQuestion(query: string): Promise<void> {
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
  semanticResults.value = [];
  isSearching.value = true;
  let draftQuestion: WorkbenchQuestionEntry | null = null;
  let metadata: AgentTaskMetadata = {
    writeMode: agentWriteMode.value,
    steps: [],
    traceEvents: [],
    pendingWrites: [],
    executedWrites: [],
    dismissedWriteIds: [],
    createdWriteIds: [],
    conversationId: '',
    pendingActions: [],
  };

  try {
    const askedAt = Date.now();
    const threadId = activeThreadId.value ?? createThreadId(askedAt);
    const context = getThreadConversationContext(threadId);
    activeThreadId.value = threadId;
    draftQuestion = await workbenchStore.recordQuestion({
      query,
      threadId,
      mode: 'agent-task',
      agentWriteMode: agentWriteMode.value,
      askedAt,
    });
    if (draftThreadId.value === threadId) {
      draftThreadId.value = null;
      draftThreadCreatedAt.value = 0;
    }
    selectedQuestion.value = draftQuestion;
    generatingQuestionId.value = draftQuestion?.id ?? '';
    generatingQuestionMode.value = 'agent-task';
    if (draftQuestion) {
      questionModes.value = {
        ...questionModes.value,
        [draftQuestion.id]: 'agent-task',
      };
      scrollQuestionIntoView(draftQuestion.id);
    } else {
      scrollChatToBottom();
    }

    let generatedAnswer = '';
    try {
      const result = await runTask(query, agentWriteMode.value, threadId, context);
      await workbenchStore.updateConversationSummary(threadId, result.conversationSummary, result.conversationSummaryUpToQuestionId);
      semanticResults.value = result.sources;
      generatedAnswer = result.finalAnswer || '';
      metadata = {
        writeMode: result.writeMode,
        steps: result.steps,
        traceEvents: result.traceEvents,
        pendingWrites: result.pendingWrites,
        executedWrites: result.executedWrites,
        dismissedWriteIds: [],
        createdWriteIds: [],
        conversationId: result.conversationId,
        pendingActions: result.pendingActions,
      };
      if (result.executedWrites.length > 0) {
        await initializeWorkspace();
      }
      if (draftQuestion) {
        setAgentTaskMetadata(draftQuestion.id, metadata);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      semanticResults.value = [];
      searchViewLogger.error(`Agent task failed: ${message}`);
      if (draftQuestion) {
        activeErrorQuestionId.value = draftQuestion.id;
        activeErrorMessage.value = message;
      } else {
        searchError.value = message;
      }
    }

    const recordedQuestion = await workbenchStore.recordQuestion({
      query,
      threadId,
      askedAt,
      answeredAt: generatedAnswer.trim() ? Date.now() : undefined,
      answer: generatedAnswer,
      sourceNoteIds: Array.from(new Set(semanticResults.value.map((result) => result.chunk.noteId))),
      sources: currentSources.value,
      mode: 'agent-task',
      agentWriteMode: metadata.writeMode,
      agentSteps: metadata.steps,
      agentTraceEvents: metadata.traceEvents,
      pendingWrites: metadata.pendingWrites,
      executedWrites: metadata.executedWrites,
      dismissedWriteIds: metadata.dismissedWriteIds,
      createdWriteIds: metadata.createdWriteIds,
    });
    selectedQuestion.value = recordedQuestion;
    if (recordedQuestion) {
      questionModes.value = {
        ...questionModes.value,
        [recordedQuestion.id]: 'agent-task',
      };
      scrollQuestionIntoView(recordedQuestion.id);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    searchViewLogger.error(`Agent task record failed: ${message}`);
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
    generatingQuestionMode.value = null;
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

  const hasDeleted = await workbenchStore.deleteConversationThread(thread.id);

  if (hasDeleted && activeThreadId.value === thread.id) {
    activeThreadId.value = null;
    resetAnswer();
  }
}

function getQuestionPreview(question: WorkbenchQuestionEntry): string {
  if (isGeneratingQuestion(question)) {
    return getQuestionThinkingLabel(question);
  }

  return question.answer || t('workbench.empty.noAnswer');
}

function getQuestionMode(question: WorkbenchQuestionEntry): KnowledgeInputMode {
  return question.mode ?? questionModes.value[question.id] ?? 'ask';
}

function getQuestionThinkingLabel(question: WorkbenchQuestionEntry): string {
  if (generatingQuestionId.value === question.id && generatingQuestionMode.value === 'agent-task') {
    return t('search.agentTaskThinking');
  }

  const stage = questionAnswerStages.value[question.id] ?? 'preparing';
  return t(`search.knowledgeAnswerStage.${stage}`);
}

function getQuestionAnswer(question: WorkbenchQuestionEntry): string {
  const streamingAnswer = streamingAnswers.value[question.id];
  if (streamingAnswer) {
    return streamingAnswer;
  }

  return question.fullAnswer || question.answer;
}

function canSaveQuestionAsNote(question: WorkbenchQuestionEntry): boolean {
  return getQuestionMode(question) === 'agent-task' && getQuestionAnswer(question).trim().length > 0;
}

function getQuestionSources(question: WorkbenchQuestionEntry): WorkbenchQuestionSource[] {
  if (generatingQuestionId.value === question.id && currentSources.value.length > 0) {
    return currentSources.value;
  }

  if (question.sources?.length) {
    return question.sources;
  }

  return [];
}

function getAgentMetadata(question: WorkbenchQuestionEntry): AgentTaskMetadata | null {
  if (getQuestionMode(question) !== 'agent-task') {
    return null;
  }

  const localMetadata = agentTaskMetadata.value[question.id];
  if (localMetadata) {
    return localMetadata;
  }

  return {
    writeMode: (question.agentWriteMode === 'auto' ? 'auto' : 'confirm'),
    steps: question.agentSteps ?? [],
    traceEvents: question.agentTraceEvents ?? [],
    pendingWrites: question.pendingWrites ?? [],
    executedWrites: question.executedWrites ?? [],
    dismissedWriteIds: question.dismissedWriteIds ?? [],
    createdWriteIds: question.createdWriteIds ?? [],
    conversationId: question.threadId,
    pendingActions: [],
  };
}

function getPendingActions(question: WorkbenchQuestionEntry): KnowledgeCopilotPendingAction[] {
  return getAgentMetadata(question)?.pendingActions ?? [];
}

async function editAndResumeAgentAction(question: WorkbenchQuestionEntry, action: KnowledgeCopilotPendingAction, actionIndex: number): Promise<void> {
  const editedJson = window.prompt(t('search.agentTaskEditActionPrompt'), JSON.stringify(action.args, null, 2));
  if (editedJson === null) return;
  try {
    const parsed = JSON.parse(editedJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(t('search.agentTaskInvalidActionArgs'));
    const metadata = getAgentMetadata(question);
    if (!metadata) return;
    const decisions = metadata.pendingActions.map((_pendingAction, index) => index === actionIndex
      ? ({ type: 'edit' as const, editedAction: { name: action.name, args: parsed as Record<string, unknown> } })
      : ({ type: 'reject' as const, message: 'Only the explicitly edited action was approved' }));
    const result = await resumeTask(metadata.conversationId || question.threadId, decisions, metadata.writeMode);
    setAgentTaskMetadata(question.id, {
      ...metadata,
      steps: [...metadata.steps, ...result.steps],
      traceEvents: [...metadata.traceEvents, ...result.traceEvents],
      executedWrites: [...result.executedWrites, ...metadata.executedWrites],
      pendingActions: result.pendingActions,
      conversationId: result.conversationId,
    });
  } catch (error) {
    activeErrorQuestionId.value = question.id;
    activeErrorMessage.value = getErrorMessage(error);
  }
}

async function resumeAgentAction(question: WorkbenchQuestionEntry, decision: 'approve' | 'reject'): Promise<void> {
  const metadata = getAgentMetadata(question);
  if (!metadata || metadata.pendingActions.length === 0) return;
  const decisions = metadata.pendingActions.map(() => decision === 'approve'
    ? ({ type: 'approve' as const })
    : ({ type: 'reject' as const, message: 'User rejected this action' }));
  const result = await resumeTask(metadata.conversationId || question.threadId, decisions, metadata.writeMode);
  setAgentTaskMetadata(question.id, {
    ...metadata,
    steps: [...metadata.steps, ...result.steps],
    traceEvents: [...metadata.traceEvents, ...result.traceEvents],
    executedWrites: [...result.executedWrites, ...metadata.executedWrites],
    pendingActions: result.pendingActions,
    conversationId: result.conversationId,
  });
}

function getAgentSteps(question: WorkbenchQuestionEntry): KnowledgeCopilotStep[] {
  return getAgentMetadata(question)?.steps ?? [];
}

function getAgentTraceEvents(question: WorkbenchQuestionEntry): KnowledgeCopilotTraceEvent[] {
  return getAgentMetadata(question)?.traceEvents ?? [];
}

function getExecutedWrites(question: WorkbenchQuestionEntry): KnowledgeCopilotExecutedWrite[] {
  return getAgentMetadata(question)?.executedWrites ?? [];
}

function formatAgentStepTitle(step: KnowledgeCopilotStep): string {
  const keyMap: Record<string, string> = {
    searchKnowledgeBase: 'search.agentStep.searchKnowledgeBase',
    listRecentNotes: 'search.agentStep.listRecentNotes',
    readNote: 'search.agentStep.readNote',
    proposeCreateNote: 'search.agentStep.proposeCreateNote',
    proposeUpdateNote: 'search.agentStep.proposeUpdateNote',
    createNote: 'search.agentStep.createNote',
    updateNote: 'search.agentStep.updateNote',
    configureChatModel: 'search.agentStep.configureChatModel',
  };

  const key = keyMap[step.title];
  return key ? t(key) : step.title;
}

function formatAgentStepDetail(step: KnowledgeCopilotStep): string {
  if (step.title === 'searchKnowledgeBase') {
    return t('search.agentStep.searchKnowledgeBaseDetail', { count: step.detail });
  }

  if (step.title === 'configureChatModel') {
    return t('search.agentStep.configureChatModelDetail');
  }

  return step.detail;
}

function formatAgentTraceTitle(event: KnowledgeCopilotTraceEvent): string {
  if (event.type === 'model-response') {
    return t('search.agentTrace.modelResponse');
  }

  if (event.type === 'tool-call') {
    return t('search.agentTrace.toolCall', { tool: event.toolName ?? event.title });
  }

  if (event.type === 'tool-error') {
    return t('search.agentTrace.toolError', { tool: event.toolName ?? event.title });
  }

  return t('search.agentTrace.toolResult', { tool: event.toolName ?? event.title });
}

function formatAgentTraceDetail(event: KnowledgeCopilotTraceEvent): string {
  const duration = typeof event.durationMs === 'number'
    ? t('search.agentTrace.duration', { duration: event.durationMs })
    : '';
  if (event.type === 'model-response') {
    return `${t('search.agentTrace.modelResponseDetail', { count: event.detail })}${duration}`;
  }

  const detail = event.detail.length > 180 ? `${event.detail.slice(0, 180)}...` : event.detail;
  return duration ? `${detail} ${duration}` : detail;
}

function getVisibleWriteProposals(question: WorkbenchQuestionEntry): KnowledgeCopilotWriteProposal[] {
  const metadata = getAgentMetadata(question);
  if (!metadata) {
    return [];
  }

  return metadata.pendingWrites.filter((proposal) => (
    !metadata.dismissedWriteIds.includes(proposal.id)
    && !metadata.createdWriteIds.includes(proposal.id)
  ));
}

function getWriteProposalPreview(proposal: KnowledgeCopilotWriteProposal): string {
  const content = proposal.content.trim();
  return content.length > 240 ? `${content.slice(0, 240)}...` : content;
}

function getWriteProposalTitle(proposal: KnowledgeCopilotWriteProposal): string {
  if (proposal.type === 'create-note') {
    return proposal.title;
  }

  return proposal.noteTitle;
}

function getWriteProposalActionLabel(proposal: KnowledgeCopilotWriteProposal): string {
  return proposal.type === 'create-note'
    ? t('search.agentTaskApplyWrite')
    : t('search.agentTaskApplyUpdate');
}

function buildSummaryNoteTitle(question: WorkbenchQuestionEntry): string {
  const normalizedQuery = question.query.trim().replace(/\s+/g, ' ');
  if (!normalizedQuery) {
    return t('search.agentTaskSavedNoteFallbackTitle');
  }

  const maxLength = 42;
  const baseTitle = normalizedQuery.length > maxLength
    ? `${normalizedQuery.slice(0, maxLength).trim()}...`
    : normalizedQuery;

  return t('search.agentTaskSavedNoteTitle', { query: baseTitle });
}

function buildSummaryNoteContent(question: WorkbenchQuestionEntry): string {
  const title = buildSummaryNoteTitle(question);
  const answer = getQuestionAnswer(question).trim();
  const sources = getQuestionSources(question);
  const sourceBlock = sources.length > 0
    ? [
      '',
      `## ${t('search.knowledgeSources')}`,
      ...sources.map((source) => `- ${source.noteTitle}`),
    ].join('\n')
    : '';

  return [
    `# ${title}`,
    '',
    answer,
    sourceBlock,
  ].join('\n');
}

async function persistFullQuestion(
  question: WorkbenchQuestionEntry,
  metadata: AgentTaskMetadata,
): Promise<WorkbenchQuestionEntry | null> {
  const updatedQuestion = await workbenchStore.recordQuestion({
    query: question.query,
    threadId: question.threadId,
    mode: getQuestionMode(question),
    agentWriteMode: metadata.writeMode,
    askedAt: question.askedAt,
    answeredAt: question.answeredAt,
    answer: getQuestionAnswer(question),
    sourceNoteIds: question.sourceNoteIds,
    sources: getQuestionSources(question),
    agentSteps: metadata.steps,
    agentTraceEvents: metadata.traceEvents,
    pendingWrites: metadata.pendingWrites,
    executedWrites: metadata.executedWrites,
    dismissedWriteIds: metadata.dismissedWriteIds,
    createdWriteIds: metadata.createdWriteIds,
  });

  if (updatedQuestion) {
    setAgentTaskMetadata(updatedQuestion.id, metadata);
    if (selectedQuestion.value?.id === question.id) {
      selectedQuestion.value = updatedQuestion;
    }
  }

  return updatedQuestion;
}

function getExecutedWritePreview(write: KnowledgeCopilotExecutedWrite): string {
  const content = write.content.trim();
  return content.length > 240 ? `${content.slice(0, 240)}...` : content;
}

async function openExecutedWrite(write: KnowledgeCopilotExecutedWrite): Promise<void> {
  await initializeWorkspace();
  await openNoteResult(write.noteId, write.noteTitle);
}

async function saveQuestionAsNote(question: WorkbenchQuestionEntry): Promise<void> {
  const metadata = getAgentMetadata(question);
  if (!metadata || savingSummaryActionId.value) {
    return;
  }

  const proposal: KnowledgeCopilotWriteProposal = {
    id: `agent-write-manual-${Date.now()}`,
    type: 'create-note',
    title: buildSummaryNoteTitle(question),
    content: buildSummaryNoteContent(question),
    reason: t('search.agentTaskSaveAsNoteReason'),
  };

  savingSummaryActionId.value = `${question.id}:create`;
  try {
    if (metadata.writeMode === 'auto') {
      await initializeWorkspace();
      const createdNote = await createNote(null, proposal.title, proposal.content);
      if (!createdNote) {
        return;
      }

      const executedWrite: KnowledgeCopilotExecutedWrite = {
        id: proposal.id,
        type: 'create-note',
        noteId: createdNote.id,
        noteTitle: createdNote.title,
        content: proposal.content,
        reason: proposal.reason,
      };

      const nextMetadata: AgentTaskMetadata = {
        ...metadata,
        executedWrites: [executedWrite, ...metadata.executedWrites].slice(0, 8),
      };

      await persistFullQuestion(question, nextMetadata);
      await appShellStore.setActiveMainView('workspace');
      selectNote(createdNote.id);
      return;
    }

    const nextMetadata: AgentTaskMetadata = {
      ...metadata,
      pendingWrites: [proposal, ...metadata.pendingWrites].slice(0, 8),
      dismissedWriteIds: metadata.dismissedWriteIds.filter((id) => id !== proposal.id),
      createdWriteIds: metadata.createdWriteIds.filter((id) => id !== proposal.id),
    };

    await persistFullQuestion(question, nextMetadata);
  } catch (error) {
    const message = getErrorMessage(error);
    searchViewLogger.error(`Save question as note failed: ${message}`);
    activeErrorQuestionId.value = question.id;
    activeErrorMessage.value = message;
  } finally {
    savingSummaryActionId.value = '';
    focusSearchInput();
  }
}

async function persistAgentWriteState(question: WorkbenchQuestionEntry, metadata: AgentTaskMetadata): Promise<void> {
  setAgentTaskMetadata(question.id, metadata);
  const updatedQuestion = await workbenchStore.updateQuestionAgentWriteState({
    questionId: question.id,
    dismissedWriteIds: metadata.dismissedWriteIds,
    createdWriteIds: metadata.createdWriteIds,
  });

  if (updatedQuestion && selectedQuestion.value?.id === question.id) {
    selectedQuestion.value = updatedQuestion;
  }
}

async function dismissWriteProposal(question: WorkbenchQuestionEntry, proposalId: string): Promise<void> {
  const metadata = getAgentMetadata(question);
  if (!metadata || metadata.dismissedWriteIds.includes(proposalId)) {
    return;
  }

  await persistAgentWriteState(question, {
    ...metadata,
    dismissedWriteIds: [...metadata.dismissedWriteIds, proposalId],
  });
}

async function applyWriteProposal(
  question: WorkbenchQuestionEntry,
  proposal: KnowledgeCopilotWriteProposal,
): Promise<void> {
  const metadata = getAgentMetadata(question);
  if (!metadata || applyingWriteProposalId.value) {
    return;
  }

  applyingWriteProposalId.value = proposal.id;
  try {
    await initializeWorkspace();
    let targetNoteId = '';

    if (proposal.type === 'create-note') {
      const createdNote = await createNote(null, proposal.title, proposal.content);
      if (!createdNote) {
        return;
      }

      targetNoteId = createdNote.id;
    } else {
      const updated = await applyNoteContentUpdate(proposal.noteId, proposal.content);
      if (!updated) {
        throw new Error(t('search.agentTaskApplyUpdateFailed'));
      }

      targetNoteId = proposal.noteId;
    }

    await persistAgentWriteState(question, {
      ...metadata,
      createdWriteIds: [...metadata.createdWriteIds, proposal.id],
    });
    await appShellStore.setActiveMainView('workspace');
    selectNote(targetNoteId);
  } catch (error) {
    const message = getErrorMessage(error);
    searchViewLogger.error(`Create note from agent proposal failed: ${message}`);
    activeErrorQuestionId.value = question.id;
    activeErrorMessage.value = message;
  } finally {
    applyingWriteProposalId.value = '';
    focusSearchInput();
  }
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

function formatMessageTimestamp(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQuestionAskedAt(question: WorkbenchQuestionEntry): string {
  return formatMessageTimestamp(question.askedAt);
}

function formatQuestionAnsweredAt(question: WorkbenchQuestionEntry): string {
  return formatMessageTimestamp(question.answeredAt);
}

function applySearchRequest(): void {
  const request = searchViewRequest.value;
  const requestedThread = request.threadId
    ? questionThreads.value.find((thread) => thread.id === request.threadId)
    : undefined;
  if (requestedThread) {
    selectThread(requestedThread);
    return;
  }
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

watch(
  chatQuestions,
  () => {
    void syncMarkdownEnhancements();
  },
  { deep: true, flush: 'post' },
);

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (isModeMenuOpen.value && !target.closest('.search-view__mode-selector')) {
    isModeMenuOpen.value = false;
  }
}

onMounted(() => {
  applySearchRequest();
  focusSearchInput();
  scrollChatToBottom();
  void syncMarkdownEnhancements();
  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('resize', clampHistoryPaneWidth);
});

onBeforeUnmount(() => {
  clearPendingSearch();
  markdownEnhancementRunId += 1;
  document.removeEventListener('click', handleDocumentClick);
  handlePaneResizeEnd();
  window.removeEventListener('resize', clampHistoryPaneWidth);
});
</script>

<style scoped>
.search-view {
  --search-chat-surface: var(--panel);
  --search-chat-border: var(--border-muted);
  --search-chat-accent-border: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  --search-chat-accent-fill: color-mix(in srgb, var(--accent) 6%, var(--panel));
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-base);
}

.search-view__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
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
  border-radius: var(--radius-md);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.search-view__title {
  margin: 0;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
}


.search-view__query {
  flex: 0 0 auto;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--panel-border);
  background: var(--surface-base);
}

.search-view__input-shell {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-md);
  background: var(--panel);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.search-view__input-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent);
}

.search-view__input-shell.is-disabled {
  opacity: 0.64;
}

.search-view__input-main {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 4px;
}

.search-view__input {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 44px;
  max-height: 140px;
  padding: 8px 10px;
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

.search-view__clear-button {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  margin: 6px 6px 0 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.search-view__clear-button:hover {
  background: var(--panel-hover);
  color: var(--text);
}

.search-view__input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  background: var(--surface-subtle);
  border-top: 1px solid color-mix(in srgb, var(--search-chat-border) 60%, transparent);
  border-bottom-left-radius: 7px;
  border-bottom-right-radius: 7px;
}

.search-view__toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-view__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-view__mode-selector {
  position: relative;
  flex: 0 0 auto;
}

.search-view__mode-button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.search-view__mode-button:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--search-chat-border));
  color: var(--text);
  background: var(--panel-hover);
}

.search-view__mode-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.search-view__mode-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  z-index: 10;
  width: 228px;
  padding: 6px;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-md);
  background: var(--panel);
  box-shadow: 0 10px 25px color-mix(in srgb, #000 12%, transparent);
}

.search-view__mode-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.search-view__mode-option:hover,
.search-view__mode-option.is-active {
  border-color: color-mix(in srgb, var(--accent) 15%, transparent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.search-view__mode-option span {
  font-size: 0.78rem;
  font-weight: 650;
}

.search-view__mode-option small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.3;
}

.search-view__execution-button {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.search-view__execution-button:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--search-chat-border));
  color: var(--text);
  background: var(--panel-hover);
}

.search-view__execution-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.search-view__ask-button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 14px;
  border-radius: 6px;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-subtle);
  border-right: 1px solid var(--panel-border);
}

.search-view__pane-divider {
  flex: 0 0 auto;
  width: 6px;
  margin: 0 -2px;
  position: relative;
  z-index: 2;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.15s ease;
}

.search-view__pane-divider::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--panel-border);
  transition: width 0.12s ease, background-color 0.12s ease;
}

.search-view__pane-divider:hover::after,
.search-view__content.is-resizing-pane .search-view__pane-divider::after {
  width: 3px;
  background: var(--accent-solid);
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
  padding: 0 18px;
  border-bottom: 1px solid var(--panel-border);
}

.search-view__pane-header h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.82rem;
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
  padding: 18px;
}

.search-view__chat-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-view__chat-turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-margin: 18px;
}

.search-view__chat-turn.is-active .search-view__assistant-card {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--search-chat-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 8%, transparent);
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

.search-view__user-message {
  max-width: min(680px, 72%);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.search-view__user-bubble {
  max-width: 100%;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--panel-border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent) 5%, var(--panel));
  color: var(--text);
  font-size: 0.9rem;
  line-height: 1.52;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.search-view__message-timestamp {
  display: inline-flex;
  font-size: 0.73rem;
  line-height: 1.2;
  color: var(--text-muted);
}

.search-view__assistant-avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--accent);
  background: var(--surface-subtle);
  border: 1px solid var(--search-chat-border);
}

.search-view__assistant-card {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-md);
  background: var(--search-chat-surface);
  box-shadow: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-view__assistant-card>.search-view__message-timestamp {
  display: block;
  margin-bottom: 8px;
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
  min-height: 72px;
  display: block;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.search-view__history-item+.search-view__history-item {
  margin-top: 4px;
}

.search-view__history-item:hover,
.search-view__history-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 6%, var(--panel));
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
  gap: 4px;
  padding: 8px 40px 8px 10px;
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
  border-radius: var(--radius-sm);
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px;
  color: var(--text-muted);
  text-align: center;
}

.search-view__status-icon {
  color: color-mix(in srgb, var(--accent) 35%, var(--text-muted));
  margin-bottom: 4px;
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
  border-radius: var(--radius-md);
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
  line-height: 1.5;
}

.search-view__sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--search-chat-border);
}

.search-view__answer-actions {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-view__save-note-button {
  height: 32px;
  padding: 0 12px;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__sources h3 {
  flex: 0 0 auto;
  margin: 0 4px 0 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__agent-steps,
.search-view__agent-trace,
.search-view__agent-writes {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--search-chat-border);
}

.search-view__agent-steps h3,
.search-view__agent-trace h3,
.search-view__agent-writes h3 {
  margin: 0 0 10px;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__agent-steps ol,
.search-view__agent-trace ol {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-view__agent-steps li,
.search-view__agent-trace li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--text);
  font-size: 0.8rem;
}

.search-view__agent-steps li::before,
.search-view__agent-trace li::before {
  content: '';
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--accent-solid);
}

.search-view__agent-steps li.is-failed::before,
.search-view__agent-trace li.is-failed::before {
  background: var(--color-danger, #ef4444);
}

.search-view__agent-steps span,
.search-view__agent-trace span {
  flex: 0 0 auto;
  font-weight: 700;
}

.search-view__agent-steps small,
.search-view__agent-trace small {
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.search-view__agent-write-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--search-chat-accent-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent) 5%, var(--search-chat-surface));
}

.search-view__agent-write-card--executed {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--search-chat-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--search-chat-surface));
}

.search-view__agent-write-card+.search-view__agent-write-card {
  margin-top: 10px;
}

.search-view__agent-write-main {
  min-width: 0;
  flex: 1;
}

.search-view__agent-write-main strong {
  display: block;
  color: var(--text);
  font-size: 0.84rem;
}

.search-view__agent-write-main p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.search-view__agent-write-main pre {
  max-height: 112px;
  margin: 9px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.76rem;
  line-height: 1.45;
}

.search-view__agent-write-actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
}

.search-view__agent-write-apply {
  height: 30px;
  padding: 0 10px;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 700;
}

.search-view__agent-write-dismiss {
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--search-chat-border);
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.74rem;
  cursor: pointer;
}

.search-view__agent-write-dismiss:hover {
  color: var(--text);
  background: var(--panel-hover);
}

.search-view__source-card {
  flex: 0 1 auto;
  max-width: min(300px, 100%);
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--search-chat-border);
  border-radius: var(--radius-sm);
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
    flex: 0 0 190px !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    border-bottom: 1px solid var(--panel-border);
  }

  .search-view__pane-divider {
    display: none;
  }

  .search-view__history-item {
    min-height: 70px;
  }

  /* Responsive input-shell is handled automatically by column layout */

  .search-view__agent-write-card {
    flex-direction: column;
  }

  .search-view__agent-write-actions {
    flex-direction: row;
  }
}
</style>


