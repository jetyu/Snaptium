<template>
  <div class="editor-pane">
    <div ref="editorHost" class="editor-host" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createCodeEditor } from '@renderer/core/editor/createCodeEditor';
import { useWorkspaceStore } from '@renderer/features/workspace';
import { useSettingsStore } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { useAiAssistant } from '@renderer/features/ai/composables/useAiAssistant';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'selection-change': [selection: { line: number; column: number; selectedText: string }];
}>();

const workspaceStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const { setEditorView } = useEditor();
const aiAssistant = useAiAssistant();

const { activeNote } = storeToRefs(workspaceStore);
const { config } = storeToRefs(settingsStore);

const editorHost = ref<HTMLElement | null>(null);
let editorApi: ReturnType<typeof createCodeEditor> | undefined;
let syncingFromEditor = false;

defineExpose({
  getEditorApi: () => editorApi,
});

onMounted(() => {
  if (!editorHost.value) return;

  editorApi = createCodeEditor({
    target: editorHost.value,
    initialValue: props.modelValue,
    readOnly: activeNote.value?.locked ?? false,
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
        // 如果是AI补全导致的变化，立即请求下一次补全（连续补全）
        if (isAiCompletion) {
          // 短延迟后请求下一次补全，让用户有机会看到插入的内容
          setTimeout(() => {
            if (editorApi?.view) {
              aiAssistant.requestCompletion(editorApi.view, config.value);
            }
          }, 300); // 300ms 短延迟
        } else {
          // 用户输入，使用正常的延迟
          aiAssistant.handleTyping(editorApi.view, config.value);
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
  () => activeNote.value?.locked,
  (nextLocked) => {
    if (!editorApi) return;
    editorApi.setReadOnly(nextLocked ?? false);
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
