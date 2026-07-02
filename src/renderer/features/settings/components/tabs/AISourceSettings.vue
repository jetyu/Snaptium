<template>
  <div class="ai-source-settings">
    <div class="header-actions">
      <h3 class="panel-title">{{ t('pref.pane.aiSources') }}</h3>
    </div>
    <LicenseGateNotice v-if="isLicenseLocked" class="license-gate" title-key="license.gate.aiSources.title"
      description-key="license.gate.aiSources.description" />


    <div class="source-list">
      <template v-if="!showAddForm">
        <div v-for="source in settingsStore.config.aiSources" :key="source.id"
          class="source-card setting-card vertical-layout"
          :class="{ 'official-source-card': isOfficialSource(source) }">
          <div class="source-info">
            <div class="source-header">
              <div class="source-identity">
                <span v-if="isOfficialSource(source)" class="official-source-mark"
                  :title="t('text.officialInnerAiSource')">
                  <IconTextScanAi :size="16" />
                </span>
                <h4 class="source-title">{{ source.name }}</h4>
              </div>
              <div class="settings-card-actions">
                <span v-if="isLockedSource(source)" class="source-lock-badge" :title="t('text.officialInnerAiSource')">
                  <IconSettingsAi :size="13" />
                  {{ t('label.officialAiSource') }}
                </span>
                <template v-else>
                  <button class="action-btn" :disabled="isLicenseLocked" @click="handleEditSource(source)"
                    :title="t('common.editor')">
                    <IconPencil :size="14" />
                  </button>
                  <button class="action-btn delete" :disabled="isLicenseLocked" @click="removeSource(source)"
                    :title="t('title.clearConfiguration')">
                    <IconTrash :size="14" />
                  </button>
                </template>
              </div>
            </div>
            <div class="source-details" :class="{ 'official-source-details': isOfficialSource(source) }">
              <div v-if="!isOfficialSource(source)" class="detail-item">
                <span class="label">{{ t('label.aiBaseUrl') }}</span>
                <span class="value" :title="source.baseUrl">{{ source.baseUrl }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('label.aiModel') }}</span>
                <span class="value" :title="source.aiModel">{{ source.aiModel }}</span>
              </div>
              <div v-if="!isOfficialSource(source)" class="detail-item">
                <span class="label">{{ t('label.aiApiKey') }}</span>
                <span class="value">••••••••••••••••••••••••••</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('label.aiCapabilities') }}</span>
                <span class="value" :title="formatCapabilities(source.capabilities)">{{
                  formatCapabilities(source.capabilities) }}</span>
              </div>
              <div v-if="isOfficialSource(source)" class="detail-item model-description-item">
                <span class="label">{{ t('label.aiModelDescription') }}</span>
                <span class="value" :title="t(getOfficialModelDescriptionKey(source))">
                  {{ t(getOfficialModelDescriptionKey(source)) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Add Source Form (Inside Grid) -->
      <div v-if="showAddForm" class="add-form-card">
        <div class="source-form-group">
          <label class="setting-label">
            {{ t('label.sourceName') }} <span class="required-mark">{{ t('label.starSign') }}</span>
            <span class="char-counter">{{ newSource.name.length }}/20</span>
          </label>
          <input v-model="newSource.name" type="text" class="settings-input" maxlength="20"
            :placeholder="t('placeholder.sourceName')" :disabled="isLicenseLocked" />
        </div>

        <div class="source-form-group">
          <label class="setting-label">{{ t('label.aiBaseUrl') }} <span class="required-mark">{{ t('label.starSign')
              }}</span></label>
          <input v-model="newSource.baseUrl" type="text" class="settings-input"
            :placeholder="t('placeholder.aiAPIEndpoint')" :disabled="isLicenseLocked" />
        </div>
        <div class="source-form-group">
          <label class="setting-label">{{ t('label.aiModel') }} <span class="required-mark">{{ t('label.starSign')
          }}</span></label>
          <input v-model="newSource.aiModel" type="text" class="settings-input" :placeholder="t('placeholder.aiModel')"
            :disabled="isLicenseLocked" />
        </div>
        <div class="source-form-group">
          <label class="setting-label">{{ t('label.aiApiKey') }} <span class="required-mark">{{ t('label.starSign')
          }}</span></label>
          <PasswordInput v-model="newSource.apiKey" :placeholder="t('placeholder.aiAPIKey')" autocomplete="off"
            :disabled="isLicenseLocked" />
        </div>
        <div class="source-form-group">
          <label class="setting-label">{{ t('label.aiCapabilities') }}</label>
          <div class="capability-list">
            <label v-for="option in capabilityOptions" :key="option.value" class="capability-option">
              <input :checked="newSource.capabilities.includes(option.value)" type="checkbox"
                :disabled="isLicenseLocked"
                @change="toggleCapability(option.value, ($event.target as HTMLInputElement).checked)" />
              <span>{{ t(option.labelKey) }}</span>
            </label>
          </div>
        </div>
        <div class="form-actions-row">
          <div class="buttons">
            <button class="action-button secondary" @click="handleTestNewSource"
              :disabled="isLicenseLocked || !canTest || isTesting">
              <span v-if="isTesting" class="spinner small"></span>
              {{ isTesting ? t('button.testing') : t('button.testConnection') }}
            </button>
            <button class="action-button secondary" @click="handleCancelAdd">
              {{ t('button.cancel') }}
            </button>
            <button class="action-button primary" @click="handleAddSource"
              :disabled="isLicenseLocked || !isFormValid || isAdding">
              <template v-if="isAdding">
                <span class="spinner small"></span>
              </template>
              <template v-else>
                {{ t('button.confirm') }}
              </template>
            </button>
          </div>
        </div>
      </div>

      <!-- Add Source Card (Placeholder) -->
      <div v-else-if="settingsStore.config.aiSources.length > 0" class="add-source-card"
        @click="handleAddSourceTrigger">
        <div class="add-icon">
          <IconPlus :size="24" />
        </div>
        <span>{{ t('button.addAISource') }}</span>
      </div>

      <div v-if="settingsStore.config.aiSources.length === 0 && !showAddForm" class="add-source-card empty-trigger-card"
        @click="handleAddSourceTrigger">
        <div class="empty-icon">
          <IconBulb :size="48" />
        </div>
        <p class="empty-text">{{ t('text.noAISourcesFound') }}</p>
        <span class="empty-action-text">{{ t('button.addAISource') }}</span>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import type { AISource } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';
import { systemDialog } from '../../services/system-dialog.service';
import { createLogger } from '../../../logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { isOfficialAiSourceId } from '@shared/official-ai.constants';
import { IconPlus, IconBulb, IconTrash, IconPencil, IconSettingsAi, IconTextScanAi } from '@tabler/icons-vue';
import { LicenseGateNotice, useLicenseGate } from '@renderer/features/license';
import PasswordInput from '../PasswordInput.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const aisLogger = createLogger('AISettings');
const aiSourceLicenseGate = useLicenseGate('aiSources');

const showAddForm = ref(false);
const isAdding = ref(false);
const isTesting = ref(false);
const editingSourceId = ref<string | null>(null);
const isLicenseLocked = computed(() => !aiSourceLicenseGate.allowed.value);

const isEditMode = computed(() => !!editingSourceId.value);

const isOfficialSource = (source: AISource): boolean => {
  return source.official === true || isOfficialAiSourceId(source.id);
};

const isLockedSource = (source: AISource): boolean => {
  return source.locked === true || isOfficialSource(source);
};

const getOfficialModelDescriptionKey = (source: AISource): string => {
  if (source.capabilities.includes('embedding')) {
    return 'text.officialAiEmbeddingDescription';
  }

  if (source.capabilities.includes('reranker')) {
    return 'text.officialAiRerankerDescription';
  }

  return 'text.officialAiChatDescription';
};

const newSource = reactive({
  name: '',
  baseUrl: '',
  apiKey: '',
  aiModel: '',
  capabilities: ['embedding', 'chat', 'reranker'],
});

const capabilityOptions = [
  { value: 'embedding', labelKey: 'label.aiCapabilityEmbedding' },
  { value: 'chat', labelKey: 'label.aiCapabilityChat' },
  { value: 'reranker', labelKey: 'label.aiCapabilityReranker' },
] as const;

// Basic validation for testing (All 4 marked fields are now mandatory)
const canTest = computed(() => {
  return !!(
    newSource.name.trim() &&
    newSource.baseUrl.trim() &&
    newSource.aiModel.trim() &&
    newSource.apiKey.trim()
  );
});

// Validation for adding (Name, Endpoint, Key are mandatory. Model is optional but recommended)
const isFormValid = computed(() => canTest.value);

const requestLicenseAccessIfNeeded = (): boolean => {
  if (!isLicenseLocked.value) {
    return false;
  }

  aiSourceLicenseGate.requestAccess();
  return true;
};

const handleAddSourceTrigger = (): void => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  showAddForm.value = true;
};

const handleAddSource = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!isFormValid.value || isAdding.value) return;

  isAdding.value = true;

  try {
    const payload = {
      name: newSource.name,
      baseUrl: newSource.baseUrl,
      apiKey: newSource.apiKey,
      aiModel: newSource.aiModel,
      capabilities: [...newSource.capabilities],
    };

    if (isEditMode.value && editingSourceId.value) {
      aisLogger.info(`Updating AI source: ${newSource.name} (ID: ${editingSourceId.value})`);
      await settingsStore.updateAiSource(editingSourceId.value, payload);
    } else {
      aisLogger.info(`Adding AI source after successful test: ${newSource.name}`);
      const result = await settingsStore.addAiSource(payload);
      aisLogger.info(`AI Source added: ${result.name} (ID: ${result.id})`);
    }

    // Success: Reset and Hide
    resetForm();
    showAddForm.value = false;
  } catch (error) {
    aisLogger.error(`Failed to handle AI source: ${error}`);
    await systemDialog.error({
      title: t('pref.pane.aiSources'),
      message: getErrorMessage(error, t('common.unknown')),
    });
  } finally {
    isAdding.value = false;
  }
};

