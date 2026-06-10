<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="workspaceStore.isHistoryDialogOpen" class="history-overlay" @keydown.esc="closeDialog" tabindex="0"
        ref="overlayRef">
        <div class="history-modal" @click.stop>
          <div class="history-header">
            <h2>{{ $t('history.title') }}</h2>
            <button @click="closeDialog" class="btn-close">
              <IconX :size="18" />
            </button>
          </div>

          <div class="history-content">
            <div class="history-sidebar">
              <div v-if="workspaceStore.historyLoading" class="loading-state">
                <div class="spinner"></div>
              </div>
              <div v-else-if="workspaceStore.historyVersions.length === 0" class="empty-state">
                <p>{{ $t('history.emptyState') }}</p>
              </div>
              <ul v-else class="version-list">
                <li v-for="version in sortedVersions" :key="version.filename" class="version-item"
                  :class="{ active: selectedVersion === version.filename }" @click="selectVersion(version.filename)">
                  <div class="version-info">
                    <span class="version-time">{{ formatTime(version.timestamp) }}</span>
                  </div>
                </li>
              </ul>
            </div>

            <div class="history-preview">
              <div v-if="isLoadingContent" class="loading-state">
                <div class="spinner"></div>
              </div>
              <PreviewPane v-else-if="selectedContentHtml" :html="selectedContentHtml" />
              <div v-else class="empty-preview">
                <p>{{ $t('history.previewPlaceholder') }}</p>
              </div>
            </div>
          </div>

          <div class="history-footer">
            <button class="btn-cancel" @click="closeDialog">{{ $t('button.cancel') }}</button>
            <button class="btn-restore" :disabled="!selectedVersion || isRestoring" @click="handleRestore">
              {{ isRestoring ? $t('history.restoring') : $t('history.restore') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useWorkspaceStore } from '../store/workspace.store';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';
import { workspaceService } from '../services/workspace.service';
import { useSettingsStore } from '@renderer/features/settings';
import { PreviewPane } from '@renderer/features/preview';
import { useI18n } from 'vue-i18n';
import { IconX } from '@tabler/icons-vue';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const settingsStore = useSettingsStore();
const overlayRef = ref<HTMLElement | null>(null);
const selectedVersion = ref<string | null>(null);
const selectedContentMarkdown = ref<string>('');
const isLoadingContent = ref(false);
const isRestoring = ref(false);

const sortedVersions = computed(() => {
  return [...workspaceStore.historyVersions].sort((a, b) => b.timestamp - a.timestamp);
});

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

const selectedContentHtml = computed(() => {
  if (!selectedContentMarkdown.value) {
    return '';
  }

  return renderMarkdown(selectedContentMarkdown.value, {
    allowHtml: settingsStore.config.previewAppearance.allowHtml,
    allowInlineSvg: settingsStore.config.previewAppearance.allowInlineSvg,
    remoteImageMode: settingsStore.config.previewAppearance.remoteImageMode,
    trustedRemoteImageHosts: settingsStore.config.previewAppearance.trustedRemoteImageHosts,
    blockedImageLabel: t('preview.remoteImageBlocked'),
    copyCodeButtonLabel: t('preview.copyCode'),
    contentId: workspaceStore.activeNote?.contentId ?? null,
    workspaceRoot: workspaceService.getCurrentWorkspaceRoot(),
  });
});

const closeDialog = () => {
  workspaceStore.closeHistoryDialog();
};

const selectVersion = async (filename: string) => {
  selectedVersion.value = filename;
  isLoadingContent.value = true;
  selectedContentMarkdown.value = '';
  try {
    selectedContentMarkdown.value = await workspaceStore.getHistoryContent(filename);
  } finally {
    isLoadingContent.value = false;
  }
};

const handleRestore = async () => {
  if (!selectedVersion.value) return;

  isRestoring.value = true;
  try {
    await workspaceStore.confirmRecoverVersion(selectedVersion.value);
  } finally {
    isRestoring.value = false;
  }
};

watch(() => workspaceStore.isHistoryDialogOpen, async (newVal) => {
  if (newVal) {
    selectedVersion.value = null;
    selectedContentMarkdown.value = '';
    isRestoring.value = false;
    await nextTick();
    overlayRef.value?.focus();

    if (workspaceStore.historyVersions.length > 0) {
      const latestVersion = workspaceStore.historyVersions.reduce((prev, current) =>
        (prev.timestamp > current.timestamp) ? prev : current
      );
      await selectVersion(latestVersion.filename);
    }
  }
});
</script>

<style scoped>
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.history-modal {
  width: 900px;
  max-width: 95vw;
  height: 600px;
  max-height: 90vh;
  background: var(--panel, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--panel-border, #e5e7eb);
}

.history-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--panel-header, #f9fafb);
}

.history-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text, #111827);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}

.btn-close:hover {
  background: var(--panel-hover, #f3f4f6);
  color: var(--text, #111827);
}

.history-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.history-sidebar {
  width: 250px;
  border-right: 1px solid var(--panel-border, #e5e7eb);
  background: var(--panel-header, #f9fafb);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.version-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.version-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
  transition: background 0.2s;
}

.version-item:hover {
  background: var(--panel-hover, #f3f4f6);
}

.version-item.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-left: 3px solid var(--accent);
}

.version-info {
  display: flex;
  flex-direction: column;
}

.version-time {
  font-size: 0.9rem;
  color: var(--text, #374151);
  font-weight: 500;
}

.history-preview {
  flex: 1;
  display: flex;
  min-width: 0;
  overflow: hidden;
  background: var(--panel, #ffffff);
}

.empty-preview,
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #9ca3af);
}

.loading-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--panel-border, #e5e7eb);
  border-top-color: var(--accent, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.history-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--panel-border, #e5e7eb);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: var(--panel-header, #f9fafb);
}

.btn-cancel,
.btn-restore {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--panel-border, #e5e7eb);
  color: var(--text, #374151);
}

.btn-cancel:hover {
  background: var(--panel-hover, #f3f4f6);
}

.btn-restore {
  background: var(--accent, #3b82f6);
  border: 1px solid var(--accent, #3b82f6);
  color: white;
}

.btn-restore:hover:not(:disabled) {
  filter: brightness(0.9);
}

.btn-restore:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
