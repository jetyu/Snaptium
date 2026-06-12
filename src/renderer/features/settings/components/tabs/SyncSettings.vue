<template>
  <div class="settings-subview">
    <h3 class="panel-title">{{ pageTitle }}</h3>
    <LicenseGateNotice
      v-if="isLicenseLocked"
      class="license-gate"
      title-key="license.gate.sync.title"
      description-key="license.gate.sync.description"
    />

    <div class="settings-subview-content scrollable">
      <component :is="currentViewComponent" :key="activeView" @edit-provider="handleEditProvider" @back="handleBack" />
    </div>

    <div v-if="activeView !== 'dashboard'" class="settings-subview-footer with-divider">
      <div class="settings-subview-footer-buttons between">
        <div class="settings-subview-footer-left">
          <button class="action-button secondary" @click="handleTestConnection"
            :disabled="isLicenseLocked || syncStore.isTestingConnection">
            <span v-if="syncStore.isTestingConnection" class="spinner small"></span>
            {{ t('button.testConnection') }}
          </button>
        </div>
        <div class="settings-subview-footer-main">
          <button class="action-button secondary" @click="handleBack">
            {{ t('button.cancel') }}
          </button>
          <button class="action-button primary" @click="handleBack">
            {{ t('button.confirm') }}
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
import { systemDialog } from '../../services/system-dialog.service';
import { LicenseGateNotice, useLicenseGate } from '@renderer/features/license';
import SyncDashboard from './sync/SyncDashboard.vue';
import WebDavConfig from './sync/WebDavConfig.vue';
import OssConfig from './sync/OssConfig.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const syncLicenseGate = useLicenseGate('sync');
const isLicenseLocked = computed(() => !syncLicenseGate.allowed.value);

const activeView = ref<'dashboard' | 'webdav' | 'oss-s3'>('dashboard');

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
  if (isLicenseLocked.value) {
    syncLicenseGate.requestAccess();
    return;
  }

  activeView.value = provider;
};

const handleBack = () => {
  activeView.value = 'dashboard';
};

const handleTestConnection = async () => {
  if (isLicenseLocked.value) {
    syncLicenseGate.requestAccess();
    return;
  }

  try {
    const result = await syncStore.testConnection(settingsStore.config.sync);
    if (result.success) {
      await systemDialog.info({
        title: t('pref.pane.sync'),
        message: t('option.sync.testSuccess'),
      });
      return;
    }
    await systemDialog.error({
      title: t('pref.pane.sync'),
      message: result.message || t('option.sync.testFailed'),
    });
  } catch {
    await systemDialog.error({
      title: t('pref.pane.sync'),
      message: t('option.sync.testFailed'),
    });
  }
};
</script>

<style scoped>
.license-gate {
  margin-bottom: 1rem;
}
</style>
