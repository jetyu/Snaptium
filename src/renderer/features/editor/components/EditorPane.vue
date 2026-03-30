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
import { storeToRefs } from 'pinia';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const workspaceStore = useWorkspaceStore();
const settingsStore = useSettingsStore();

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
    onChange: (value) => {
      syncingFromEditor = true;
      emit('update:modelValue', value);
      queueMicrotask(() => {
        syncingFromEditor = false;
      });
    },
  });
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

onBeforeUnmount(() => {
  editorApi?.destroy();
});
</script>
