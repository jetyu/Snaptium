<template>
  <div class="save-status-indicator">
    <transition name="fade" mode="out-in">
      <div v-if="status === WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING" key="saving" class="status-item saving">
        <span class="spinner-dot"></span>
        <span class="status-text">{{ $t('saveStatus.saving') }}</span>
      </div>

      <div v-else-if="status === WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED" key="saved" class="status-item saved">
        <img src="@assets/icons/common/check.svg" class="status-icon" alt="saved" />
        <span class="status-text">{{ $t('saveStatus.saved') }}</span>
        <span v-if="lastSaveTime" class="status-time">{{ formatTime(lastSaveTime) }}</span>
      </div>

      <div
        v-else-if="status === WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR"
        key="error"
        class="status-item error"
        :title="saveError || $t('saveStatus.error')"
        @click="handleRetry"
      >
        <img src="@assets/icons/common/error.svg" class="status-icon" alt="error" />
        <span class="status-text">{{ $t('saveStatus.error') }}</span>
      </div>

      <!-- 空闲状态（不显示） -->
      <div v-else key="idle" class="status-item idle"></div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceStore } from '@renderer/features/workspace';
import { WORKSPACE_CONSTANTS } from '@renderer/features/workspace/constants/workspace.constants';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const workspaceStore = useWorkspaceStore();
const { savingStatus, lastSaveTime, saveError } = storeToRefs(workspaceStore);
const { t } = useI18n();

const status = computed(() => savingStatus.value);

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < WORKSPACE_CONSTANTS.TIME_FORMAT.JUST_NOW_THRESHOLD) {
    return t('saveStatus.justNow');
  }
  if (diff < WORKSPACE_CONSTANTS.TIME_FORMAT.SECONDS_THRESHOLD) {
    return t('saveStatus.secondsAgo', { seconds: diff });
  }
  if (diff < WORKSPACE_CONSTANTS.TIME_FORMAT.MINUTES_THRESHOLD) {
    return t('saveStatus.minutesAgo', { minutes: Math.floor(diff / 60) });
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function handleRetry() {
  await workspaceStore.forceFlushAutoSave();
}
</script>

<style scoped>
.save-status-indicator {
  min-width: 100px;
  height: 24px;
  display: flex;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

/* 正在保存 */
.status-item.saving {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.spinner-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 已保存 */
.status-item.saved {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

/* 保存失败 */
.status-item.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  cursor: pointer;
}

.status-item.error:hover {
  background: rgba(239, 68, 68, 0.15);
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.status-text {
  font-weight: 500;
}

.status-time {
  color: currentColor;
  opacity: 0.6;
  font-size: 11px;
}

/* 空闲状态 */
.status-item.idle {
  opacity: 0;
  padding: 0;
  min-width: 0;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .status-time {
    display: none;
  }
}

@media (max-width: 800px) {
  .status-text {
    display: none;
  }
  .status-item {
    padding: 4px 6px;
  }
}
</style>
