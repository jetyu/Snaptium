<template>
    <div class="sync-settings">
        <h3 class="panel-title">{{ t('pref.pane.sync') }}</h3>

        <div class="settings-grid">
            <section class="setting-card">
                <div class="setting-copy">
                    <p class="setting-label">{{ t('label.syncRemoteData') }}</p>
                    <p class="setting-description">{{ t('text.syncRemoteData') }}</p>
                </div>
                <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.sync.enabled }"
                    :aria-pressed="settingsStore.config.sync.enabled" @click="toggleSyncEnabled">
                    <span class="startup-switch-track">
                        <span class="startup-switch-thumb" />
                    </span>
                    <span class="startup-switch-text">
                        {{ settingsStore.config.sync.enabled ? t('checkbox.status.enabled') :
                            t('checkbox.status.disabled') }}
                    </span>
                </button>
            </section>
            <div class="settings-row-grid">
                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.syncInterval') }}</p>
                        <p class="setting-description">{{ t('text.syncInterval') }}</p>
                    </div>
                    <label class="select-shell">
                        <select class="settings-select" :value="settingsStore.config.sync.intervalMinutes"
                            @change="handleIntervalChange">
                            <option v-for="option in SYNC_INTERVAL_OPTIONS" :key="option.value" :value="option.value">
                                {{ t(option.labelKey) }}
                            </option>
                        </select>
                    </label>
                </section>

                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.syncAutoOnSave') }}</p>
                        <p class="setting-description">{{ t('text.syncAutoOnSave') }}</p>
                    </div>
                    <button type="button" class="startup-switch"
                        :class="{ enabled: settingsStore.config.sync.autoSyncOnSave }"
                        :aria-pressed="settingsStore.config.sync.autoSyncOnSave" @click="toggleAutoSyncOnSave">
                        <span class="startup-switch-track">
                            <span class="startup-switch-thumb" />
                        </span>
                        <span class="startup-switch-text">
                            {{ settingsStore.config.sync.autoSyncOnSave ? t('checkbox.status.enabled') :
                                t('checkbox.status.disabled') }}
                        </span>
                    </button>
                </section>
            </div>
            <div class="settings-row-grid">
                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.syncTarget') }}</p>
                        <p class="setting-description">{{ t('text.syncTarget') }}</p>
                    </div>
                    <label class="select-shell">
                        <select class="settings-select" :value="settingsStore.config.sync.provider"
                            @change="handleProviderChange">
                            <option value="webdav">{{ t('option.sync.webdav') }}</option>
                            <option value="oss-s3">{{ t('option.sync.oss') }}</option>
                        </select>
                    </label>
                </section>
                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.remotePath') }}</p>
                        <p class="setting-description">{{ t('text.remotePath') }}</p>
                    </div>
                    <input class="settings-input sync-remote-path" :value="settingsStore.config.sync.remotePath"
                        @change="handleRemotePathChange" />
                </section>
            </div>
            <template v-if="settingsStore.config.sync.provider === 'webdav'">
                <div class="settings-row-grid">
                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.webdavUrl') }}</p>
                            <p class="setting-description">{{ t('text.webdavUrl') }}</p>
                        </div>
                        <input class="settings-input sync-webdav-url" :value="settingsStore.config.sync.webdav.url"
                            @change="handleWebDavFieldChange('url', $event)" />
                    </section>

                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.webdavUsername') }}</p>
                            <p class="setting-description">{{ t('text.webdavUsername') }}</p>
                        </div>
                        <input class="settings-input sync-webdav-username"
                            :value="settingsStore.config.sync.webdav.username"
                            @change="handleWebDavFieldChange('username', $event)" />
                    </section>
                </div>

                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.webdavPassword') }}</p>
                        <p class="setting-description">{{ t('text.webdavPassword') }}</p>
                    </div>
                    <input type="password" class="settings-input sync-webdav-password"
                        :value="settingsStore.config.sync.webdav.password"
                        @change="handleWebDavFieldChange('password', $event)" />
                </section>
            </template>

            <template v-else>
                <div class="settings-row-grid">
                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.ossEndpoint') }}</p>
                            <p class="setting-description">{{ t('text.ossEndpoint') }}</p>
                        </div>
                        <input class="settings-input sync-oss-endpoint"
                            :value="settingsStore.config.sync.ossS3.endpoint"
                            @change="handleOssFieldChange('endpoint', $event)" />
                    </section>

                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.ossRegion') }}</p>
                            <p class="setting-description">{{ t('text.ossRegion') }}</p>
                        </div>
                        <input class="settings-input sync-oss-region" :value="settingsStore.config.sync.ossS3.region"
                            @change="handleOssFieldChange('region', $event)" />
                    </section>
                </div>

                <div class="settings-row-grid">
                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.ossBucket') }}</p>
                            <p class="setting-description">{{ t('text.ossBucket') }}</p>
                        </div>
                        <input class="settings-input sync-oss-bucket" :value="settingsStore.config.sync.ossS3.bucket"
                            @change="handleOssFieldChange('bucket', $event)" />
                    </section>

                    <section class="setting-card">
                        <div class="setting-copy">
                            <p class="setting-label">{{ t('label.ossAccessKey') }}</p>
                            <p class="setting-description">{{ t('text.ossAccessKey') }}</p>
                        </div>
                        <input class="settings-input sync-oss-access-key"
                            :value="settingsStore.config.sync.ossS3.accessKeyId"
                            @change="handleOssFieldChange('accessKeyId', $event)" />
                    </section>
                </div>

                <section class="setting-card">
                    <div class="setting-copy">
                        <p class="setting-label">{{ t('label.ossSecretKey') }}</p>
                        <p class="setting-description">{{ t('text.ossSecretKey') }}</p>
                    </div>
                    <input type="password" class="settings-input sync-oss-secret-key"
                        :value="settingsStore.config.sync.ossS3.secretAccessKey"
                        @change="handleOssFieldChange('secretAccessKey', $event)" />
                </section>
            </template>

            <section class="setting-card sync-status-card">
                <div class="setting-copy">
                    <p class="setting-label">{{ t('label.syncStatus') }}</p>
                    <div class="sync-status-line">
                        <span class="sync-status-pill" :class="statusToneClass">{{ statusLabel }}</span>
                        <span v-if="formattedLastSynced" class="setting-meta sync-status-item">
                            {{ t('label.lastSynced') }}: {{ formattedLastSynced }}
                        </span>
                        <span v-if="statusFeedbackMessage" class="setting-meta sync-status-item"
                            :class="statusFeedbackClass">
                            {{ statusFeedbackMessage }}
                        </span>
                    </div>

                    <div v-if="syncStore.lastSummary" class="sync-summary-inline">
                        <span class="sync-summary-label">{{ t('label.syncSummary') }}</span>
                        <div class="summary-grid summary-grid--compact sync-summary-pills">
                            <span v-for="item in summaryItems" :key="item" class="summary-pill">{{ item }}</span>
                        </div>
                    </div>
                </div>
                <div class="action-row">
                    <button type="button" class="action-button"
                        :disabled="syncStore.isTestingConnection || !isConfigReady" @click="handleTestConnection">
                        {{ syncStore.isTestingConnection ? t('button.testing') : t('button.testConnection') }}
                    </button>
                    <button type="button" class="action-button"
                        :disabled="syncStore.isSyncing || !settingsStore.config.sync.enabled || !isConfigReady"
                        @click="handleSyncNow">
                        {{ syncStore.isSyncing ? t('button.syncing') : t('button.syncNow') }}
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { useSettingsStore } from '../../store/settings.store';
import { SYNC_INTERVAL_OPTIONS, SYNC_TRIGGERS, syncService, useSyncStore } from '@renderer/features/sync';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const workspaceStore = useWorkspaceStore();
const testMessage = ref('');
const testState = ref<'idle' | 'success' | 'error'>('idle');

