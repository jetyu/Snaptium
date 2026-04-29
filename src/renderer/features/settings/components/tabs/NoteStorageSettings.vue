<template>
  <div class="note-settings">
    <h3 class="panel-title">{{ t('pref.pane.noteStorage') }}</h3>

    <div class="settings-grid">
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.noteStorageLocation') }}</p>
          <p class="setting-description">{{ t('text.noteStorageLocation') }}{{ settingsStore.config.noteSavePath }}</p>
        </div>
        <button type="button" class="action-button" @click="handlePickPath">
          {{ t('button.browse') }}
        </button>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.maxHistoryVersions') }}</p>
          <p class="setting-description">{{ t('text.maxHistoryVersions') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select small-select" :value="maxHistoryVersions"
            @change="handleMaxHistoryVersionsChange">
            <option :value="0">{{ t('option.maxHistoryVersions.disable') }}</option>
            <option :value="10">{{ t('option.maxHistoryVersions.record10') }}</option>
            <option :value="20">{{ t('option.maxHistoryVersions.record20') }}</option>
            <option :value="50">{{ t('option.maxHistoryVersions.record50') }}</option>
            <option :value="100">{{ t('option.maxHistoryVersions.record100') }}</option>
          </select>
        </label>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.snapshotInterval') }}</p>
          <p class="setting-description">{{ t('text.snapshotInterval') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: maxHistoryVersions === 0 }">
          <select class="settings-select small-select" :value="snapshotInterval" :disabled="maxHistoryVersions === 0"
            @change="handleSnapshotIntervalChange">
            <option :value="15">{{ t('option.snapshotInterval.15min') }}</option>
            <option :value="30">{{ t('option.snapshotInterval.30min') }}</option>
            <option :value="60">{{ t('option.snapshotInterval.60min') }}</option>
          </select>
        </label>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.trashAutoClear') }}</p>
          <p class="setting-description">{{ t('text.trashAutoClear') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select small-select" :value="settingsStore.config.trashAutoClearDays"
            @change="handleTrashAutoClearChange">
            <option :value="0">{{ t('option.trashAutoClear.never') }}</option>
            <option :value="7">{{ t('option.trashAutoClear.days7') }}</option>
            <option :value="30">{{ t('option.trashAutoClear.days30') }}</option>
          </select>
        </label>
      </section>

      <section class="setting-card data-transfer-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('dataTransfer.sppx.sectionTitle') }}</p>
          <p class="setting-description">{{ t('dataTransfer.sppx.sectionDescription') }}</p>
        </div>
        <div class="settings-row">
          <button type="button" class="action-button" :disabled="isBusy" @click="handleExportSppx">
            <span v-if="busyAction === 'exportSppx'" class="spinner small" />
            {{ t('button.export') }}
          </button>
          <button type="button" class="action-button" :disabled="isBusy" @click="handleImportSppx">
            <span v-if="busyAction === 'importSppx'" class="spinner small" />
            {{ t('button.import') }}
          </button>
        </div>
      </section>

      <section class="setting-card data-transfer-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('dataTransfer.markdown.sectionTitle') }}</p>
          <p class="setting-description">{{ t('dataTransfer.markdown.sectionDescription') }}</p>
        </div>
        <div class="settings-row">

          <button type="button" class="action-button" :disabled="isBusy" @click="handleExportMarkdown">
            <span v-if="busyAction === 'exportMarkdown'" class="spinner small" />
            {{ t('button.export') }}
          </button>
          <button type="button" class="action-button" :disabled="isBusy" @click="handleImportMarkdown">
            <span v-if="busyAction === 'importMarkdown'" class="spinner small" />
            {{ t('button.import') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { settingsService } from '../../services/settings.service';
import { systemDialog } from '../../services/system-dialog.service';
import { getErrorMessage } from '@shared/utils/error.utils';
import type {
  MarkdownExportResult,
  MarkdownImportResult,
  SppxExportResult,
  SppxImportResult,
} from '@renderer/core/bridge/electronApi';

type BusyAction = 'exportSppx' | 'importSppx' | 'importMarkdown' | 'exportMarkdown' | null;

const { t } = useI18n();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();

const busyAction = ref<BusyAction>(null);

const isBusy = computed(() => busyAction.value !== null);

const maxHistoryVersions = computed({
  get: () => settingsStore.config.maxHistoryVersions ?? 50,
  set: (val: number) => {
    settingsStore.updateSetting('maxHistoryVersions', val);
  },
});

const snapshotInterval = computed({
  get: () => settingsStore.config.snapshotInterval ?? 15,
  set: (val: number) => {
    settingsStore.updateSetting('snapshotInterval', val);
  },
});

const showFeedbackDialog = async (
  type: 'info' | 'error',
  message: string,
  detail = '',
) => {
  const payload = {
    title: t('pref.pane.noteStorage'),
    message,
    detail,
  };
  if (type === 'info') {
    await systemDialog.info(payload);
    return;
  }
  await systemDialog.error(payload);
};

const prepareDataOperation = async (action: BusyAction) => {
  busyAction.value = action;
  await workspaceStore.forceFlushAutoSave();
};

const finalizeDataOperation = async () => {
  await settingsStore.loadSettings();
  busyAction.value = null;
};

const handlePickPath = async () => {
  const newPath = await settingsService.pickDirectory();
  if (newPath) {
    await settingsStore.setNoteSavePath(newPath);
    await workspaceStore.initializeWorkspace(true);
  }
};

const handleMaxHistoryVersionsChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val) && val >= 0) {
    maxHistoryVersions.value = val;
  }
};

const handleSnapshotIntervalChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val)) {
    snapshotInterval.value = val;
  }
};

const handleTrashAutoClearChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val)) {
    settingsStore.updateSetting('trashAutoClearDays', val);
  }
};

