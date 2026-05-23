<template>
  <div class="rag-settings">
    <h3 class="panel-title">{{ t('pref.pane.aiRAG') }}</h3>
    <LicenseGateNotice
      v-if="isLicenseLocked"
      class="license-gate"
      title-key="license.gate.rag.title"
      description-key="license.gate.rag.description"
    />

    <div class="settings-grid">
      <!-- Enable RAG -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiRAG') }}</p>
          <p class="setting-description">{{ t('text.aiRAG') }}</p>
        </div>

        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.enabled }"
          :aria-pressed="settingsStore.config.rag.enabled" :disabled="isLicenseLocked" @click="handleToggle('enabled')">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.rag.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>
      <!-- Embedding Source Selection -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.ragEmbeddingModel') }}</p>
          <p class="setting-description">{{ t('text.ragEmbeddingModel') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: isLicenseLocked || !settingsStore.config.rag.enabled }">
          <select class="settings-select" :value="settingsStore.config.rag.embeddingSourceId"
            @change="handleRAGUpdate('embeddingSourceId', ($event.target as HTMLSelectElement).value, $event)"
            :disabled="isLicenseLocked || !settingsStore.config.rag.enabled">
            <option v-if="settingsStore.config.aiSources.length === 0" value="">{{
              t('option.default.selectOption') }}</option>
            <option v-for="source in settingsStore.config.aiSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </label>
      </section>

      <!-- Chat Model Selection -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.ragChatModel') }}</p>
          <p class="setting-description">{{ t('text.ragChatModel') }}</p>
        </div>
        <label class="select-shell"
          :class="{ disabled: isLicenseLocked || settingsStore.config.aiSources.length === 0 || !settingsStore.config.rag.enabled }">
          <select class="settings-select" :value="settingsStore.config.rag.ragChatSourceId"
            @change="handleRAGUpdate('ragChatSourceId', ($event.target as HTMLSelectElement).value)"
            :disabled="isLicenseLocked || settingsStore.config.aiSources.length === 0 || !settingsStore.config.rag.enabled">
            <option value="">{{
              t('option.rag.disabled') }}</option>
            <option v-for="source in settingsStore.config.aiSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>

          </select>
        </label>
      </section>

      <div class="settings-row-grid">
        <!-- Auto Index -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.ragAutoIndex') }}</p>
            <p class="setting-description">{{ t('text.ragAutoIndex') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.autoIndex }"
            :aria-pressed="settingsStore.config.rag.autoIndex" @click="handleToggle('autoIndex')"
            :disabled="isLicenseLocked || !settingsStore.config.rag.enabled">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ settingsStore.config.rag.autoIndex ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </button>
        </section>

        <!-- Index On Save -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.ragIndexOnSave') }}</p>
            <p class="setting-description">{{ t('text.ragIndexOnSave') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.indexOnSave }"
            :aria-pressed="settingsStore.config.rag.indexOnSave" @click="handleToggle('indexOnSave')"
            :disabled="isLicenseLocked || !settingsStore.config.rag.enabled">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ settingsStore.config.rag.indexOnSave ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </button>
        </section>
      </div>

      <!-- Index Status and Actions -->
      <section v-if="settingsStore.config.rag.enabled" class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.ragIndexStatus') }}</p>
          <p class="setting-description">{{ t('text.ragIndexStatus') }}</p>
        </div>
        <div class="index-status-container">
          <div class="status-info">
            <div class="status-item">
              <span class="status-label">{{ t('label.ragTotalChunks') }}:</span>
              <span class="status-value">{{ indexStatus.totalChunks || 0 }}</span>
            </div>
            <div v-if="settingsStore.config.rag.lastIndexedAt" class="status-item">
              <span class="status-label">{{ t('label.ragLastIndexed') }}:</span>
              <span class="status-value">{{ formatDate(settingsStore.config.rag.lastIndexedAt) }}</span>
            </div>
          </div>

          <button type="button" class="action-button" :disabled="isLicenseLocked || isIndexing || !isConfigured"
            @click="handleRebuildIndex">
            <span v-if="isIndexing" class="spinner"></span>
            <span>{{ rebuildButtonText }}</span>
          </button>
        </div>
      </section>

      <section class="subtitle-settings-section">
        <p class="subtitle-settings-label">{{ t('label.advanced') }}</p>
        <div class="settings-row-grid">
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.ragChunkSize') }}</p>
              <p class="setting-description">{{ t('text.ragChunkSize') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.chunkSize"
                @input="handleRAGNumberUpdate('chunkSize', $event)" step="100" min="500" max="800"
                :disabled="isLicenseLocked || !settingsStore.config.rag.enabled" />
            </div>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.ragChunkOverlap') }}</p>
              <p class="setting-description">{{ t('text.ragChunkOverlap') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.chunkOverlap"
                @input="handleRAGNumberUpdate('chunkOverlap', $event)" step="10" min="50" max="100"
                :disabled="isLicenseLocked || !settingsStore.config.rag.enabled" />
            </div>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.ragTopK') }}</p>
              <p class="setting-description">{{ t('text.ragTopK') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.topK"
                @input="handleRAGNumberUpdate('topK', $event)" step="1" min="1" max="10"
                :disabled="isLicenseLocked || !settingsStore.config.rag.enabled" />
            </div>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.ragSimilarityThreshold') }}</p>
              <p class="setting-description">{{ t('text.ragSimilarityThreshold') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input"
                :value="settingsStore.config.rag.similarityThreshold"
                @input="handleRAGNumberUpdate('similarityThreshold', $event)" step="0.05" min="0" max="1"
                :disabled="isLicenseLocked || !settingsStore.config.rag.enabled" />
            </div>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore, type RAGSettings } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';
import { useRAGIndex, useRAGConfig } from '@renderer/features/rag';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { ragService } from '@renderer/features/rag/services/rag.service';
import { LicenseGateNotice, useLicenseGate } from '@renderer/features/license';


const { t } = useI18n();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();
const { indexStatus, isIndexing, rebuildIndex, refreshStatus, clearIndex } = useRAGIndex();
const { isConfigured } = useRAGConfig();
const ragSettingsLogger = createLogger('RAGSettings');
const ragLicenseGate = useLicenseGate('rag');
const isLicenseLocked = computed(() => !ragLicenseGate.allowed.value);

const requestLicenseAccessIfNeeded = (): boolean => {
  if (!isLicenseLocked.value) {
    return false;
  }

  ragLicenseGate.requestAccess();
  return true;
};

onMounted(() => {
  if (!isLicenseLocked.value && settingsStore.config.rag.enabled) {
    refreshStatus();
  }
});

const handleToggle = async (key: keyof RAGSettings) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  await settingsStore.updateRAGSetting(key, !settingsStore.config.rag[key]);
};

const revertSelectValue = (key: keyof RAGSettings, event?: Event) => {
  if (event?.target) {
    (event.target as HTMLSelectElement).value = String(settingsStore.config.rag[key] ?? '');
  }
};

const getNotesForIndexing = () => workspaceStore.notes.map((node) => ({
  id: node.id,
  title: node.title,
  content: node.content,
}));

const handleRAGUpdate = async <K extends keyof RAGSettings>(key: K, value: RAGSettings[K], event?: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    revertSelectValue(key, event);
    return;
  }

  if (key === 'embeddingSourceId') {
    if (value === settingsStore.config.rag[key]) return;

    const confirmed = await settingsService.confirmEmbeddingSourceChange(
      settingsStore.config.rag.embeddingSourceId,
      String(value)
    );
    if (!confirmed) {
      revertSelectValue(key, event);
      return;
    }

    await settingsStore.updateRAGSetting(key, value);

    try {
      await ragService.initialize();

      const notes = getNotesForIndexing();
      if (notes.length === 0) {
        await clearIndex();
      } else {
        await rebuildIndex(notes, 'manual', true);
      }

      await refreshStatus();
    } catch (e) {
      ragSettingsLogger.error(`Failed to handle clear index after model change: ${getErrorMessage(e)}`);
      revertSelectValue(key, event);
    }
    return;
  }

  await settingsStore.updateRAGSetting(key, value);
};

const handleRAGNumberUpdate = async (key: keyof RAGSettings, event: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const target = event.target as HTMLInputElement;
  const value = key === 'similarityThreshold' ? parseFloat(target.value) : parseInt(target.value);
  await settingsStore.updateRAGSetting(key, value || 0);
};

const handleRebuildIndex = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!isConfigured.value) {
    ragSettingsLogger.error(t('message.error.ragNotConfigured'));
    return;
  }

  try {
    const rebuildMode = await settingsService.confirmRagRebuildMode();
    if (rebuildMode === 'cancel') {
      return;
    }

    const notes = getNotesForIndexing();

    if (notes.length === 0) {
      ragSettingsLogger.error(t('message.error.indexNotesNotFound'));
      return;
    }

    await rebuildIndex(notes, 'manual', rebuildMode === 'full');
    await refreshStatus();
  } catch (error) {
    ragSettingsLogger.error(`Failed to rebuild index: ${getErrorMessage(error)}`);
  }
};

const rebuildButtonText = computed(() => {
  if (!isIndexing.value) {
    return t('button.rebuildIndex');
  }

  return `${indexStatus.value.progress} %`;
});

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};


</script>

<style scoped>
.index-status-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  gap: 12px;
}

.status-label {
  color: var(--text-muted);
  font-weight: 400;
  white-space: nowrap;
}

.status-value {
  color: var(--text);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

.license-gate {
  margin-bottom: 1rem;
}
</style>