const isConfigReady = computed(() => syncService.isConfigReady(settingsStore.config.sync));
const statusLabel = computed(() => t(`syncStatus.${syncStore.status}`));
const statusToneClass = computed(() => {
    if (syncStore.lastError?.message || testState.value === 'error' || syncStore.status === 'error') {
        return 'is-error';
    }

    if (syncStore.isSyncing || syncStore.status === 'syncing') {
        return 'is-syncing';
    }

    return 'is-idle';
});
const statusFeedbackMessage = computed(() => syncStore.lastError?.message || testMessage.value || '');
const statusFeedbackClass = computed(() => {
    if (syncStore.lastError?.message || testState.value === 'error') {
        return 'setting-meta--error';
    }

    return testMessage.value ? 'setting-meta--success' : '';
});
const summaryItems = computed(() => {
    if (!syncStore.lastSummary) {
        return [];
    }

    const items = [
        { count: syncStore.lastSummary.uploaded, label: t('sync.summary.uploaded', { count: syncStore.lastSummary.uploaded }) },
        { count: syncStore.lastSummary.downloaded, label: t('sync.summary.downloaded', { count: syncStore.lastSummary.downloaded }) },
        { count: syncStore.lastSummary.deletedLocal, label: t('sync.summary.deletedLocal', { count: syncStore.lastSummary.deletedLocal }) },
        { count: syncStore.lastSummary.deletedRemote, label: t('sync.summary.deletedRemote', { count: syncStore.lastSummary.deletedRemote }) },
        { count: syncStore.lastSummary.merged, label: t('sync.summary.merged', { count: syncStore.lastSummary.merged }) },
        { count: syncStore.lastSummary.conflicts, label: t('sync.summary.conflicts', { count: syncStore.lastSummary.conflicts }) },
    ];

    const activeItems = items.filter((item) => item.count > 0).map((item) => item.label);
    return activeItems.length > 0 ? activeItems : [t('sync.summary.noChanges')];
});
const formattedLastSynced = computed(() => {
    const lastSyncedAt = syncStore.lastSyncedAt ?? settingsStore.config.sync.lastSyncedAt;
    if (!lastSyncedAt) {
        return '';
    }

    return new Intl.DateTimeFormat(settingsStore.config.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(lastSyncedAt);
});

const toggleSyncEnabled = async () => {
    await settingsStore.updateSyncSetting('enabled', !settingsStore.config.sync.enabled);
};

const toggleAutoSyncOnSave = async () => {
    await settingsStore.updateSyncSetting('autoSyncOnSave', !settingsStore.config.sync.autoSyncOnSave);
};

const handleProviderChange = async (event: Event) => {
    const target = event.target as HTMLSelectElement;
    await settingsStore.updateSyncSetting('provider', target.value as 'webdav' | 'oss-s3');
};

const handleIntervalChange = async (event: Event) => {
    const target = event.target as HTMLSelectElement;
    await settingsStore.updateSyncSetting('intervalMinutes', Number(target.value));
};

const handleRemotePathChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    await settingsStore.updateSyncSetting('remotePath', target.value);
};