const handleExportSppx = async () => {
  if (isBusy.value) return;
  await prepareDataOperation('exportSppx');
  try {
    const result: SppxExportResult = await settingsService.exportSppxPackage();
    if (result.cancelled) {
      return;
    }
    if (!result.success) {
      throw new Error(t('dataTransfer.message.failed'));
    }

    const message = result.filePath
      ? `${t('dataTransfer.message.sppxExportSuccess')} ${result.filePath}`
      : t('dataTransfer.message.sppxExportSuccess');
    await showFeedbackDialog('info', message);
  } catch (error) {
    await showFeedbackDialog('error', t('dataTransfer.message.failed'), getErrorMessage(error, t('common.unknown')));
  } finally {
    await finalizeDataOperation();
  }
};

const handleImportSppx = async () => {
  if (isBusy.value) return;
  await prepareDataOperation('importSppx');
  try {
    const result: SppxImportResult = await settingsService.importSppxPackage();
    if (result.cancelled) {
      return;
    }
    if (!result.success) {
      throw new Error(t('dataTransfer.message.failed'));
    }

    await workspaceStore.initializeWorkspace(true);
    await showFeedbackDialog('info', t('dataTransfer.message.sppxImportSuccess'));
  } catch (error) {
    await showFeedbackDialog('error', t('dataTransfer.message.failed'), getErrorMessage(error, t('common.unknown')));
  } finally {
    await finalizeDataOperation();
  }
};

const handleImportMarkdown = async () => {
  if (isBusy.value) return;
  await prepareDataOperation('importMarkdown');
  try {
    const result: MarkdownImportResult = await settingsService.importMarkdownBatch();
    if (result.cancelled) {
      return;
    }
    if (!result.success) {
      throw new Error(t('dataTransfer.message.failed'));
    }

    await workspaceStore.initializeWorkspace(true);
    const summary = t('dataTransfer.message.markdownImportSummary', {
      scanned: result.scannedFiles ?? 0,
      imported: result.importedNotes ?? 0,
      notebooks: result.createdNotebooks ?? 0,
      images: result.copiedImages ?? 0,
      skipped: result.skippedFiles ?? 0,
      failed: result.failedFiles ?? 0,
    });
    await showFeedbackDialog('info', summary);
  } catch (error) {
    await showFeedbackDialog('error', t('dataTransfer.message.failed'), getErrorMessage(error, t('common.unknown')));
  } finally {
    await finalizeDataOperation();
  }
};

const handleExportMarkdown = async () => {
  if (isBusy.value) return;
  await prepareDataOperation('exportMarkdown');
  try {
    const result: MarkdownExportResult = await settingsService.exportMarkdownBatch();
    if (result.cancelled) {
      return;
    }
    if (!result.success) {
      throw new Error(t('dataTransfer.message.failed'));
    }

    const summary = t('dataTransfer.message.markdownExportSummary', {
      exported: result.exportedNotes ?? 0,
      dirs: result.createdDirectories ?? 0,
      images: result.copiedImages ?? 0,
      skippedImages: result.skippedImages ?? 0,
      failed: result.failedFiles ?? 0,
    });
    await showFeedbackDialog('info', summary);
  } catch (error) {
    await showFeedbackDialog('error', t('dataTransfer.message.failed'), getErrorMessage(error, t('common.unknown')));
  } finally {
    await finalizeDataOperation();
  }
};
</script>

<style scoped>
.data-transfer-card {
  gap: 12px;
}
</style>
