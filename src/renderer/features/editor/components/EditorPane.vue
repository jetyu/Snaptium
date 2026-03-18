<template>
  <div class="editor-pane">
    <div ref="editorHost" class="editor-host" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createCodeEditor } from '@renderer/core/editor/createCodeEditor';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorHost = ref<HTMLElement | null>(null);
let editorApi: ReturnType<typeof createCodeEditor> | undefined;
let syncingFromEditor = false;

onMounted(() => {
  if (!editorHost.value) return;

  editorApi = createCodeEditor({
    target: editorHost.value,
    initialValue: props.modelValue,
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

onBeforeUnmount(() => {
  editorApi?.destroy();
});
</script>
