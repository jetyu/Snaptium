<template>
  <div ref="workspaceViewRef" class="workspace-view" :class="workspaceViewClass" @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave" @pointerdown="handlePointerDown">
    <div ref="sidebarPaneRef" class="workspace-pane workspace-pane--sidebar" :style="sidebarPaneStyle">
      <WorkspaceSidebar />
    </div>

    <div v-if="hasTrailingContent" class="resizer resizer--sidebar"
      :class="{ 'resizer--active': workspaceViewClass['workspace-view--sidebar-highlighted'] }"
      @pointerdown="handleSidebarPointerDown">
    </div>

    <section v-if="hasEditorPane" ref="editorSectionRef" class="editor-col panel" :style="editorPaneStyle">
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
        <NoteTagBar />
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

    <div v-if="canResizePreview" class="resizer resizer--preview"
      :class="{ 'resizer--active': workspaceViewClass['workspace-view--preview-highlighted'] }"
      @pointerdown="handlePreviewPointerDown">
    </div>

    <section v-if="hasPreviewPane" ref="previewSectionRef" class="preview-col panel" :style="previewPaneStyle">
      <div class="col-header">
        <span class="col-title">{{ $t("common.preview") }}</span>
      </div>

      <div class="preview-body">
        <PreviewPane v-if="activeNote" ref="previewPaneRef" :html="compiledPreview.html"
          @sync-to-source="handleSyncToSource" />

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
import NoteTagBar from '@renderer/features/workspace/components/NoteTagBar.vue';
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
    scrollToLine: (lineNumber: number, options?: { y?: 'start' | 'center'; relativeOffset?: number; focus?: boolean }) => void;
  } | undefined;
}

type PreviewScrollBehavior = 'auto' | 'smooth' | 'instant';

interface PreviewPaneExposed {
  getScrollContainer: () => HTMLElement | null;
  getSourceLineAtScrollTop: (scrollTop?: number) => number | null;
  scrollToSourceLine: (lineNumber: number, behavior?: PreviewScrollBehavior, relativeOffset?: number) => void;
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

function handleSyncToSource(payload: { line: number; relativeOffset: number }) {
  const editorApi = editorPaneRef.value?.getEditorApi();
  if (!editorApi || activeNote.value?.locked) {
    return;
  }

  setIgnorePreviewScroll();
  setIgnoreEditorScroll();
  activeSourceLine.value = payload.line;
  
  // Use relative offset to sync editor so it doesn't jump
  editorApi.scrollToLine(payload.line, { 
    relativeOffset: payload.relativeOffset,
    focus: true 
  });
}
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
  handleSidebarPointerDown,
  handlePreviewPointerDown,
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
  
  if (activeSourceLine.value !== selection.line) {
    activeSourceLine.value = selection.line;
    
    // Only scroll preview if the selection change originated from the editor (not from preview click or search)
    if (!ignorePreviewScroll) {
      const view = editorPaneRef.value?.getEditorApi()?.view;
      if (!view) return;

      setIgnorePreviewScroll();
      setIgnoreEditorScroll();

      // Calculate relative vertical position of the cursor in the editor viewport
      const lineBlock = view.lineBlockAt(view.state.doc.line(selection.line).from);
      const containerRect = view.scrollDOM.getBoundingClientRect();
      const relativeOffset = (lineBlock.top + view.documentTop - containerRect.top) / view.scrollDOM.clientHeight;

      previewPaneRef.value?.scrollToSourceLine(selection.line, 'smooth', relativeOffset);
    }
  }
}

function setIgnoreEditorScroll() {
  ignoreEditorScroll = true;
  if (releaseEditorIgnoreTimer) {
    clearTimeout(releaseEditorIgnoreTimer);
  }
  releaseEditorIgnoreTimer = setTimeout(() => {
    ignoreEditorScroll = false;
  }, 1000);
}

function setIgnorePreviewScroll() {
  ignorePreviewScroll = true;
  if (releasePreviewIgnoreTimer) {
    clearTimeout(releasePreviewIgnoreTimer);
  }
  releasePreviewIgnoreTimer = setTimeout(() => {
    ignorePreviewScroll = false;
  }, 1000);
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

    // When scrolling editor, tell preview to follow but ignore its feedback
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

    // When scrolling preview, tell editor to follow but ignore its feedback
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
  min-height: 0;
  flex: 1;
  height: 100%;
  overflow: hidden;
  --workspace-resize-cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 3v14'/%3E%3Cpath d='M7 7L3 10l4 3'/%3E%3Cpath d='M13 7l4 3-4 3'/%3E%3C/g%3E%3Cg fill='none' stroke='%23fff' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 3v14'/%3E%3Cpath d='M7 7L3 10l4 3'/%3E%3Cpath d='M13 7l4 3-4 3'/%3E%3C/g%3E%3C/svg%3E") 10 10, col-resize;
}

.workspace-view--resize-ready,
.workspace-view--resizing {
  cursor: var(--workspace-resize-cursor);
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

.resizer {
  position: relative;
  width: 4px;
  margin: 0 -2px;
  z-index: 100;
  cursor: var(--workspace-resize-cursor);
  transition: background-color 0.2s;
  flex-shrink: 0;
}

/* Hitbox expansion */
.resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: -10px;
}
</style>
