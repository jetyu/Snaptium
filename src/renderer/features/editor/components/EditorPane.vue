<template>
  <div class="editor-pane">
    <div ref="editorHost" class="editor-host" @contextmenu.prevent="handleContextMenu" @paste="handlePaste"
      @dragover="handleDragOver" @drop="handleDrop" />
    <div v-if="aiOperation" ref="editorAiOperationPopover" class="editor-ai-operation-popover"
      :style="editorAiOperationPopoverStyle">
      <EditorAiOperationCard :operation="aiOperation" @apply="editorContextMenu.applyAiOperation"
        @discard="editorContextMenu.discardAiOperation" @retry="editorContextMenu.retryAiOperation"
        @close="editorContextMenu.discardAiOperation" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import { createCodeEditor } from '@renderer/core/editor/createCodeEditor';
import { getEditorAiOperationAnchor } from '@renderer/core/ai/writingBuddyOperation';
import { createLogger } from '@renderer/features/logger';
import { useWorkspaceStore, workspaceService } from '@renderer/features/workspace';
import { useSettingsStore } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { useAiAssistant } from '@renderer/features/ai/composables/useAiAssistant';
import { getErrorMessage } from '@shared/utils/error.utils';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { useEditorContextMenu } from '../composables/useEditorContextMenu';
import EditorAiOperationCard from './EditorAiOperationCard.vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'selection-change': [selection: { line: number; column: number; selectedText: string }];
}>();

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const { setEditorView } = useEditor();
const aiAssistant = useAiAssistant();

const { activeNote } = storeToRefs(workspaceStore);
const { config } = storeToRefs(settingsStore);
const isActiveNoteReadMode = computed(() => Boolean(activeNote.value?.locked));
const isAutoContinueEnabled = computed(() => (
  config.value.aiAssistant?.enabled === true
  && config.value.aiAssistant.autoContinue === true
));

const getAiDocumentContext = () => ({
  noteId: activeNote.value?.id ?? null,
  noteTitle: activeNote.value?.title,
  suggestionHint: t('text.aiAutoContinueSuggestionHint'),
});

const editorHost = ref<HTMLElement | null>(null);
const editorAiOperationPopover = ref<HTMLElement | null>(null);
const editorAiOperationPopoverStyle = ref<CSSProperties>({
  left: '0px',
  top: '0px',
  visibility: 'hidden',
  width: '420px',
});
let editorApi: ReturnType<typeof createCodeEditor> | undefined;
let syncingFromEditor = false;
let editorResizeObserver: ResizeObserver | null = null;
let cardPositionFrame: number | null = null;
const logger = createLogger('Editor Pane');

const editorContextMenu = useEditorContextMenu({
  t,
  editorView: () => editorApi?.view ?? null,
  activeNoteId: () => activeNote.value?.id ?? null,
  aiAssistantEnabled: () => config.value.aiAssistant?.enabled ?? false,
  uiLanguage: () => config.value.general.language,
  quickTranslationTarget: () => config.value.aiAssistant.quickTranslationTarget,
});
const { aiOperation, hasActiveAiOperation } = editorContextMenu;

const handleContextMenu = () => {
  void editorContextMenu.openContextMenu();
};

const CARD_GAP = 8;
const EDITOR_INSET = 12;
const MAX_CARD_WIDTH = 420;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function updateAiOperationCardPosition(): void {
  const view = editorApi?.view;
  const host = editorHost.value;
  const popover = editorAiOperationPopover.value;
  if (!view || !host || !popover || !aiOperation.value) {
    return;
  }

  const anchor = getEditorAiOperationAnchor(view.state);
  if (!anchor || anchor.operationId !== aiOperation.value.id) {
    editorAiOperationPopoverStyle.value = {
      ...editorAiOperationPopoverStyle.value,
      visibility: 'hidden',
    };
    return;
  }

  const editorRect = host.getBoundingClientRect();
  const desiredWidth = Math.min(MAX_CARD_WIDTH, Math.max(0, editorRect.width - EDITOR_INSET * 2));
  if (Math.abs(popover.getBoundingClientRect().width - desiredWidth) > 1) {
    editorAiOperationPopoverStyle.value = {
      ...editorAiOperationPopoverStyle.value,
      visibility: 'hidden',
      width: `${desiredWidth}px`,
    };
    scheduleAiOperationCardPosition();
    return;
  }

  const cardRect = popover.getBoundingClientRect();
  const minimumLeft = editorRect.left + EDITOR_INSET;
  const maximumLeft = editorRect.right - EDITOR_INSET - cardRect.width;
  const minimumTop = editorRect.top + EDITOR_INSET;
  const maximumTop = editorRect.bottom - EDITOR_INSET - cardRect.height;
  const anchorIsAboveViewport = anchor.to < view.viewport.from;
  const anchorIsBelowViewport = anchor.from > view.viewport.to;

  let left = maximumLeft;
  let top = anchorIsAboveViewport ? minimumTop : maximumTop;

  if (!anchorIsAboveViewport && !anchorIsBelowViewport) {
    const visiblePosition = Math.min(anchor.to, view.viewport.to);
    const coordinates = view.coordsAtPos(visiblePosition, -1);
    if (coordinates) {
      left = coordinates.left;
      top = coordinates.bottom + CARD_GAP;
      if (top + cardRect.height > editorRect.bottom - EDITOR_INSET) {
        top = coordinates.top - CARD_GAP - cardRect.height;
      }
    }
  }

  editorAiOperationPopoverStyle.value = {
    left: `${clamp(left, minimumLeft, maximumLeft)}px`,
    top: `${clamp(top, minimumTop, maximumTop)}px`,
    visibility: 'visible',
    width: `${desiredWidth}px`,
  };
}

