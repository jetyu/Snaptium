<template>
  <div class="settings-grid">
    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.ossEndpoint') }}</p>
        <p class="setting-description">{{ t('text.ossEndpoint') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.ossS3.endpoint"
          @change="handleFieldChange('endpoint', $event)" placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.remotePath') }}</p>
        <p class="setting-description">{{ t('text.remotePath') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.remotePath" @change="handleRemotePathChange"
          placeholder="/Snaptium" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.ossBucket') }}</p>
        <p class="setting-description">{{ t('text.ossBucket') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.ossS3.bucket"
          @change="handleFieldChange('bucket', $event)" placeholder="my-bucket" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.ossRegion') }}</p>
        <p class="setting-description">{{ t('text.ossRegion') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.ossS3.region"
          @change="handleFieldChange('region', $event)" placeholder="oss-cn-hangzhou" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.ossAccessKey') }}</p>
        <p class="setting-description">{{ t('text.ossAccessKey') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.ossS3.accessKeyId"
          @change="handleFieldChange('accessKeyId', $event)" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.ossSecretKey') }}</p>
        <p class="setting-description">{{ t('text.ossSecretKey') }}</p>
      </div>
      <div class="input-container">
        <input type="password" class="settings-input" :value="settingsStore.config.sync.ossS3.secretAccessKey"
          @change="handleFieldChange('secretAccessKey', $event)" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const handleFieldChange = (
  field: 'endpoint' | 'region' | 'bucket' | 'accessKeyId' | 'secretAccessKey',
  event: Event
) => {
  const target = event.target as HTMLInputElement;
  settingsStore.updateSyncProviderSetting('ossS3', field, target.value);
};

const handleRemotePathChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  settingsStore.updateSyncSetting('remotePath', target.value);
};
</script>