const handleEditSource = (source: AISource) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (isLockedSource(source)) {
    return;
  }

  editingSourceId.value = source.id;
  newSource.name = source.name;
  newSource.baseUrl = source.baseUrl;
  newSource.apiKey = source.apiKey;
  newSource.aiModel = source.aiModel;
  newSource.capabilities = [...source.capabilities];
  showAddForm.value = true;
};

const resetForm = () => {
  newSource.name = '';
  newSource.baseUrl = '';
  newSource.apiKey = '';
  newSource.aiModel = '';
  newSource.capabilities = ['embedding', 'chat', 'reranker'];
  editingSourceId.value = null;
};

const handleCancelAdd = () => {
  resetForm();
  showAddForm.value = false;
};

const handleTestNewSource = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!canTest.value || isTesting.value) return;

  aisLogger.info(`Testing connectivity for new source: ${newSource.baseUrl}`);
  isTesting.value = true;

  try {
    const result = await settingsStore.testConnection({
      aiBaseUrl: newSource.baseUrl,
      aiApiKey: newSource.apiKey,
      aiModel: newSource.aiModel,
      capabilities: [...newSource.capabilities],
    });

    if (result?.success) {
      aisLogger.info('Connection test successful');
      await systemDialog.info({
        title: t('pref.pane.aiSources'),
        message: t('text.testConnectionSuccess'),
      });
    } else {
      const message = result?.message || t('message.failed.testConnectionFailed');
      aisLogger.warn(`Connection test failed: ${message}`);
      await systemDialog.error({
        title: t('pref.pane.aiSources'),
        message,
      });
    }
  } catch (err) {
    const message = getErrorMessage(err, t('message.failed.testConnectionFailed'));
    aisLogger.error('Connection test error');
    await systemDialog.error({
      title: t('pref.pane.aiSources'),
      message,
    });
  } finally {
    isTesting.value = false;
  }
};