const handleWebDavFieldChange = async (field: 'url' | 'username' | 'password', event: Event) => {
    const target = event.target as HTMLInputElement;
    await settingsStore.updateSyncProviderSetting('webdav', field, target.value);
};

const handleOssFieldChange = async (
    field: 'endpoint' | 'region' | 'bucket' | 'accessKeyId' | 'secretAccessKey',
    event: Event
) => {
    const target = event.target as HTMLInputElement;
    await settingsStore.updateSyncProviderSetting('ossS3', field, target.value);
};

const handleTestConnection = async () => {
    testMessage.value = '';
    testState.value = 'idle';
    const result = await syncStore.testConnection(settingsStore.config.sync);
    testState.value = result.success ? 'success' : 'error';
    testMessage.value = result.success ? t('option.sync.testSuccess') : (result.message || t('option.sync.testFailed'));
};

const handleSyncNow = async () => {
    testMessage.value = '';
    testState.value = 'idle';
    await workspaceStore.forceFlushAutoSave();
    const result = await syncStore.runSync(settingsStore.config.sync, SYNC_TRIGGERS.MANUAL);
    if (!result && syncStore.lastError?.message) {
        testState.value = 'error';
        testMessage.value = syncStore.lastError.message;
    }
};
</script>

<style scoped>
.sync-settings {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
}

.settings-row-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
}

.action-row {
    display: flex;
    gap: 8px;
}

.sync-status-card {
    align-items: center;
}

.sync-status-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin-top: 0.45rem;
}

.sync-summary-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.75rem;
    margin-top: 0.55rem;
}

.sync-summary-label {
    color: #344054;
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
}

.sync-status-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.22rem 0.62rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.2;
}

.sync-status-pill.is-idle {
    background: #edfdf3;
    color: #067647;
    border-color: #abefc6;
}

.sync-status-pill.is-syncing {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
}

.sync-status-pill.is-error {
    background: #fef3f2;
    color: #b42318;
    border-color: #fecdca;
}

.sync-status-item {
    margin: 0;
    white-space: nowrap;
}

.sync-webdav-url,
.sync-webdav-username,
.sync-webdav-password,
.sync-oss-endpoint,
.sync-oss-region,
.sync-oss-bucket,
.sync-oss-access-key,
.sync-oss-secret-key,
.sync-remote-path {
    width: 60%;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 16px;
    color: var(--text-secondary, #4b5563);
    font-size: 0.92rem;
}

.summary-grid--compact {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
}

.sync-summary-pills {
    justify-content: flex-start;
}

.summary-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #475467;
    font-size: 0.8rem;
    line-height: 1.2;
    white-space: nowrap;
}

.setting-meta {
    margin: 6px 0 0;
    color: var(--text-secondary, #4b5563);
    font-size: 0.88rem;
}

.setting-meta--error {
    color: #b42318;
}

.setting-meta--success {
    color: #067647;
}

@media (max-width: 1024px) {

    .setting-card>.settings-input,
    .setting-card>.select-shell {
        width: 100%;
        flex-basis: auto;
    }

    .settings-row-grid,
    .summary-grid {
        grid-template-columns: 1fr;
    }

    .summary-grid--compact {
        justify-content: flex-start;
    }

    .sync-status-card {
        align-items: stretch;
    }

    .sync-status-item {
        white-space: normal;
    }

    .sync-summary-label {
        white-space: normal;
    }

    .action-row {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>