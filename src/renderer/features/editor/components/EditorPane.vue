<template>
  <div class="editor-pane">
    <div
      ref="editorHost"
      class="editor-host"
      @contextmenu.prevent="handleContextMenu"
      @paste="handlePaste"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createCodeEditor } from '@renderer/core/editor/createCodeEditor';
import { createLogger } from '@renderer/features/logger';
import { useWorkspaceStore, workspaceService } from '@renderer/features/workspace';
import { useSettingsStore } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { useAiAssistant } from '@renderer/features/ai/composables/useAiAssistant';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useEditorContextMenu } from '../composables/useEditorContextMenu';
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

const editorHost = ref<HTMLElement | null>(null);
let editorApi: ReturnType<typeof createCodeEditor> | undefined;
let syncingFromEditor = false;
const logger = createLogger('Editor Pane');

const editorContextMenu = useEditorContextMenu({
  t,
  editorView: () => editorApi?.view ?? null,
  aiAssistantEnabled: () => config.value.aiAssistant?.enabled ?? false,
});

const handleContextMenu = () => {
  editorContextMenu.openContextMenu();
};

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
    const markdownEntries = await Promise.all(
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

    insertMarkdownAtSelection(markdownEntries.join('\n\n'));
  } catch (error) {
    logger.error(`Failed to insert image into note: ${getErrorMessage(error)}`);
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
    showLineNumbers: config.value.showLineNumbers,
    wordWrap: config.value.wordWrap,
    codeFolding: config.value.codeFolding,
    highlightActiveLine: config.value.highlightActiveLine,
    bracketMatching: config.value.bracketMatching,
    autoCloseBrackets: config.value.autoCloseBrackets,
    autoIndent: config.value.autoIndent,
    onChange: (value, isAiCompletion) => {
      syncingFromEditor = true;
      emit('update:modelValue', value);
      queueMicrotask(() => {
        syncingFromEditor = false;
      });

      // 触发AI助手
      if (editorApi?.view && config.value.aiAssistant?.enabled) {
        if (!isAiCompletion) {
          aiAssistant.handleTyping(editorApi.view, config.value);
        } else if (config.value.aiAssistant.autoContinue) {
          aiAssistant.handleTyping(editorApi.view, config.value, true);
        }
      }
    },
    onSelectionChange: (selection) => {
      emit('selection-change', selection);
    },
  });

  // 注册编辑器视图到全局
  if (editorApi?.view) {
    setEditorView(editorApi.view);
    aiAssistant.setEditorView(editorApi.view);
  }

  // 设置AI助手状态
  aiAssistant.setEnabled(config.value.aiAssistant?.enabled ?? false);
});

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
  () => config.value.showLineNumbers,
  (showLineNumbers) => {
    if (!editorApi) return;
    editorApi.setLineNumbers(showLineNumbers);
  }
);

watch(
  () => config.value.wordWrap,
  (wordWrap) => {
    if (!editorApi) return;
    editorApi.setWordWrap(wordWrap);
  }
);

watch(
  () => config.value.codeFolding,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setCodeFolding(enabled);
  }
);

watch(
  () => config.value.highlightActiveLine,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setHighlightActiveLine(enabled);
  }
);

watch(
  () => config.value.bracketMatching,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setBracketMatching(enabled);
  }
);

watch(
  () => config.value.autoCloseBrackets,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setAutoCloseBrackets(enabled);
  }
);

watch(
  () => config.value.autoIndent,
  (enabled) => {
    if (!editorApi) return;
    editorApi.setAutoIndent(enabled);
  }
);

watch(
  () => config.value.aiAssistant?.enabled,
  (enabled) => {
    aiAssistant.setEnabled(enabled ?? false);
  }
);

onBeforeUnmount(() => {
  // 清除全局编辑器引用
  setEditorView(null);
  // 清理AI助手
  aiAssistant.cleanup();
  editorApi?.destroy();
});
</script>
