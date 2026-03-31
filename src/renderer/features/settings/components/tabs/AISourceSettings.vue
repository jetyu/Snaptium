<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import { createLogger } from '../../../logger';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const aisLogger = createLogger('AISettings');

const showAddForm = ref(false);
const isAdding = ref(false);
const addError = ref<string | null>(null);
const isTesting = ref(false);
const testSuccess = ref(false);
const testError = ref<string | null>(null);
const deleteConfirmId = ref<string | null>(null);

const newSource = reactive({
  name: '',
  endpoint: '',
  apiKey: '',
  defaultModel: '',
});

// Reset test status when any input field changes
watch(() => [newSource.name, newSource.endpoint, newSource.apiKey, newSource.defaultModel], () => {
  testSuccess.value = false;
  testError.value = null;
}, { deep: true });

// Basic validation for testing (All 4 marked fields are now mandatory)
const canTest = computed(() => {
  return !!(
    newSource.name.trim() &&
    newSource.endpoint.trim() &&
    newSource.defaultModel.trim() &&
    newSource.apiKey.trim()
  );
});

// Validation for adding (Name, Endpoint, Key are mandatory. Model is optional but recommended)
const isFormValid = computed(() => canTest.value);

const handleAddSource = async () => {
  if (!isFormValid.value || isAdding.value) return;

  aisLogger.info(`Adding AI source after successful test: ${newSource.name}`);
  isAdding.value = true;
  addError.value = null;

  try {
    const result = await settingsStore.addAiSource({
      name: newSource.name,
      endpoint: newSource.endpoint,
      apiKey: newSource.apiKey,
      defaultModel: newSource.defaultModel,
    });
    aisLogger.info(`AI Source added: ${result.name} (ID: ${result.id})`);

    // Success: Reset and Hide
    newSource.name = '';
    newSource.endpoint = '';
    newSource.apiKey = '';
    newSource.defaultModel = '';
    testSuccess.value = false;
    showAddForm.value = false;
  } catch (error) {
    aisLogger.error(`Failed to add AI source: ${error}`);
    addError.value = (error as Error).message;
  } finally {
    isAdding.value = false;
  }
};

const handleTestNewSource = async () => {
  if (!canTest.value || isTesting.value) return;

  aisLogger.info(`Testing connectivity for new source: ${newSource.endpoint}`);
  isTesting.value = true;
  testSuccess.value = false;
  testError.value = null;

  try {
    // If defaultModel is empty, the backend will use the /models endpoint test
    const result = await settingsStore.testConnection({
      aiEndpoint: newSource.endpoint,
      aiApiKey: newSource.apiKey,
      aiModel: newSource.defaultModel,
    });

    if (result?.success) {
      testSuccess.value = true;
      aisLogger.info('Connection test successful');
    } else {
      testError.value = result?.message || t('testConnectionFailed');
      aisLogger.warn(`Connection test failed: ${testError.value}`);
    }
  } catch (err) {
    testError.value = String(err);
    aisLogger.error('Connection test error');
  } finally {
    isTesting.value = false;
  }
};

const removeSource = async (id: string) => {
  if (deleteConfirmId.value === id) {
    await settingsStore.removeAiSource(id);
    deleteConfirmId.value = null;
  } else {
    deleteConfirmId.value = id;
  }
};

const cancelDelete = () => {
  deleteConfirmId.value = null;
};
</script>

<template>
  <div class="ai-source-settings">
    <div class="header-actions">
      <h3 class="panel-title">{{ t('paneAISources') }}</h3>
    </div>


    <div class="source-list">
      <template v-if="!showAddForm">
        <div v-for="source in settingsStore.config.aiSources" :key="source.id"
          class="source-card setting-card vertical-layout">
          <div class="source-info">
            <div class="source-header">
              <h4 class="source-title">{{ source.name }}</h4>
              <div class="delete-actions">
                <template v-if="deleteConfirmId === source.id">
                  <span class="delete-confirm-text">{{ t('confirmDeleteSource') }}</span>
                  <button class="delete-btn-confirm" @click="removeSource(source.id)">Y</button>
                  <button class="delete-btn-cancel" @click="cancelDelete">N</button>
                </template>
                <button v-else class="delete-btn" @click="removeSource(source.id)" :title="t('trash.delete')">
                  ×
                </button>
              </div>
            </div>
            <div class="source-details">
              <div class="detail-item">
                <span class="label">{{ t('labelAIEndpoint') }}</span>
                <span class="value">{{ source.endpoint }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('labelAIModel') }}</span>
                <span class="value">{{ source.defaultModel }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ t('labelAIApiKey') }}</span>
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
            {{ t('labelSourceName') }} <span class="required-mark">{{ t('labelStar') }}</span>
            <span class="char-counter">{{ newSource.name.length }}/30</span>
          </label>
          <input v-model="newSource.name" type="text" class="settings-input" maxlength="30"
            :placeholder="t('placeholderSourceName')" />
        </div>

        <div class="form-group">
          <label class="setting-label">{{ t('labelAIEndpoint') }} <span class="required-mark">{{ t('labelStar')
          }}</span></label>
          <input v-model="newSource.endpoint" type="text" class="settings-input"
            :placeholder="t('placeholderAIEndpoint')" />
        </div>
        <div class="form-group">
          <label class="setting-label">{{ t('labelAiModel') }} <span class="required-mark">{{ t('labelStar')
          }}</span></label>
          <input v-model="newSource.defaultModel" type="text" class="settings-input"
            :placeholder="t('placeholderAiModel')" />
        </div>
        <div class="form-group">
          <label class="setting-label">{{ t('labelAIApiKey') }} <span class="required-mark">{{ t('labelStar')
          }}</span></label>
          <input v-model="newSource.apiKey" type="password" class="settings-input"
            :placeholder="t('placeholderApiKey')" />
        </div>
        <p v-if="addError" class="add-error-text">{{ addError }}</p>
        <div class="form-actions-row">
          <div class="test-status">
            <transition name="fade">
              <span v-if="!isFormValid" class="status-badge hint">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ t('InputAllFields') }}
              </span>
              <span v-else-if="testSuccess" class="status-badge success">
                {{ t('testConnectionSuccess') }}
              </span>
              <span v-else-if="testError" class="status-badge error" :title="testError">
                {{ testError.length > 50 ? testError.substring(0, 50) + '...' : testError }}
              </span>
              <span v-else-if="isTesting" class="status-badge testing">
                <span class="spinner small"></span> {{ t('btnTesting') }}...
              </span>
            </transition>
          </div>

          <div class="buttons">
            <button class="action-button secondary" @click="handleTestNewSource" :disabled="!canTest || isTesting">
              {{ t('btnTestConnection') }}
            </button>
            <button class="action-button secondary" @click="showAddForm = false">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span>{{ t('btnAddSource') }}</span>
      </div>

      <div v-if="settingsStore.config.aiSources.length === 0 && !showAddForm" class="add-source-card empty-trigger-card"
        @click="showAddForm = true">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p class="empty-text">{{ t('NoAiSourcesFound') }}</p>
        <span class="empty-action-text">{{ t('btnAddSource') }}</span>
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

.delete-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0 5px;
  border-radius: 4px;
}

.delete-btn:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
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

.delete-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.delete-confirm-text {
  font-size: 0.82rem;
  color: #e74c3c;
}

.delete-btn-cancel,
.delete-btn-confirm {
 font-size: 0.82rem;
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
