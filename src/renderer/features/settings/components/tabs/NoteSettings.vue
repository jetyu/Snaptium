<template>
    <div class="note-settings">
        <h3 class="panel-title">{{ t('pref.pane.note') }}</h3>

        <div class="settings-grid">

            <section class="setting-card">
                <div class="setting-copy">
                    <p class="setting-label">{{ t('label.noteStorageLocation') }}</p>
                    <p class="setting-description">{{ settingsStore.config.noteSavePath }}</p>
                </div>
                <button type="button" class="action-button" @click="handlePickPath">
                    {{ t('button.browse') }}
                </button>
            </section>
            <div class="settings-row-grid">
                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.maxHistoryVersions') }}</p>
                        <p class="setting-description">{{ t('text.maxHistoryVersions') }}</p>
                    </div>
                    <label class="select-shell">
                        <select class="settings-select" :value="maxHistoryVersions"
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
                    <label class="select-shell" :class="{ 'disabled-shell': maxHistoryVersions === 0 }">
                        <select class="settings-select" :value="snapshotInterval" :disabled="maxHistoryVersions === 0"
                            @change="handleSnapshotIntervalChange">
                            <option :value="15">{{ t('option.snapshotInterval.15min') }}</option>
                            <option :value="30">{{ t('option.snapshotInterval.30min') }}</option>
                            <option :value="60">{{ t('option.snapshotInterval.60min') }}</option>
                        </select>
                    </label>
                </section>
            </div>
            <section class="setting-card">
                <div class="setting-copy">
                    <p class="setting-label">{{ t('label.trashAutoClear') }}</p>
                    <p class="setting-description">{{ t('text.trashAutoClear') }}</p>
                </div>
                <label class="select-shell">
                    <select class="settings-select" :value="settingsStore.config.trashAutoClearDays"
                        @change="handleTrashAutoClearChange">
                        <option :value="0">{{ t('option.trashAutoClear.never') }}</option>
                        <option :value="7">{{ t('option.trashAutoClear.days7') }}</option>
                        <option :value="30">{{ t('option.trashAutoClear.days30') }}</option>
                    </select>
                </label>
            </section>

        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { settingsService } from '../../services/settings.service';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const handlePickPath = async () => {
    const newPath = await settingsService.pickDirectory();
    if (newPath) {
        await settingsStore.setNoteSavePath(newPath);
        // Reload workspace
        const workspaceStore = useWorkspaceStore();
        await workspaceStore.initializeWorkspace(true);
    }
};


const maxHistoryVersions = computed({
    get: () => settingsStore.config.maxHistoryVersions ?? 50,
    set: (val: number) => {
        settingsStore.updateSetting('maxHistoryVersions', val);
    }
});

const snapshotInterval = computed({
    get: () => settingsStore.config.snapshotInterval ?? 15,
    set: (val: number) => {
        settingsStore.updateSetting('snapshotInterval', val);
    }
});

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
</script>

<style scoped>
.general-settings {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
}

.settings-row-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
}

@media (max-width: 1024px) {
    .settings-row-grid {
        grid-template-columns: 1fr;
    }
}

.number-input-container {
    width: 100px;
}

.disabled-shell {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}
</style>
