<template>
  <div class="sync-settings">
    <h3 class="panel-title">{{ pageTitle }}</h3>

    <div class="sync-config-content">
      <component :is="currentViewComponent" :key="activeView" @edit-provider="handleEditProvider" @back="handleBack"
        @test-connection="handleTestConnection" :test-message="testMessage" :test-state="testState" />
    </div>

    <div v-if="activeView !== 'dashboard'" class="sync-footer">
      <div class="footer-buttons">
        <div class="left-buttons">
          <button class="action-button secondary" @click="handleTestConnection" :disabled="syncStore.isTestingConnection">
            <span v-if="syncStore.isTestingConnection" class="spinner small"></span>
            {{ t('button.testConnection') }}
          </button>
          <div class="test-connection-status">
            <transition name="fade">
              <span v-if="testMessage" :class="['status-text', testState]">
                {{ testMessage }}
              </span>
            </transition>
          </div>
        </div>
        <div class="main-buttons">
          <button class="action-button secondary" @click="handleBack">
            {{ t('dialog.cancel') }}
          </button>
          <button class="action-button primary" @click="handleBack">
            {{ t('dialog.ok') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import { useSyncStore } from '@renderer/features/sync';
import SyncDashboard from './sync/SyncDashboard.vue';
import WebDavConfig from './sync/WebDavConfig.vue';
import OssConfig from './sync/OssConfig.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();

const activeView = ref<'dashboard' | 'webdav' | 'oss-s3'>('dashboard');
const testMessage = ref('');
const testState = ref<'idle' | 'success' | 'error'>('idle');

const pageTitle = computed(() => {
  switch (activeView.value) {
    case 'webdav': return t('option.sync.webdav') + ' ' + t('common.setting');
    case 'oss-s3': return t('option.sync.oss') + ' ' + t('common.setting');
    default: return t('pref.pane.sync');
  }
});

const currentViewComponent = computed(() => {
  switch (activeView.value) {
    case 'webdav': return WebDavConfig;
    case 'oss-s3': return OssConfig;
    default: return SyncDashboard;
  }
});

const handleEditProvider = (provider: 'webdav' | 'oss-s3') => {
  activeView.value = provider;
};

const handleBack = () => {
  activeView.value = 'dashboard';
  testMessage.value = '';
  testState.value = 'idle';
};

const handleTestConnection = async () => {
  testMessage.value = '';
  testState.value = 'idle';
  const result = await syncStore.testConnection(settingsStore.config.sync);
  testState.value = result.success ? 'success' : 'error';
  testMessage.value = result.success ? t('option.sync.testSuccess') : (result.message || t('option.sync.testFailed'));
};
</script>

<style scoped>
.sync-config-content {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
}


.sync-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-buttons {
  display: flex;
  gap: 12px;
}

.test-connection-status {
  display: flex;
  align-items: center;
}

.status-text {
  font-size: 0.85rem;
}

.status-text.success {
  color: #10b981;
}

.status-text.error {
  color: #ef4444;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