const removeSource = async (source: AISource) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (isLockedSource(source)) {
    return;
  }

  const confirmed = await settingsService.confirmDeleteAiSource(source.name);
  if (confirmed) {
    await settingsStore.removeAiSource(source.id);
    aisLogger.info(`AI Source removed: ${source.id}`);
  }
};

const toggleCapability = (capability: string, checked: boolean) => {
  if (checked) {
    if (!newSource.capabilities.includes(capability)) {
      newSource.capabilities.push(capability);
    }
    return;
  }

  newSource.capabilities = newSource.capabilities.filter((item) => item !== capability);
};

const formatCapabilities = (capabilities: string[]): string => {
  const activeCapabilities = capabilities.length === 0
    ? capabilityOptions.map((option) => option.value)
    : capabilities;

  return activeCapabilities
    .map((capability) => {
      const option = capabilityOptions.find((item) => item.value === capability);
      return option ? t(option.labelKey) : capability;
    })
    .join(' / ');
};
</script>

<style scoped>
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0;
  margin-bottom: 1.25rem;
}

.license-gate {
  margin-bottom: 1rem;
}

.add-form-card {
  grid-column: 1 / -1;
  background: var(--bg-secondary, #f8f9fa);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
  gap: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}

.add-source-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: transparent;
  border: 1px dashed #c9d1dc;
  border-radius: 12px;
  cursor: pointer;
  color: #5f6b7a;
  transition: all 0.2s ease;
  min-height: 140px;
}

