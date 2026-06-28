<template>
  <div class="trusted-hosts-config">
    <div class="subpage-actions">
      <div class="add-host-bar">
        <div class="input-wrapper">
          <IconLink class="input-icon" :size="16" />
          <input v-model="newHost" class="inline-input" :placeholder="t('placeholder.hostName')"
            @keyup.enter="handleAddHost" />
        </div>
        <button class="add-btn" :disabled="!newHost.trim()" @click="handleAddHost">
          {{ t('button.addHost') }}
        </button>
      </div>
    </div>

    <div class="config-body">
      <div class="hosts-scroll-area">
        <div class="host-list-rows">
          <div v-for="(host, index) in settingsStore.config.previewAppearance.trustedRemoteImageHosts" :key="host"
            class="host-row">
            <div class="host-info">
              <div class="host-avatar">
                <IconBrowser :size="14" />
              </div>
              <span class="host-text">{{ host }}</span>
            </div>
            <button class="row-action-btn delete" @click="handleDeleteHost(index)" :title="t('button.delete')">
              <IconTrash :size="14" />
            </button>
          </div>
        </div>
      </div>
      <div class="subpage-footer">
        <p class="footer-hint">
          <IconInfoCircle :size="14" class="hint-icon" />
          {{ t('text.previewTrustedSourcesHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconLink, IconBrowser, IconTrash, IconInfoCircle } from '@tabler/icons-vue';
import { useSettingsStore } from '../../../store/settings.store';
import { normalizeTrustedRemoteImageHost } from '@shared/preview-security.constants';

const { t } = useI18n();
const settingsStore = useSettingsStore();

defineEmits(['back']);

const newHost = ref('');

const handleAddHost = async () => {
  const host = newHost.value.trim();
  if (!host) return;

  const normalized = normalizeTrustedRemoteImageHost(host);
  if (!normalized) return;

  const currentHosts = [...settingsStore.config.previewAppearance.trustedRemoteImageHosts];
  if (!currentHosts.includes(normalized)) {
    currentHosts.unshift(normalized);
    await settingsStore.updatePreviewAppearanceSetting('trustedRemoteImageHosts', currentHosts);
  }
  newHost.value = '';
};

const handleDeleteHost = async (index: number) => {
  const currentHosts = [...settingsStore.config.previewAppearance.trustedRemoteImageHosts];
  currentHosts.splice(index, 1);
  await settingsStore.updatePreviewAppearanceSetting('trustedRemoteImageHosts', currentHosts);
};
</script>

<style scoped>
.trusted-hosts-config {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.subpage-actions {
  flex-shrink: 0;
  padding-bottom: 16px;
}

.add-host-bar {
  display: flex;
  gap: 10px;
}

.config-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface-raised);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

.hosts-scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.hosts-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.hosts-scroll-area::-webkit-scrollbar-thumb {
  background-color: var(--border-strong);
  border-radius: 10px;
}

.host-list-rows {
  display: flex;
  flex-direction: column;
}

.host-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}

.host-row:last-child {
  border-bottom: none;
}

.host-row:hover {
  background: var(--surface-soft);
}

.host-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.host-avatar {
  width: 28px;
  height: 28px;
  background: var(--status-info-bg);
  color: var(--status-info-text);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.host-text {
  font-size: 1rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-disabled);
  cursor: pointer;
}

.row-action-btn:hover {
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
}

.subpage-footer {
  flex-shrink: 0;
  padding: 12px 16px;
  background: var(--surface-scrim);
  border-top: 1px solid var(--border-color);
}

.footer-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
  align-items: center;
}

.hint-icon {
  color: var(--status-info-text);
  flex-shrink: 0;
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-disabled);
  pointer-events: none;
}

.inline-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.inline-input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.add-btn {
  padding: 0 16px;
  height: 36px;
  background: var(--accent-solid);
  color: var(--accent-solid-text);
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.add-btn:disabled {
  background: var(--input-bg-disabled);
  color: var(--text-disabled);
  cursor: not-allowed;
}
</style>
