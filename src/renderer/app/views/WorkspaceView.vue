<template>
  <div ref="workspaceViewRef" class="workspace-view" :class="workspaceViewClass" @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave" @pointerdown="handlePointerDown">
    <div ref="sidebarPaneRef" class="workspace-pane workspace-pane--sidebar" :style="sidebarPaneStyle">
      <WorkspaceSidebar />
    </div>

    <section v-if="!activeNote?.locked" ref="editorSectionRef" class="editor-col panel" :style="editorPaneStyle">
      <div v-if="activeNote" class="col-header">
        <div class="header-left">
          <span class="col-title">{{ $t("common.editor") }}</span>
          <span class="header-separator">/</span>
          <span class="header-note-title" :title="activeNote.title">{{ activeNote.title }}</span>
        </div>
      </div>
      <div v-else-if="activeNotebookId" class="col-header">
        <span class="col-title">{{ $t("workspace.dashboard.title") }}</span>
      </div>

      <div v-if="activeNote" class="editor-wrapper">
        <EditorToolbar :editor-view="editorView" />
        <EditorPane ref="editorPaneRef" :model-value="activeNote.content" @update:model-value="updateActiveContent"
          @selection-change="handleSelectionChange" />
        <EditorStatus :cursor-position="cursorPosition" :selected-text="selectedText" />
      </div>
      <div v-else-if="activeNotebookId" class="editor-wrapper">
        <NotebookDashboard />
      </div>
      <div v-else class="col-empty">
        <p>{{ $t("common.selectOrCreateNote") }}</p>
      </div>
    </section>

    <section v-if="activeNote || !activeNotebookId" ref="previewSectionRef" class="preview-col panel"
      :style="previewPaneStyle">
      <div class="col-header">
        <span class="col-title">{{ $t("common.preview") }}</span>
      </div>

      <div class="preview-body">
        <PreviewPane v-if="activeNote" ref="previewPaneRef" :html="compiledPreview.html" />

        <div v-else class="col-empty">
          <p>
            {{
              activeNotebookId
                ? $t("common.noPreviewContent")
                : $t("common.selectOrCreateNote")
            }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { EditorView } from '@codemirror/view';
import { compileMarkdown } from '@renderer/core/markdown/markdownRenderer';
import WorkspaceSidebar from '@renderer/features/workspace/components/WorkspaceSidebar.vue';
import NotebookDashboard from '@renderer/features/workspace/components/NotebookDashboard.vue';
import { EditorPane } from '@renderer/features/editor';
import EditorToolbar from '@renderer/features/editor/components/EditorToolbar.vue';
import EditorStatus from '@renderer/features/editor/components/EditorStatus.vue';
import { PreviewPane } from '@renderer/features/preview';
import { useWorkspace, useWorkspacePaneResize, workspaceService } from '@renderer/features/workspace';
import { useSettingsStore } from '@renderer/features/settings';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

interface EditorPaneExposed {
  getEditorApi: () => {
    view: EditorView;
    jumpToLine: (lineNumber: number, searchText?: string) => void;
    scrollToLine: (lineNumber: number, options?: { y?: 'start' | 'center'; focus?: boolean }) => void;
  } | undefined;
}

type PreviewScrollBehavior = 'auto' | 'smooth' | 'instant';

interface PreviewPaneExposed {
  getScrollContainer: () => HTMLElement | null;
  getSourceLineAtScrollTop: (scrollTop?: number) => number | null;
  scrollToSourceLine: (lineNumber: number, behavior?: PreviewScrollBehavior) => void;
}

const {
  activeNote,
  activeNotebookId,
  updateActiveContent,
} = useWorkspace();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const { config } = storeToRefs(settingsStore);

const workspaceViewRef = ref<HTMLElement | null>(null);
const sidebarPaneRef = ref<HTMLElement | null>(null);
const editorSectionRef = ref<HTMLElement | null>(null);
const previewSectionRef = ref<HTMLElement | null>(null);
const editorPaneRef = ref<EditorPaneExposed | null>(null);
const previewPaneRef = ref<PreviewPaneExposed | null>(null);
const cursorPosition = ref<{ line: number; column: number } | null>(null);
const selectedText = ref('');
const activeSourceLine = ref(1);
const hasPreviewPane = computed(() => Boolean(activeNote.value || !activeNotebookId.value));
const hasEditorPane = computed(() => !activeNote.value?.locked);
const hasTrailingContent = computed(() => hasEditorPane.value || hasPreviewPane.value);
const canResizePreview = computed(() => hasEditorPane.value && hasPreviewPane.value);

const {
  workspaceViewClass,
  sidebarPaneStyle,
  editorPaneStyle,
  previewPaneStyle,
  handlePointerMove,
  handlePointerLeave,
  handlePointerDown,
} = useWorkspacePaneResize({
  rootRef: workspaceViewRef,
  sidebarRef: sidebarPaneRef,
  editorRef: editorSectionRef,
  hasTrailingContentRef: hasTrailingContent,
  canResizePreviewRef: canResizePreview,
});

const compiledPreview = computed(() => {
  if (!activeNote.value) {
    return {
      html: '',
    };
  }

  return compileMarkdown(activeNote.value.content, {
    allowHtml: config.value.previewAppearance.allowHtml,
    allowInlineSvg: config.value.previewAppearance.allowInlineSvg,
    remoteImageMode: config.value.previewAppearance.remoteImageMode,
    trustedRemoteImageHosts: config.value.previewAppearance.trustedRemoteImageHosts,
    blockedImageLabel: t('preview.remoteImageBlocked'),
    copyCodeButtonLabel: t('preview.copyCode'),
    contentId: activeNote.value.contentId,
    workspaceRoot: workspaceService.getCurrentWorkspaceRoot(),
  });
});

const editorView = computed<EditorView | undefined>(() => {
  return editorPaneRef.value?.getEditorApi()?.view;
});

let removeEditorScrollListener: (() => void) | null = null;
let removePreviewScrollListener: (() => void) | null = null;
let ignoreEditorScroll = false;
let ignorePreviewScroll = false;
let releaseEditorIgnoreTimer: ReturnType<typeof setTimeout> | null = null;
let releasePreviewIgnoreTimer: ReturnType<typeof setTimeout> | null = null;
let editorScrollFrame = 0;
let previewScrollFrame = 0;

function handleSelectionChange(selection: { line: number; column: number; selectedText: string }) {
  cursorPosition.value = { line: selection.line, column: selection.column };
  selectedText.value = selection.selectedText;
  activeSourceLine.value = selection.line;
}

function setIgnoreEditorScroll() {
  ignoreEditorScroll = true;
  if (releaseEditorIgnoreTimer) {
    clearTimeout(releaseEditorIgnoreTimer);
  }
  releaseEditorIgnoreTimer = setTimeout(() => {
    ignoreEditorScroll = false;
  }, 150);
}

function setIgnorePreviewScroll() {
  ignorePreviewScroll = true;
  if (releasePreviewIgnoreTimer) {
    clearTimeout(releasePreviewIgnoreTimer);
  }
  releasePreviewIgnoreTimer = setTimeout(() => {
    ignorePreviewScroll = false;
  }, 150);
}

function cleanupScrollListeners() {
  removeEditorScrollListener?.();
  removeEditorScrollListener = null;
  removePreviewScrollListener?.();
  removePreviewScrollListener = null;
}

function getTopVisibleEditorLine(view: EditorView) {
  const topOffset = view.scrollDOM.getBoundingClientRect().top - view.documentTop + 12;
  const block = view.lineBlockAtHeight(Math.max(0, topOffset));
  return view.state.doc.lineAt(block.from).number;
}

function syncPreviewToEditor() {
  const previewPane = previewPaneRef.value;
  if (!previewPane) {
    return;
  }

  const view = editorPaneRef.value?.getEditorApi()?.view;
  if (!view) {
    setIgnorePreviewScroll();
    previewPane.scrollToSourceLine(activeSourceLine.value || 1);
    return;
  }

  const line = getTopVisibleEditorLine(view);
  activeSourceLine.value = line;
  setIgnorePreviewScroll();
  previewPane.scrollToSourceLine(line);
}

function handleEditorScroll() {
  if (ignoreEditorScroll) {
    return;
  }

  if (editorScrollFrame) {
    cancelAnimationFrame(editorScrollFrame);
  }

  editorScrollFrame = requestAnimationFrame(() => {
    const view = editorPaneRef.value?.getEditorApi()?.view;
    if (!view) {
      return;
    }

    const line = getTopVisibleEditorLine(view);
    activeSourceLine.value = line;

    const previewPane = previewPaneRef.value;
    if (!previewPane) {
      return;
    }

    setIgnorePreviewScroll();
    previewPane.scrollToSourceLine(line);
  });
}

function handlePreviewScroll() {
  if (ignorePreviewScroll) {
    return;
  }

  if (previewScrollFrame) {
    cancelAnimationFrame(previewScrollFrame);
  }

  previewScrollFrame = requestAnimationFrame(() => {
    const previewPane = previewPaneRef.value;
    if (!previewPane) {
      return;
    }

    const line = previewPane.getSourceLineAtScrollTop();
    if (!line) {
      return;
    }

    activeSourceLine.value = line;

    const editorApi = editorPaneRef.value?.getEditorApi();
    if (!editorApi || activeNote.value?.locked) {
      return;
    }

    setIgnoreEditorScroll();
    editorApi.scrollToLine(line, { y: 'start' });
  });
}

async function bindScrollListeners() {
  cleanupScrollListeners();
  await nextTick();

  const editorScrollContainer = editorPaneRef.value?.getEditorApi()?.view?.scrollDOM;
  if (editorScrollContainer) {
    const onScroll = () => handleEditorScroll();
    editorScrollContainer.addEventListener('scroll', onScroll, { passive: true });
    removeEditorScrollListener = () => editorScrollContainer.removeEventListener('scroll', onScroll);
  }

  const previewScrollContainer = previewPaneRef.value?.getScrollContainer();
  if (previewScrollContainer) {
    const onScroll = () => handlePreviewScroll();
    previewScrollContainer.addEventListener('scroll', onScroll, { passive: true });
    removePreviewScrollListener = () => previewScrollContainer.removeEventListener('scroll', onScroll);
  }
}

function handleWorkspaceSearchJump(event: Event) {
  const customEvent = event as CustomEvent<{ match?: { line?: number }; title?: string }>;
  const editorApi = editorPaneRef.value?.getEditorApi();
  if (!editorApi || customEvent.detail?.match?.line == null) {
    return;
  }

  activeSourceLine.value = customEvent.detail.match.line;
  editorApi.jumpToLine(customEvent.detail.match.line, customEvent.detail.title);
  setIgnorePreviewScroll();
  previewPaneRef.value?.scrollToSourceLine(customEvent.detail.match.line, 'smooth');
}

onMounted(() => {
  window.addEventListener('workspace-search-jump', handleWorkspaceSearchJump);
});

onUnmounted(() => {
  window.removeEventListener('workspace-search-jump', handleWorkspaceSearchJump);
  cleanupScrollListeners();

  if (releaseEditorIgnoreTimer) {
    clearTimeout(releaseEditorIgnoreTimer);
  }
  if (releasePreviewIgnoreTimer) {
    clearTimeout(releasePreviewIgnoreTimer);
  }
  if (editorScrollFrame) {
    cancelAnimationFrame(editorScrollFrame);
  }
  if (previewScrollFrame) {
    cancelAnimationFrame(previewScrollFrame);
  }
});

watch(
  () => activeNote.value?.id,
  () => {
    activeSourceLine.value = 1;
  },
);

watch(
  [editorView, () => compiledPreview.value.html],
  async () => {
    await bindScrollListeners();
    await nextTick();
    syncPreviewToEditor();
  },
  { immediate: true },
);
</script>

<style scoped>
.workspace-view {
  display: flex;
  min-width: 0;
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

.workspace-view--resize-ready,
.workspace-view--resizing {
  cursor: col-resize;
}

.workspace-pane {
  min-width: 0;
  display: flex;
}

.workspace-pane--sidebar :deep(.sidebar) {
  width: 100%;
  min-width: 0;
  max-width: none;
  height: 100%;
}

.workspace-view--preview-highlighted .editor-col {
  border-right-color: color-mix(in srgb, var(--accent) 40%, var(--panel-border));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.header-note-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