function scheduleAiOperationCardPosition(): void {
  if (cardPositionFrame !== null) {
    cancelAnimationFrame(cardPositionFrame);
  }

  cardPositionFrame = requestAnimationFrame(() => {
    cardPositionFrame = null;
    void nextTick(updateAiOperationCardPosition);
  });
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

function getImageFilesFromDataTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return [];
  }

  return Array.from(dataTransfer.files).filter(isImageFile);
}

function getImageFilesFromClipboard(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return [];
  }

  const clipboardImages = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  return clipboardImages.length > 0 ? clipboardImages : getImageFilesFromDataTransfer(dataTransfer);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read image data.'));
        return;
      }

      const commaIndex = reader.result.indexOf(',');
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read image data.'));
    };

    reader.readAsDataURL(file);
  });
}

function escapeMarkdownAltText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

function createImageAltText(file: File, index: number) {
  const baseName = file.name
    ? file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
    : '';

  return escapeMarkdownAltText(baseName || `image-${index + 1}`);
}

function insertMarkdownAtSelection(markdown: string) {
  const view = editorApi?.view;
  if (!view) {
    return;
  }

  const selection = view.state.selection.main;
  const anchor = selection.from + markdown.length;

  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: markdown,
    },
    selection: {
      anchor,
      head: anchor,
    },
    scrollIntoView: true,
  });

  view.focus();
}

function setSelectionFromDropEvent(event: DragEvent) {
  const view = editorApi?.view;
  if (!view) {
    return;
  }

  const position = view.posAtCoords({
    x: event.clientX,
    y: event.clientY,
  });

  if (position == null) {
    return;
  }

  view.dispatch({
    selection: {
      anchor: position,
      head: position,
    },
  });
}

async function saveImagesAndInsertMarkdown(files: File[]) {
  const note = activeNote.value;
  if (!note || isActiveNoteReadMode.value || files.length === 0) {
    return;
  }

  try {
    const results = await Promise.allSettled(
      files.map(async (file, index) => {
        const dataBase64 = await fileToBase64(file);
        const savedImage = await workspaceService.saveNoteImage(note.contentId, {
          fileName: file.name || undefined,
          mimeType: file.type || 'image/png',
          dataBase64,
        });

        return `![${createImageAltText(file, index)}](${savedImage.markdownPath})`;
      }),
    );

    const markdownEntries = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    if (activeNote.value?.id === note.id && !isActiveNoteReadMode.value) {
      if (markdownEntries.length > 0) insertMarkdownAtSelection(markdownEntries.join('\n\n'));
    } else {
      await electronApi.settings.showMessage({
        type: 'warning', title: t('editor.images.title'), message: t('editor.images.noteChanged'),
      });
      return;
    }
    const failedCount = results.length - markdownEntries.length;
    if (failedCount > 0) {
      await electronApi.settings.showMessage({
        type: 'warning', title: t('editor.images.title'), message: t('editor.images.failed', { count: failedCount }),
      });
    }
  } catch (error) {
    logger.error(`Failed to insert image into note: ${getErrorMessage(error)}`);
    await electronApi.settings.showMessage({
      type: 'error', title: t('editor.images.title'), message: t('editor.images.error'), detail: getErrorMessage(error),
    });
  }
}

