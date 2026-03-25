<template>
  <div class="editor-pane">
    <div ref="editorHost" class="editor-host" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createCodeEditor } from '@renderer/core/editor/createCodeEditor';
import { useWorkspaceStore } from '@renderer/features/workspace';
import { storeToRefs } from 'pinia';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const workspaceStore = useWorkspaceStore();
const { activeNote } = storeToRefs(workspaceStore);

const editorHost = ref<HTMLElement | null>(null);
let editorApi: ReturnType<typeof createCodeEditor> | undefined;
let syncingFromEditor = false;

onMounted(() => {
  if (!editorHost.value) return;

  editorApi = createCodeEditor({
    target: editorHost.value,
    initialValue: props.modelValue,
    readOnly: activeNote.value?.locked ?? false,
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

onBeforeUnmount(() => {
  editorApi?.destroy();
});
</script>
