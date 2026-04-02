<template>
  <footer class="editor-status-bar">
    <div class="status-left">
      <span v-if="wordCount !== null" class="status-item">
        {{ $t('statusBar.words', { count: wordCount }) }}
      </span>
      <span v-if="cursorPosition" class="status-item">
        {{ $t('statusBar.position', { line: cursorPosition.line, column: cursorPosition.column }) }}
      </span>
      <span v-if="selectedWordCount > 0" class="status-item">
        {{ $t('statusBar.selected', { count: selectedWordCount }) }}
      </span>
    </div>
    <div class="status-right">
      <span v-if="fileSize" class="status-item">{{ fileSize }}</span>
      <span v-if="lastSaveTime" class="status-item">{{ lastSaveTime }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { useWorkspaceStore } from '@renderer/features/workspace';
import { STATUSBAR_CONSTANTS } from '@renderer/features/editor/constants/statusbar.constants';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

interface CursorPosition {
  line: number;
  column: number;
}

interface Props {
  cursorPosition?: CursorPosition | null;
  selectedText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  cursorPosition: null,
  selectedText: '',
});

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const { activeNote, lastSaveTime: storeLastSaveTime } = storeToRefs(workspaceStore);

const currentTime = ref(Date.now());
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

timeUpdateInterval = setInterval(() => {
  currentTime.value = Date.now();
}, 60000); 

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});

const wordCount = computed(() => {
  if (!activeNote.value) return null;
  const text = activeNote.value.content.trim();
  if (!text) return 0;

  const chineseChars = text.match(STATUSBAR_CONSTANTS.REGEX.CHINESE_CHARS)?.length || 0;
  const englishWords = text.match(STATUSBAR_CONSTANTS.REGEX.ENGLISH_WORDS)?.length || 0;

  return chineseChars + englishWords;
});

const selectedWordCount = computed(() => {
  if (!props.selectedText) return 0;
  
  const chineseChars = props.selectedText.match(STATUSBAR_CONSTANTS.REGEX.CHINESE_CHARS)?.length || 0;
  const englishWords = props.selectedText.match(STATUSBAR_CONSTANTS.REGEX.ENGLISH_WORDS)?.length || 0;
  
  return chineseChars + englishWords;
});

const fileSize = computed(() => {
  if (!activeNote.value) return null;
  
  // 计算字节数（UTF-8编码）
  const bytes = new Blob([activeNote.value.content]).size;
  
  if (bytes === 0) return '0 B';
  
  const units = STATUSBAR_CONSTANTS.FILE_SIZE.UNITS;
  const threshold = STATUSBAR_CONSTANTS.FILE_SIZE.THRESHOLD;
  
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= threshold && unitIndex < units.length - 1) {
    size /= threshold;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
});

const lastSaveTime = computed(() => {
  if (!storeLastSaveTime.value) return null;
  
  // 使用 currentTime.value 来触发定期更新
  const now = currentTime.value;
  const diff = Math.floor((now - storeLastSaveTime.value) / 1000);
  
  // 超过5分钟就不显示了
  if (diff > 300) return null;
  
  // 5秒内显示"刚刚保存"
  if (diff < 5) return t('statusBar.justSaved');
  
  // 5分钟内显示"X分钟前保存"
  const minutes = Math.floor(diff / 60);
  if (minutes === 0) return t('statusBar.justSaved'); // 不到1分钟，显示刚刚保存
  return t('statusBar.savedMinutesAgo', { minutes });
});
</script>

<style scoped>
.editor-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px;
  background: var(--bg-secondary, #f9fafb);
  border-top: 1px solid var(--border-color, #e5e7eb);
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  height: 28px;
  flex-shrink: 0;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.status-item:not(:last-child)::after {
  content: '|';
  margin-left: 16px;
  color: var(--border-color, #e5e7eb);
}

@media (max-width: 800px) {
  .status-right {
    display: none;
  }
}
</style>
