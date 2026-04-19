<template>
  <div v-if="showStatusBar" class="editor-status">
    <!-- 底部状态栏 -->
    <EditorStatusBar :cursor-position="cursorPosition" :selected-text="selectedText" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EditorStatusBar from './EditorStatusBar.vue';
import { useSettingsStore } from '@renderer/features/settings';
import { storeToRefs } from 'pinia';

interface CursorPosition {
  line: number;
  column: number;
}

interface Props {
  cursorPosition?: CursorPosition | null;
  selectedText?: string;
}

withDefaults(defineProps<Props>(), {
  cursorPosition: null,
  selectedText: '',
});

const settingsStore = useSettingsStore();
const { config } = storeToRefs(settingsStore);

const showStatusBar = computed(() => {
  return config.value.showStatusBar !== false;
});
</script>

<style scoped>
.editor-status {
  display: flex;
  flex-direction: column;
}
</style>
