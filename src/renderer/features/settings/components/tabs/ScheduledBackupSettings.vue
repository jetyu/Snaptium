<template>
  <div class="settings-grid settings-fade-in">
    <section v-if="settingsStore.scheduledBackupError" class="setting-card" role="alert">
      <div class="setting-copy">
        <p class="setting-label">{{ t('scheduledBackup.failed') }}</p>
        <p class="setting-description">{{ settingsStore.scheduledBackupError }}</p>
      </div>
      <button type="button" class="action-button secondary"
        :disabled="settingsStore.scheduledBackupRunning || !scheduledBackup.enabled"
        @click="settingsStore.scheduledBackupRetryRequest += 1">
        {{ t('scheduledBackup.retry') }}
      </button>
    </section>
    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.scheduledBackup') }}</p>
        <p class="setting-description">{{ t('scheduledBackup.description') }}</p>
      </div>
      <button type="button" class="startup-switch" :class="{ enabled: scheduledBackup.enabled }"
        :aria-pressed="scheduledBackup.enabled" @click="handleToggle">
        <span class="startup-switch-track">
          <span class="startup-switch-thumb" />
        </span>
        <span class="startup-switch-text">
          {{ scheduledBackup.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
        </span>
      </button>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('scheduledBackup.location') }}</p>
        <p class="setting-description backup-directory-path">
          {{ scheduledBackup.directoryPath || t('scheduledBackup.location.notSelected') }}
        </p>
      </div>
      <button type="button" class="action-button secondary" @click="handlePickDirectory">
        {{ t('button.browse') }}
      </button>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('scheduledBackup.frequency') }}</p>
        <p class="setting-description">{{ t('scheduledBackup.frequency.description') }}</p>
      </div>
      <label class="select-shell" :class="{ disabled: !scheduledBackup.enabled }">
        <select class="settings-select small-select" :value="scheduledBackup.intervalHours"
          :disabled="!scheduledBackup.enabled" @change="handleIntervalChange">
          <option :value="1">{{ t('scheduledBackup.frequency.hour1') }}</option>
          <option :value="2">{{ t('scheduledBackup.frequency.hour2') }}</option>
          <option :value="6">{{ t('scheduledBackup.frequency.hour6') }}</option>
          <option :value="12">{{ t('scheduledBackup.frequency.hour12') }}</option>
          <option :value="24">{{ t('scheduledBackup.frequency.daily') }}</option>
        </select>
      </label>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('scheduledBackup.retention') }}</p>
        <p class="setting-description">{{ t('scheduledBackup.retention.description') }}</p>
      </div>
      <label class="select-shell" :class="{ disabled: !scheduledBackup.enabled }">
        <select class="settings-select small-select" :value="scheduledBackup.retentionCount"
          :disabled="!scheduledBackup.enabled" @change="handleRetentionChange">
          <option v-for="count in SCHEDULED_BACKUP_RETENTION_COUNTS" :key="count" :value="count">
            {{ t('scheduledBackup.retention.count', { count }) }}
          </option>
        </select>
      </label>
    </section>

    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('scheduledBackup.lastBackup') }}</p>
        <p class="setting-description">{{ lastBackupText }}</p>
      </div>
      <button type="button" class="action-button secondary" :disabled="!scheduledBackup.directoryPath"
        @click="handleOpenBackupDirectory">
        {{ t('button.backupLocation') }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  SCHEDULED_BACKUP_INTERVAL_HOURS,
  SCHEDULED_BACKUP_RETENTION_COUNTS,
  type ScheduledBackupIntervalHours,
  type ScheduledBackupRetentionCount,
} from '@shared/scheduled-backup.constants';
import { useSettingsStore } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';

const { locale, t } = useI18n();
const settingsStore = useSettingsStore();

const scheduledBackup = computed(() => settingsStore.config.noteStorage.scheduledBackup);
const lastBackupText = computed(() => scheduledBackup.value.lastBackupAt === null
  ? t('scheduledBackup.never')
  : new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(scheduledBackup.value.lastBackupAt));

const chooseBackupDirectory = async (): Promise<string | null> => {
  return await settingsService.pickBackupDirectory();
};

const handleToggle = async (): Promise<void> => {
  if (scheduledBackup.value.enabled) {
    await settingsStore.noteStorage.updateScheduledBackup({ enabled: false });
    return;
  }

  let directoryPath = scheduledBackup.value.directoryPath;
  if (!directoryPath) {
    const selectedDirectory = await chooseBackupDirectory();
    if (!selectedDirectory) {
      return;
    }
    directoryPath = selectedDirectory;
  }

  await settingsStore.noteStorage.updateScheduledBackup({
    enabled: true,
    directoryPath,
  });
};

const handlePickDirectory = async (): Promise<void> => {
  const directoryPath = await chooseBackupDirectory();
  if (!directoryPath || directoryPath === scheduledBackup.value.directoryPath) {
    return;
  }

  await settingsStore.noteStorage.updateScheduledBackup({
    directoryPath,
    lastBackupAt: null,
  });
};

const handleOpenBackupDirectory = async (): Promise<void> => {
  await settingsService.openBackupDirectory();
};

const handleIntervalChange = async (event: Event): Promise<void> => {
  const intervalHours = Number((event.target as HTMLSelectElement).value);
  if (!SCHEDULED_BACKUP_INTERVAL_HOURS.includes(intervalHours as ScheduledBackupIntervalHours)) {
    return;
  }

  await settingsStore.noteStorage.updateScheduledBackup({
    intervalHours: intervalHours as ScheduledBackupIntervalHours,
  });
};

const handleRetentionChange = async (event: Event): Promise<void> => {
  const retentionCount = Number((event.target as HTMLSelectElement).value);
  if (!SCHEDULED_BACKUP_RETENTION_COUNTS.includes(retentionCount as ScheduledBackupRetentionCount)) {
    return;
  }

  await settingsStore.noteStorage.updateScheduledBackup({
    retentionCount: retentionCount as ScheduledBackupRetentionCount,
  });
};
</script>

<style scoped>
.backup-directory-path {
  overflow-wrap: anywhere;
}
</style>
