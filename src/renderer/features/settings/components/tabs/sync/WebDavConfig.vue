<template>
  <div class="settings-grid">
    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.webdavUrl') }}</p>
        <p class="setting-description">{{ t('text.webdavUrl') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.webdav.url"
          @change="handleFieldChange('url', $event)" placeholder="https://example.com/dav" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.remotePath') }}</p>
        <p class="setting-description">{{ t('text.remotePath') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.remotePath" @change="handleRemotePathChange"
          placeholder="/NoteWizard" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.webdavUsername') }}</p>
        <p class="setting-description">{{ t('text.webdavUsername') }}</p>
      </div>
      <div class="input-container">
        <input class="settings-input" :value="settingsStore.config.sync.webdav.username"
          @change="handleFieldChange('username', $event)" />
      </div>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.webdavPassword') }}</p>
        <p class="setting-description">{{ t('text.webdavPassword') }}</p>
      </div>
      <div class="input-container">
        <input type="password" class="settings-input" :value="settingsStore.config.sync.webdav.password"
          @change="handleFieldChange('password', $event)" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const handleFieldChange = (field: 'url' | 'username' | 'password', event: Event) => {
  const target = event.target as HTMLInputElement;
  settingsStore.updateSyncProviderSetting('webdav', field, target.value);
};

const handleRemotePathChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  settingsStore.updateSyncSetting('remotePath', target.value);
};
</script>
