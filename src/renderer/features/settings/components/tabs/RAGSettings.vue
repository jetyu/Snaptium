<template>
  <div class="rag-settings">
    <h3 class="panel-title">{{ t('pref.pane.aiRAG') }}</h3>

    <div class="settings-grid">
      <!-- Enable RAG -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiRAG') }}</p>
          <p class="setting-description">{{ t('text.aiRAG') }}</p>
        </div>

        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.enabled }"
          :aria-pressed="settingsStore.config.rag.enabled" @click="handleToggle('enabled')">
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
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.rag.embeddingSourceId"
            @change="handleRAGUpdate('embeddingSourceId', ($event.target as HTMLSelectElement).value, $event)"
            :disabled="!settingsStore.config.rag.enabled">
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
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.rag.ragChatSourceId"
            @change="handleRAGUpdate('ragChatSourceId', ($event.target as HTMLSelectElement).value)"
            :disabled="settingsStore.config.aiSources.length === 0 || !settingsStore.config.rag.enabled">
            <option value="">{{
              t('option.rag.disabled') }}</option>
            <option v-for="source in settingsStore.config.aiSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>

          </select>
        </label>
      </section>

      <div class="settings-row-grid">
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('labelRAGChunkSize') }}</p>
            <p class="setting-description">{{ t('textRAGChunkSize') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.chunkSize"
              @input="handleRAGNumberUpdate('chunkSize', $event)" step="100" min="500" max="800"
              :disabled="!settingsStore.config.rag.enabled" />
          </div>
        </section>

        <!-- Chunk Overlap -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('labelRAGChunkOverlap') }}</p>
            <p class="setting-description">{{ t('textRAGChunkOverlap') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.chunkOverlap"
              @input="handleRAGNumberUpdate('chunkOverlap', $event)" step="10" min="50" max="100"
              :disabled="!settingsStore.config.rag.enabled" />
          </div>
        </section>
      </div>

      <div class="settings-row-grid">
        <!-- Top K Results -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('labelRAGTopK') }}</p>
            <p class="setting-description">{{ t('textRAGTopK') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input" :value="settingsStore.config.rag.topK"
              @input="handleRAGNumberUpdate('topK', $event)" step="1" min="1" max="10"
              :disabled="!settingsStore.config.rag.enabled" />
          </div>
        </section>

        <!-- Similarity Threshold -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('labelRAGSimilarityThreshold') }}</p>
            <p class="setting-description">{{ t('textRAGSimilarityThreshold') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input"
              :value="settingsStore.config.rag.similarityThreshold"
              @input="handleRAGNumberUpdate('similarityThreshold', $event)" step="0.05" min="0" max="1"
              :disabled="!settingsStore.config.rag.enabled" />
          </div>
        </section>
      </div>
      <div class="settings-row-grid">
        <!-- Auto Index -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('labelRAGAutoIndex') }}</p>
            <p class="setting-description">{{ t('textRAGAutoIndex') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.autoIndex }"
            :aria-pressed="settingsStore.config.rag.autoIndex" @click="handleToggle('autoIndex')"
            :disabled="!settingsStore.config.rag.enabled">
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
            <p class="setting-label">{{ t('labelRAGIndexOnSave') }}</p>
            <p class="setting-description">{{ t('textRAGIndexOnSave') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.rag.indexOnSave }"
            :aria-pressed="settingsStore.config.rag.indexOnSave" @click="handleToggle('indexOnSave')"
            :disabled="!settingsStore.config.rag.enabled">
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
          <p class="setting-label">{{ t('labelRAGIndexStatus') }}</p>
          <p class="setting-description">{{ t('textRAGIndexStatus') }}</p>
        </div>
        <div class="index-status-container">
          <div class="status-info">
            <div class="status-item">
              <span class="status-label">{{ t('labelRAGTotalChunks') }}:</span>
              <span class="status-value">{{ indexStatus.totalChunks || 0 }}</span>
            </div>
            <div v-if="settingsStore.config.rag.lastIndexedAt" class="status-item">
              <span class="status-label">{{ t('labelRAGLastIndexed') }}:</span>
              <span class="status-value">{{ formatDate(settingsStore.config.rag.lastIndexedAt) }}</span>
            </div>
          </div>

          <button type="button" class="action-button" :disabled="isIndexing || !isConfigured"
            @click="handleRebuildIndex">
            <span v-if="isIndexing" class="spinner"></span>
            <span>{{ rebuildButtonText }}</span>
          </button>
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
import { ragService } from '@renderer/features/rag/services/rag.service';


const { t } = useI18n();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();
const { indexStatus, isIndexing, rebuildIndex, refreshStatus, clearIndex } = useRAGIndex();
const { isConfigured } = useRAGConfig();
const ragSettingsLogger = createLogger('RAGSettings');

onMounted(() => {
  if (settingsStore.config.rag.enabled) {
    refreshStatus();
  }
});

const handleToggle = async (key: keyof RAGSettings) => {
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

const handleRAGUpdate = async (key: keyof RAGSettings, value: any, event?: Event) => {
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
        await rebuildIndex(notes);
      }

      await refreshStatus();
    } catch (e) {
      ragSettingsLogger.error(`Failed to handle clear index after model change: ${e}`);
      revertSelectValue(key, event);
    }
    return;
  }

  await settingsStore.updateRAGSetting(key, value);
};

const handleRAGNumberUpdate = async (key: keyof RAGSettings, event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = key === 'similarityThreshold' ? parseFloat(target.value) : parseInt(target.value);
  await settingsStore.updateRAGSetting(key, value || 0);
};

const handleRebuildIndex = async () => {
  if (!isConfigured.value) {
    ragSettingsLogger.error(t('message.error.ragNotConfigured'));
    return;
  }

  try {
    const notes = getNotesForIndexing();

    if (notes.length === 0) {
      ragSettingsLogger.error(t('message.error.indexNotesNotFound'));
      return;
    }

    await rebuildIndex(notes);
    await refreshStatus();
  } catch (error) {
    ragSettingsLogger.error(`Failed to rebuild index: ${error instanceof Error ? error.message : String(error)}`);
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
.rag-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.settings-row-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.settings-row-grid :deep(.number-input-container) {
  width: 100px;
}

.setting-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--accent);
  font-style: italic;
}

.model-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.model-input-group .text-input {
  flex: 1;
}

.btn-test-embedding {
  flex-shrink: 0;
  padding: 8px 16px;
  background: var(--panel-hover);
  color: var(--text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  height: 36px;
}

.btn-test-embedding:hover:not(:disabled) {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-test-embedding:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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

.model-type-hint {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.model-type-hint .hint-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.model-type-hint .hint-text {
  flex: 1;
}

.model-type-hint.error {
  background: color-mix(in srgb, #ef4444 15%, transparent);
  color: #ef4444;
  border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
}

.model-type-hint.warning {
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #f59e0b;
  border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
}

.model-type-hint.success {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
  border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
}

.source-info {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 6px;
}

.info-row:last-of-type {
  margin-bottom: 0;
}

.info-label {
  color: var(--text-muted);
  font-weight: 500;
  min-width: 50px;
}

.info-value {
  color: var(--text);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
