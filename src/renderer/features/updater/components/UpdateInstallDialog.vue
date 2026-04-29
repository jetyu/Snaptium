<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-overlay">
        <div class="install-dialog">
          <div class="dialog-icon">
            <Time theme="outline" size="48" />
          </div>

          <h2 class="dialog-title">{{ $t('updater.readyToInstall') }}</h2>
          <p class="dialog-message">{{ $t('updater.installMessage', { version: updateInfo?.version }) }}</p>

          <div v-if="updateInfo?.releaseNotes" class="release-notes">
            <h3>{{ $t('updater.releaseNotes') }}</h3>
            <div class="notes-content" v-html="formattedReleaseNotes"></div>
          </div>

          <div class="dialog-actions">
            <button class="action-button" @click="handleInstall">
              {{ $t('updater.installNow') }}
            </button>
            <button class="action-button secondary" @click="handleLater">
              {{ $t('updater.installLater') }}
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
import { Time } from '@icon-park/vue-next';

const { t: $t } = useI18n();

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  updateInfo: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['install', 'later']);

const formattedReleaseNotes = computed(() => {
  if (!props.updateInfo?.releaseNotes) return '';

  // 简单的 Markdown 转换
  let notes = props.updateInfo.releaseNotes;
  notes = notes.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  notes = notes.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  notes = notes.replace(/^# (.*$)/gim, '<h2>$1</h2>');
  notes = notes.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
  notes = notes.replace(/\*(.*)\*/gim, '<em>$1</em>');
  notes = notes.replace(/^\* (.*$)/gim, '<li>$1</li>');
  notes = notes.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  notes = notes.replace(/\n/gim, '<br>');

  return notes;
});

const handleInstall = () => {
  emit('install');
};

const handleLater = () => {
  emit('later');
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
  z-index: 10002;
  backdrop-filter: blur(4px);
}

.install-dialog {
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--color-bg-elevated);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
}

.dialog-icon {
  width: 48px;
  height: 48px;
  color: var(--color-primary);
  margin-bottom: 20px;
}

.dialog-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

.dialog-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.6;
}

.release-notes {
  width: 100%;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.release-notes h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.notes-content {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.notes-content :deep(h2),
.notes-content :deep(h3),
.notes-content :deep(h4) {
  margin: 12px 0 8px 0;
  color: var(--color-text-primary);
}

.notes-content :deep(ul) {
  margin: 8px 0;
  padding-left: 20px;
}

.notes-content :deep(li) {
  margin: 4px 0;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.dialog-actions .action-button {
  flex: 1;
  padding: 10px 20px;
  font-size: 14px;
  min-height: 36px;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .install-dialog,
.dialog-leave-to .install-dialog {
  transform: scale(0.9);
}
</style>
