<template>
  <Teleport to="body">
    <Transition name="notification">
      <div v-if="visible" class="update-notification" :class="notificationClass">
        <div class="notification-content">
          <div class="notification-icon">
            <Layers v-if="state === 'available'" theme="outline" size="24" fill="currentColor" />
            <Attention v-else-if="state === 'error'" theme="outline" size="24" fill="currentColor" />
            <CheckOne v-else theme="outline" size="24" fill="currentColor" />
          </div>

          <div class="notification-body">
            <h3 class="notification-title">{{ title }}</h3>
            <p class="notification-message">{{ message }}</p>
            <div v-if="updateInfo && state === 'available'" class="update-details">
              <span class="version-badge">v{{ updateInfo.version }}</span>
              <button v-if="updateInfo.releaseNotes" class="link-button" @click="showReleaseNotes">
                {{ $t('updater.viewReleaseNotes') }}
              </button>
            </div>
          </div>

          <div class="notification-actions">
            <button v-if="state === 'available'" class="action-button" @click="handleDownload">
              {{ $t('updater.download') }}
            </button>
            <button v-if="state === 'error' && canRetry" class="action-button" @click="handleRetry">
              {{ $t('updater.retry') }}
            </button>
            <button class="action-button secondary" @click="handleClose">
              {{ state === 'available' ? $t('updater.later') : $t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Layers, Attention, CheckOne } from '@icon-park/vue-next'
const { t: $t } = useI18n();

const props = defineProps({
  state: {
    type: String,
    required: true,
    validator: (value) => ['available', 'not-available', 'error'].includes(value)
  },
  updateInfo: {
    type: Object,
    default: null
  },
  error: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['download', 'close', 'retry']);

const visible = ref(true);

const notificationClass = computed(() => ({
  'notification-success': props.state === 'not-available',
  'notification-info': props.state === 'available',
  'notification-error': props.state === 'error'
}));

const title = computed(() => {
  switch (props.state) {
    case 'available':
      return $t('updater.newVersionAvailable');
    case 'not-available':
      return $t('updater.upToDate');
    case 'error':
      return $t('updater.updateError');
    default:
      return '';
  }
});

const message = computed(() => {
  switch (props.state) {
    case 'available':
      return $t('updater.newVersionMessage', { version: props.updateInfo?.version });
    case 'not-available':
      return $t('updater.upToDateMessage');
    case 'error':
      return props.error?.message || $t('updater.unknownError');
    default:
      return '';
  }
});

const canRetry = computed(() => {
  return props.error?.code === 'CHECK_FAILED' || props.error?.code === 'DOWNLOAD_FAILED';
});

const handleDownload = () => {
  emit('download');
};

const handleClose = () => {
  visible.value = false;
  setTimeout(() => emit('close'), 300);
};

const handleRetry = () => {
  emit('retry');
  handleClose();
};

const showReleaseNotes = () => {
  if (props.updateInfo?.releaseNotes) {
    // 可以打开一个模态框显示更新日志
    console.log('Release notes:', props.updateInfo.releaseNotes);
  }
};
</script>

<style scoped>
.update-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  background: var(--color-bg-elevated);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 10000;
  overflow: hidden;
}

.notification-content {
  display: flex;
  gap: 16px;
  padding: 20px;
}

.notification-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: var(--color-primary);
}

.notification-error .notification-icon {
  color: var(--color-error);
}

.notification-success .notification-icon {
  color: var(--color-success);
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.notification-message {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.update-details {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.version-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-primary-alpha);
  color: var(--color-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.link-button {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.link-button:hover {
  color: var(--color-primary-hover);
}

.notification-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.notification-actions .action-button {
  padding: 8px 16px;
  font-size: 14px;
  min-height: 34px;
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
