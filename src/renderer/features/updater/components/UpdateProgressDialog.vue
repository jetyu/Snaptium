<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="update-dialog">
          <div class="dialog-header">
            <h2>{{ $t('updater.downloadingUpdate') }}</h2>
            <button class="btn-close-icon" @click="handleCancel" :disabled="!cancellable">
              <Close theme="outline" size="20" />
            </button>
          </div>

          <div class="dialog-body">
            <div class="progress-info">
              <div class="progress-stats">
                <span class="stat-label">{{ $t('updater.progress') }}</span>
                <span class="stat-value">{{ progressPercent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="download-details">
              <div class="detail-row">
                <span class="detail-label">{{ $t('updater.downloadSpeed') }}</span>
                <span class="detail-value">{{ downloadSpeed }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ $t('updater.downloaded') }}</span>
                <span class="detail-value">{{ downloadedSize }} / {{ totalSize }}</span>
              </div>
              <div class="detail-row" v-if="estimatedTime">
                <span class="detail-label">{{ $t('updater.estimatedTime') }}</span>
                <span class="detail-value">{{ estimatedTime }}</span>
              </div>
            </div>

            <div v-if="error" class="error-message">
              <Info theme="outline" size="16" />
              <span>{{ error }}</span>
            </div>
          </div>

          <div class="dialog-footer">
            <button v-if="error" class="action-button" @click="handleRetry">
              {{ $t('updater.retry') }}
            </button>
            <button class="action-button secondary" @click="handleCancel" :disabled="!cancellable">
              {{ $t('updater.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Close, Info } from '@icon-park/vue-next';
const { t: $t } = useI18n();

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Object,
    default: () => ({
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0
    })
  },
  error: {
    type: String,
    default: null
  },
  cancellable: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['cancel', 'retry']);

const progressPercent = computed(() => {
  return Math.round(props.progress.percent || 0);
});

const downloadSpeed = computed(() => {
  const speed = props.progress.bytesPerSecond || 0;
  return formatBytes(speed) + '/s';
});

const downloadedSize = computed(() => {
  return formatBytes(props.progress.transferred || 0);
});

const totalSize = computed(() => {
  return formatBytes(props.progress.total || 0);
});

const estimatedTime = computed(() => {
  const { bytesPerSecond, transferred, total } = props.progress;
  if (!bytesPerSecond || !total || transferred >= total) return null;

  const remaining = total - transferred;
  const seconds = Math.round(remaining / bytesPerSecond);

  if (seconds < 60) return `${seconds}${$t('updater.seconds')}`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}${$t('updater.minutes')}`;
  return `${Math.round(seconds / 3600)}${$t('updater.hours')}`;
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const handleCancel = () => {
  if (props.cancellable) {
    emit('cancel');
  }
};

const handleRetry = () => {
  emit('retry');
};
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
}

.update-dialog {
  width: 500px;
  max-width: 90vw;
  background: var(--color-bg-elevated);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.btn-close-icon {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close-icon:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.btn-close-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dialog-body {
  padding: 24px;
}

.progress-info {
  margin-bottom: 24px;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.download-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error);
  border-radius: 6px;
  color: var(--color-error);
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
}

.dialog-footer .action-button {
  padding: 8px 20px;
  font-size: 14px;
  min-height: 34px;
}

.dialog-footer .action-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .update-dialog,
.dialog-leave-to .update-dialog {
  transform: scale(0.9);
}
</style>