.add-source-card:hover {
  background: var(--status-info-bg);
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-2px);
}

.add-icon {
  color: inherit;
  opacity: 0.6;
}

.source-form-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.required-mark {
  color: #ef4444;
  font-weight: bold;
  margin-left: 2px;
}

.char-counter {
  float: right;
  font-size: 0.7rem;
  font-weight: normal;
  color: #999;
  margin-top: 2px;
}

.form-actions-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 10px;
}

.buttons {
  display: flex;
  gap: 10px;
}

.source-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.source-title {
  font-weight: 600;
  font-size: 1.05rem;
  margin: 0;
  color: var(--text-primary);
}

.source-card {
  box-sizing: border-box;
  min-height: 156px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.official-source-card {
  position: relative;
  border-color: var(--status-info-border);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-primary, #ffffff));
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 8%, transparent);
}

.source-info {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.source-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.official-source-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 1px solid var(--status-info-border);
  border-radius: 8px;
  color: var(--status-info-text);
  background: var(--status-info-bg);
}

.source-lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 2px 8px;
  border: 1px solid var(--status-info-border);
  border-radius: 999px;
  color: var(--status-info-text);
  background: var(--status-info-bg);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: default;
}

.action-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: var(--accent);
  background: var(--status-info-bg);
}

.action-btn.delete:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.source-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.official-source-details {
  gap: 0;
  padding-top: 2px;
}

.official-source-details .detail-item {
  padding: 7px 0;
  border-top: 1px solid var(--border-color);
}

.official-source-details .detail-item:first-child {
  border-top: 0;
}

.official-source-details .detail-item .label {
  min-width: 72px;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
}

.official-source-details .detail-item .value {
  color: var(--text-primary);
  font-weight: 600;
}

.model-description-item {
  align-items: flex-start;
}

.model-description-item .value {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  line-height: 1.4;
  white-space: normal;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.capability-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.detail-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.8rem;
}

.detail-item .label {
  padding: 1px 6px;
  background: var(--status-info-bg);
  color: var(--accent);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  min-width: 64px;
  display: inline-flex;
  justify-content: center;
  border: 1px solid var(--status-info-border);
}

.detail-item .value {
  color: var(--text-primary);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.empty-trigger-card {
  width: 100%;
}

.empty-icon {
  color: #c9d1dc;
  margin-bottom: 0.5rem;
}

.empty-text {
  margin: 0 0 0.5rem 0;
  color: #5f6b7a;
  font-size: 0.9rem;
  font-weight: 500;
}

.empty-action-text {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
