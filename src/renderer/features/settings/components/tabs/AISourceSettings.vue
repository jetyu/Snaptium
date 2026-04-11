<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';
import { createLogger } from '../../../logger';
import { Plus, Light, Delete, Attention, Edit } from '@icon-park/vue-next';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const aisLogger = createLogger('AISettings');

const showAddForm = ref(false);
const isAdding = ref(false);
const addError = ref<string | null>(null);
const isTesting = ref(false);
const testSuccess = ref(false);
const testError = ref<string | null>(null);
const editingSourceId = ref<string | null>(null);

const isEditMode = computed(() => !!editingSourceId.value);

const newSource = reactive({
  name: '',
  endpoint: '',
  apiKey: '',
  aiModel: '',
});

// Reset test status when any input field changes
watch(() => [newSource.name, newSource.endpoint, newSource.apiKey, newSource.aiModel], () => {
  testSuccess.value = false;
  testError.value = null;
}, { deep: true });

// Basic validation for testing (All 4 marked fields are now mandatory)
const canTest = computed(() => {
  return !!(
    newSource.name.trim() &&
    newSource.endpoint.trim() &&
    newSource.aiModel.trim() &&
    newSource.apiKey.trim()
  );
});

// Validation for adding (Name, Endpoint, Key are mandatory. Model is optional but recommended)
const isFormValid = computed(() => canTest.value);

