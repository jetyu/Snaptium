<template>
  <div class="trusted-hosts-config">
    <div class="subpage-actions">
      <div class="add-host-bar">
        <div class="input-wrapper">
          <link-one class="input-icon" theme="outline" size="16" />
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
                <browser theme="outline" size="14" />
              </div>
              <span class="host-text">{{ host }}</span>
            </div>
            <button class="row-action-btn delete" @click="handleDeleteHost(index)" :title="t('common.delete')">
              <delete theme="outline" size="14" />
            </button>
          </div>
        </div>
      </div>
      <div class="subpage-footer">
        <p class="footer-hint">
          <info theme="filled" size="14" class="hint-icon" />
          {{ t('text.previewTrustedSourcesHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { LinkOne, Browser, Delete, Info } from '@icon-park/vue-next';
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
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.hosts-scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.hosts-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.hosts-scroll-area::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}

.empty-state {
  padding: 48px 0;
  text-align: center;
  color: #94a3b8;
}

.empty-icon {
  font-size: 24px;
  margin-bottom: 8px;
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
  border-bottom: 1px solid #f1f5f9;
}

.host-row:last-child {
  border-bottom: none;
}

.host-row:hover {
  background: #f8fafc;
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
  background: #eff6ff;
  color: #0f6cbd;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.host-text {
  font-size: 1rem;
  color: #334155;
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
  color: #94a3b8;
  cursor: pointer;
}

.row-action-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.subpage-footer {
  flex-shrink: 0;
  padding: 12px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.footer-hint {
  margin: 0;
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  gap: 8px;
  align-items: center;
}

.hint-icon {
  color: #0f6cbd;
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
  color: #94a3b8;
  pointer-events: none;
}

.inline-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
}

.inline-input:focus {
  outline: none;
  border-color: #0f6cbd;
}

.add-btn {
  padding: 0 16px;
  height: 36px;
  background: #0f6cbd;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.add-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
</style>