function handleDragOver(event: DragEvent) {
  if (!event.dataTransfer) {
    return;
  }

  const hasFile = Array.from(event.dataTransfer.items).some((item) => item.kind === 'file');
  if (!hasFile) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

async function handlePaste(event: ClipboardEvent) {
  const imageFiles = getImageFilesFromClipboard(event.clipboardData);
  if (imageFiles.length === 0) {
    return;
  }

  event.preventDefault();
  await saveImagesAndInsertMarkdown(imageFiles);
}

async function handleDrop(event: DragEvent) {
  const imageFiles = getImageFilesFromDataTransfer(event.dataTransfer);
  if (imageFiles.length === 0) {
    return;
  }

  event.preventDefault();
  setSelectionFromDropEvent(event);
  await saveImagesAndInsertMarkdown(imageFiles);
}

defineExpose({
  getEditorApi: () => editorApi,
});

onMounted(() => {
  if (!editorHost.value) return;

  editorApi = createCodeEditor({
    target: editorHost.value,
    initialValue: props.modelValue,
    readOnly: isActiveNoteReadMode.value,
    showLineNumbers: config.value.editor.showLineNumbers,
    wordWrap: config.value.editor.wordWrap,
    codeFolding: config.value.editor.codeFolding,
    highlightActiveLine: config.value.editor.highlightActiveLine,
    bracketMatching: config.value.editor.bracketMatching,
    autoCloseBrackets: config.value.editor.autoCloseBrackets,
    autoIndent: config.value.editor.autoIndent,
    onChange: (change) => {
      syncingFromEditor = true;
      emit('update:modelValue', change.value);
      queueMicrotask(() => {
        syncingFromEditor = false;
      });

      // 触发AI助手
      if (
        editorApi?.view
        && isAutoContinueEnabled.value
        && !hasActiveAiOperation.value
      ) {
        aiAssistant.handleDocumentChange(editorApi.view, config.value, change.origin);
      }

      editorContextMenu.syncAiOperationState();
      scheduleAiOperationCardPosition();
    },
    onSelectionChange: (selection, selectionOnly) => {
      emit('selection-change', selection);
      if (selectionOnly) {
        aiAssistant.handleSelectionChange();
      }
    },
  });

  // 注册编辑器视图到全局
  if (editorApi?.view) {
    setEditorView(editorApi.view);
    aiAssistant.setEditorView(editorApi.view);
    aiAssistant.setDocumentContext(getAiDocumentContext());
    editorApi.view.scrollDOM.addEventListener('scroll', scheduleAiOperationCardPosition, { passive: true });
  }

  window.addEventListener('resize', scheduleAiOperationCardPosition);
  editorResizeObserver = new ResizeObserver(scheduleAiOperationCardPosition);
  editorResizeObserver.observe(editorHost.value);

  // 设置AI助手状态
  aiAssistant.setEnabled(isAutoContinueEnabled.value);
});

watch(
  hasActiveAiOperation,
  (isActive) => {
    aiAssistant.setSuspended(isActive);
  },
  { flush: 'sync' },
);

watch(
  () => {
    const operation = aiOperation.value;
    return operation
      ? [operation.id, operation.status, operation.result, operation.error]
      : null;
  },
  () => {
    if (!aiOperation.value) {
      editorAiOperationPopoverStyle.value = {
        ...editorAiOperationPopoverStyle.value,
        visibility: 'hidden',
      };
      return;
    }

    scheduleAiOperationCardPosition();
  },
);

watch(
  () => [activeNote.value?.id ?? null, activeNote.value?.title ?? ''] as const,
  () => {
    aiAssistant.setDocumentContext(getAiDocumentContext());
    editorContextMenu.discardAiOperation();
  },
  { flush: 'sync' },
);

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!editorApi || syncingFromEditor) return;
    editorApi.setValue(nextValue);
  },
);

watch(
  isActiveNoteReadMode,
  (nextReadModeEnabled) => {
    if (!editorApi) return;
    editorApi.setReadOnly(nextReadModeEnabled);
  },
);

watch(
  () => config.value.editor.showLineNumbers,
  (showLineNumbers) => {
    if (!editorApi) return;
    editorApi.setLineNumbers(showLineNumbers);
  }
);

watch(
  () => config.value.editor.wordWrap,
  (wordWrap) => {
    if (!editorApi) return;
    editorApi.setWordWrap(wordWrap);
  }
);

watch(
  () => config.value.editor.codeFolding,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setCodeFolding(enabled);
  }
);

watch(
  () => config.value.editor.highlightActiveLine,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setHighlightActiveLine(enabled);
  }
);

watch(
  () => config.value.editor.bracketMatching,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setBracketMatching(enabled);
  }
);

watch(
  () => config.value.editor.autoCloseBrackets,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setAutoCloseBrackets(enabled);
  }
);

watch(
  () => config.value.editor.autoIndent,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setAutoIndent(enabled);
  }
);

watch(
  isAutoContinueEnabled,
  (enabled) => {
    aiAssistant.setEnabled(enabled);
  }
);

onBeforeUnmount(() => {
  editorContextMenu.discardAiOperation();
  if (cardPositionFrame !== null) {
    cancelAnimationFrame(cardPositionFrame);
  }
  editorResizeObserver?.disconnect();
  window.removeEventListener('resize', scheduleAiOperationCardPosition);
  editorApi?.view.scrollDOM.removeEventListener('scroll', scheduleAiOperationCardPosition);
  // 清除全局编辑器引用
  setEditorView(null);
  // 清理AI助手
  aiAssistant.cleanup();
  aiAssistant.setEditorView(null);
  editorApi?.destroy();
});
</script>

<style scoped>
.editor-ai-operation-popover {
  position: fixed;
  z-index: 80;
}
</style>