const handleAddSource = async () => {
  if (!isFormValid.value || isAdding.value) return;

  isAdding.value = true;
  addError.value = null;

  try {
    const payload = {
      name: newSource.name,
      endpoint: newSource.endpoint,
      apiKey: newSource.apiKey,
      aiModel: newSource.aiModel,
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
    addError.value = (error as Error).message;
  } finally {
    isAdding.value = false;
  }
};

const handleEditSource = (source: any) => {
  editingSourceId.value = source.id;
  newSource.name = source.name;
  newSource.endpoint = source.endpoint;
  newSource.apiKey = source.apiKey;
  newSource.aiModel = source.aiModel;
  showAddForm.value = true;
};

const resetForm = () => {
  newSource.name = '';
  newSource.endpoint = '';
  newSource.apiKey = '';
  newSource.aiModel = '';
  editingSourceId.value = null;
  testSuccess.value = false;
  testError.value = null;
  addError.value = null;
};

const handleCancelAdd = () => {
  resetForm();
  showAddForm.value = false;
};

const handleTestNewSource = async () => {
  if (!canTest.value || isTesting.value) return;

  aisLogger.info(`Testing connectivity for new source: ${newSource.endpoint}`);
  isTesting.value = true;
  testSuccess.value = false;
  testError.value = null;

  try {
    const result = await settingsStore.testConnection({
      aiEndpoint: newSource.endpoint,
      aiApiKey: newSource.apiKey,
      aiModel: newSource.aiModel,
    });

    if (result?.success) {
      testSuccess.value = true;
      aisLogger.info('Connection test successful');
    } else {
      testError.value = result?.message || t('message.failed.testConnectionFailed');
      aisLogger.warn(`Connection test failed: ${testError.value}`);
    }
  } catch (err) {
    testError.value = String(err);
    aisLogger.error('Connection test error');
  } finally {
    isTesting.value = false;
  }
};

const removeSource = async (source: any) => {
  const confirmed = await settingsService.confirmDeleteAiSource(source.name);
  if (confirmed) {
    await settingsStore.removeAiSource(source.id);
    aisLogger.info(`AI Source removed: ${source.id}`);
  }
};
</script>

<template>
  <div class="ai-source-settings">
    <div class="header-actions">
      <h3 class="panel-title">{{ t('pref.pane.aiSources') }}</h3>
    </div>


    <div class="source-list">
      <template v-if="!showAddForm">
        <div v-for="source in settingsStore.config.aiSources" :key="source.id"
          class="source-card setting-card vertical-layout">
          <div class="source-info">
            <div class="source-header">
              <h4 class="source-title">{{ source.name }}</h4>
              <div class="card-actions">
                <button class="action-btn" @click="handleEditSource(source)" :title="t('common.editor')">
                  <Edit theme="outline" size="14" />
                </button>
                <button class="action-btn delete" @click="removeSource(source)" :title="t('trash.delete')">
                  <Delete theme="outline" size="14" />
                </button>
              </div>
            </div>
            <div class="source-details">
              <div class="detail-item">
                <span class="label">{{ t('label.aiApiEndpoint') }}</span>
                <span class="value">{{ source.endpoint }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('label.aiModel') }}</span>
                <span class="value">{{ source.aiModel }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('label.aiApiKey') }}</span>
                <span class="value">••••••••••••••••</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Add Source Form (Inside Grid) -->
      <div v-if="showAddForm" class="add-form-card">
        <div class="form-group">
          <label class="setting-label">
            {{ t('label.sourceName') }} <span class="required-mark">{{ t('label.starSign') }}</span>
            <span class="char-counter">{{ newSource.name.length }}/10</span>
          </label>
          <input v-model="newSource.name" type="text" class="settings-input" maxlength="10"
            :placeholder="t('placeholder.sourceName')" />
        </div>

        <div class="form-group">
          <label class="setting-label">{{ t('label.aiApiEndpoint') }} <span class="required-mark">{{ t('label.starSign')
          }}</span></label>
          <input v-model="newSource.endpoint" type="text" class="settings-input"
            :placeholder="t('placeholder.aiAPIEndpoint')" />
        </div>
        <div class="form-group">
          <label class="setting-label">{{ t('label.aiModel') }} <span class="required-mark">{{ t('label.starSign')
          }}</span></label>
          <input v-model="newSource.aiModel" type="text" class="settings-input"
            :placeholder="t('placeholder.aiModel')" />
        </div>
        <div class="form-group">
          <label class="setting-label">{{ t('label.aiApiKey') }} <span class="required-mark">{{ t('label.starSign')
          }}</span></label>
          <input v-model="newSource.apiKey" type="password" class="settings-input"
            :placeholder="t('placeholder.aiAPIKey')" />
        </div>
        <p v-if="addError" class="add-error-text">{{ addError }}</p>
        <div class="form-actions-row">
          <div class="test-status">
            <transition name="fade">
              <span v-if="!isFormValid" class="status-badge hint">
                <span class="icon-wrapper">
                  <Attention theme="outline" :size="16" />
                </span>
                {{ t('text.inputAllFields') }}
              </span>
              <span v-else-if="testSuccess" class="status-badge success">
                {{ t('testConnectionSuccess') }}
              </span>
              <span v-else-if="testError" class="status-badge error" :title="testError">
                {{ testError.length > 50 ? testError.substring(0, 50) + '...' : testError }}
              </span>
              <span v-else-if="isTesting" class="status-badge testing">
                <span class="spinner small"></span> {{ t('button.testing') }}...
              </span>
            </transition>
          </div>

          <div class="buttons">
            <button class="action-button secondary" @click="handleTestNewSource" :disabled="!canTest || isTesting">
              {{ t('button.testConnection') }}
            </button>
            <button class="action-button secondary" @click="handleCancelAdd">
              {{ t('dialog.cancel') }}
            </button>
            <button class="action-button primary" @click="handleAddSource" :disabled="!isFormValid || isAdding">
              <template v-if="isAdding">
                <span class="spinner small"></span>
              </template>
              <template v-else>
                {{ t('dialog.ok') }}
              </template>
            </button>
          </div>
        </div>
      </div>

      <!-- Add Source Card (Placeholder) -->
      <div v-else-if="settingsStore.config.aiSources.length > 0" class="add-source-card" @click="showAddForm = true">
        <div class="add-icon">
          <Plus theme="outline" :size="24" />
        </div>
        <span>{{ t('button.addAISource') }}</span>
      </div>

      <div v-if="settingsStore.config.aiSources.length === 0 && !showAddForm" class="add-source-card empty-trigger-card"
        @click="showAddForm = true">
        <div class="empty-icon">
          <Light theme="outline" :size="48" />
        </div>
        <p class="empty-text">{{ t('text.noAISourcesFound') }}</p>
        <span class="empty-action-text">{{ t('button.addAISource') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-source-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0;
  margin-bottom: 1.25rem;
}

.add-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--primary-color, #4a90e2);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-button.is-cancel {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.add-button:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
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
  background: rgba(74, 144, 226, 0.04);
  border-color: var(--primary-color, #4a90e2);
  color: var(--primary-color);
  transform: translateY(-2px);
}

.add-icon {
  color: inherit;
  opacity: 0.6;
}

.form-group {
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
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.test-status {
  flex: 1;
}

.status-badge {
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-badge .icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-badge :deep(svg) {
  vertical-align: middle;
}

.status-badge.success {
  color: #2ecc71;
}

.status-badge.error {
  color: #e74c3c;
}

.status-badge.testing {
  color: var(--primary-color);
}

.status-badge.hint {
  color: #94a3b8;
  font-size: 0.8rem;
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

.source-info {
  width: 100%;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
  color: var(--primary-color);
  background: rgba(74, 144, 226, 0.1);
}

.action-btn.delete:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.delete-btn-cancel,
.delete-btn-confirm {
  font-size: 0.82rem;
}

.source-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.8rem;
}

.detail-item .label {
  padding: 1px 6px;
  background: #f0f4ff;
  color: #4361ee;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  min-width: 64px;
  display: inline-flex;
  justify-content: center;
  border: 1px solid #e0e7ff;
}

.detail-item .value {
  color: #111827;
  font-weight: 400;
  word-break: break-all;
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
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.add-error-text {
  margin: 0;
  font-size: 0.82rem;
  color: #e74c3c;
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
