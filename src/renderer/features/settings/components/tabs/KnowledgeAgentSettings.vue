<template>
  <div class="knowledge-agent-settings">
    <h3 class="panel-title">{{ t('pref.pane.knowledgeAgent') }}</h3>
    <LicenseGateNotice
      v-if="isLicenseLocked"
      class="license-gate"
      title-key="license.gate.knowledgeAgent.title"
      description-key="license.gate.knowledgeAgent.description"
    />

    <div class="settings-grid">
      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeAgentSectionBasic') }}</p>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeAgent') }}</p>
            <p class="setting-description">{{ t('text.knowledgeAgent') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeAgent.enabled }"
            :aria-pressed="settingsStore.config.knowledgeAgent.enabled" :disabled="isLicenseLocked" @click="handleToggle('enabled')">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ settingsStore.config.knowledgeAgent.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </button>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeAgentEmbeddingModel') }}</p>
            <p class="setting-description">{{ t('text.knowledgeAgentEmbeddingModel') }}</p>
          </div>
          <label class="select-shell" :class="{ disabled: isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeAgent.embeddingSourceId"
              @change="handleKnowledgeAgentUpdate('embeddingSourceId', ($event.target as HTMLSelectElement).value, $event)"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled">
              <option v-if="embeddingSources.length === 0" value="">{{
                t('option.default.selectOption') }}</option>
              <option v-for="source in embeddingSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>
            </select>
          </label>
        </section>
      </section>

      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeAgentSectionAnswering') }}</p>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeAgentChatModel') }}</p>
            <p class="setting-description">{{ t('text.knowledgeAgentChatModel') }}</p>
          </div>
          <label class="select-shell"
            :class="{ disabled: isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeAgent.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeAgent.chatSourceId"
              @change="handleKnowledgeAgentUpdate('chatSourceId', ($event.target as HTMLSelectElement).value)"
              :disabled="isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeAgent.enabled">
              <option value="">{{
                t('option.knowledgeAgent.disabled') }}</option>
              <option v-for="source in chatSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>

            </select>
          </label>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeAgentRerankerSource') }}</p>
            <p class="setting-description">{{ t('text.knowledgeAgentRerankerSource') }}</p>
          </div>
          <label class="select-shell"
            :class="{ disabled: isLicenseLocked || rerankerSources.length === 0 || !settingsStore.config.knowledgeAgent.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeAgent.rerankerSourceId"
              @change="handleKnowledgeAgentUpdate('rerankerSourceId', ($event.target as HTMLSelectElement).value)"
              :disabled="isLicenseLocked || rerankerSources.length === 0 || !settingsStore.config.knowledgeAgent.enabled">
              <option value="">{{
                t('option.knowledgeAgent.disabled') }}</option>
              <option v-for="source in rerankerSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>

            </select>
          </label>
        </section>
      </section>

      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeAgentSectionIndex') }}</p>
        <div class="settings-row-grid">
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeAgentAutoIndex') }}</p>
              <p class="setting-description">{{ t('text.knowledgeAgentAutoIndex') }}</p>
            </div>

            <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeAgent.autoIndex }"
              :aria-pressed="settingsStore.config.knowledgeAgent.autoIndex" @click="handleToggle('autoIndex')"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled">
              <span class="startup-switch-track">
                <span class="startup-switch-thumb" />
              </span>
              <span class="startup-switch-text">
                {{ settingsStore.config.knowledgeAgent.autoIndex ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
              </span>
            </button>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeAgentIndexOnSave') }}</p>
              <p class="setting-description">{{ t('text.knowledgeAgentIndexOnSave') }}</p>
            </div>

            <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeAgent.indexOnSave }"
              :aria-pressed="settingsStore.config.knowledgeAgent.indexOnSave" @click="handleToggle('indexOnSave')"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled">
              <span class="startup-switch-track">
                <span class="startup-switch-thumb" />
              </span>
              <span class="startup-switch-text">
                {{ settingsStore.config.knowledgeAgent.indexOnSave ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
              </span>
            </button>
          </section>
        </div>

        <section v-if="settingsStore.config.knowledgeAgent.enabled" class="setting-card index-status-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeAgentIndexStatus') }}</p>
            <p class="setting-description">{{ t('text.knowledgeAgentIndexStatus') }}</p>
          </div>
          <div class="index-status-container">
            <div class="status-info">
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeAgentIndexCurrentState') }}</span>
                <span class="status-value status-pill" :class="{ active: isIndexing }">{{ indexStateText }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeAgentTotalChunks') }}</span>
                <span class="status-value">{{ indexStatus.totalChunks || 0 }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeAgentLastIndexed') }}</span>
                <span class="status-value">{{ lastIndexedText }}</span>
              </div>
            </div>

            <button type="button" class="action-button" :disabled="isLicenseLocked || isIndexing || !isConfigured"
              @click="handleRebuildIndex">
              <span v-if="isIndexing" class="spinner"></span>
              <span>{{ rebuildButtonText }}</span>
            </button>
          </div>
        </section>
      </section>

      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeAgentSectionRetrieval') }}</p>
        <div class="settings-row-grid">
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeAgentTopK') }}</p>
              <p class="setting-description">{{ t('text.knowledgeAgentTopK') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeAgent.topK"
                @change="handleKnowledgeAgentNumberUpdate('topK', $event)" step="1" min="1" max="10"
                :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled" />
            </div>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeAgentSimilarityThreshold') }}</p>
              <p class="setting-description">{{ t('text.knowledgeAgentSimilarityThreshold') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input"
                :value="settingsStore.config.knowledgeAgent.similarityThreshold"
                @change="handleKnowledgeAgentNumberUpdate('similarityThreshold', $event)" step="0.05" min="0" max="1"
                :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled" />
            </div>
          </section>
        </div>

        <details class="index-tuning-details">
          <summary class="index-tuning-summary">
            <IconChevronRight class="summary-chevron" :size="15" aria-hidden="true" />
            <span>{{ t('label.knowledgeAgentIndexTuning') }}</span>
            <span class="summary-hint">{{ t('text.knowledgeAgentIndexTuning') }}</span>
          </summary>

          <div class="settings-row-grid index-tuning-grid">
            <section class="setting-card">
              <div class="setting-copy">
                <p class="setting-label">{{ t('label.knowledgeAgentChunkSize') }}</p>
                <p class="setting-description">{{ t('text.knowledgeAgentChunkSize') }}</p>
              </div>
              <div class="number-input-container">
                <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeAgent.chunkSize"
                  @change="handleKnowledgeAgentNumberUpdate('chunkSize', $event)" step="100" min="500" max="800"
                  :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled" />
              </div>
            </section>

            <section class="setting-card">
              <div class="setting-copy">
                <p class="setting-label">{{ t('label.knowledgeAgentChunkOverlap') }}</p>
                <p class="setting-description">{{ t('text.knowledgeAgentChunkOverlap') }}</p>
              </div>
              <div class="number-input-container">
                <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeAgent.chunkOverlap"
                  @change="handleKnowledgeAgentNumberUpdate('chunkOverlap', $event)" step="10" min="50" max="100"
                  :disabled="isLicenseLocked || !settingsStore.config.knowledgeAgent.enabled" />
              </div>
            </section>
          </div>
        </details>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore, type KnowledgeAgentSettings } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';
import { useKnowledgeAgentIndex, useKnowledgeAgentConfig } from '@renderer/features/knowledge-agent';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { LICENSE_FEATURES } from '@shared/license.constants';
import { knowledgeAgentService } from '@renderer/features/knowledge-agent/services/knowledge-agent.service';
import { LicenseGateNotice, useLicenseGate } from '@renderer/features/license';
import { IconChevronRight } from '@tabler/icons-vue';


const { t } = useI18n();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();
const { indexStatus, isIndexing, rebuildIndex, refreshStatus, clearIndex } = useKnowledgeAgentIndex();
const { isConfigured } = useKnowledgeAgentConfig();
const KnowledgeAgentSettingsLogger = createLogger('KnowledgeAgentSettings');
const knowledgeAgentLicenseGate = useLicenseGate(LICENSE_FEATURES.KNOWLEDGE_AGENT);
const isLicenseLocked = computed(() => !knowledgeAgentLicenseGate.allowed.value);

const sourceSupportsCapability = (capabilities: string[], capability: string): boolean => {
  return capabilities.length === 0 || capabilities.includes(capability);
};

const embeddingSources = computed(() => {
  return settingsStore.config.aiSources.filter((source) => sourceSupportsCapability(source.capabilities, 'embedding'));
});

const chatSources = computed(() => {
  return settingsStore.config.aiSources.filter((source) => sourceSupportsCapability(source.capabilities, 'chat'));
});

const rerankerSources = computed(() => {
  return settingsStore.config.aiSources.filter((source) => sourceSupportsCapability(source.capabilities, 'reranker'));
});

const requestLicenseAccessIfNeeded = (): boolean => {
  if (!isLicenseLocked.value) {
    return false;
  }

  knowledgeAgentLicenseGate.requestAccess();
  return true;
};

onMounted(() => {
  if (!isLicenseLocked.value && settingsStore.config.knowledgeAgent.enabled) {
    refreshStatus();
  }
});

const handleToggle = async (key: keyof KnowledgeAgentSettings) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  await settingsStore.updateKnowledgeAgentSetting(key, !settingsStore.config.knowledgeAgent[key]);
};

const revertSelectValue = (key: keyof KnowledgeAgentSettings, event?: Event) => {
  if (event?.target) {
    (event.target as HTMLSelectElement).value = String(settingsStore.config.knowledgeAgent[key] ?? '');
  }
};

const getNotesForIndexing = () => workspaceStore.notes.map((node) => ({
  id: node.id,
  title: node.title,
  content: node.content,
}));

const handleKnowledgeAgentUpdate = async <K extends keyof KnowledgeAgentSettings>(key: K, value: KnowledgeAgentSettings[K], event?: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    revertSelectValue(key, event);
    return;
  }

  if (key === 'embeddingSourceId') {
    if (value === settingsStore.config.knowledgeAgent[key]) return;

    const confirmed = await settingsService.confirmEmbeddingSourceChange(
      settingsStore.config.knowledgeAgent.embeddingSourceId,
      String(value)
    );
    if (!confirmed) {
      revertSelectValue(key, event);
      return;
    }

    await settingsStore.updateKnowledgeAgentSetting(key, value);

    try {
      await knowledgeAgentService.initialize();

      const notes = getNotesForIndexing();
      if (notes.length === 0) {
        await clearIndex();
      } else {
        await rebuildIndex(notes, 'manual', true);
      }

      await refreshStatus();
    } catch (e) {
      KnowledgeAgentSettingsLogger.error(`Failed to handle clear index after model change: ${getErrorMessage(e)}`);
      revertSelectValue(key, event);
    }
    return;
  }

  await settingsStore.updateKnowledgeAgentSetting(key, value);
};

const handleKnowledgeAgentNumberUpdate = async (key: keyof KnowledgeAgentSettings, event: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const previousValue = settingsStore.config.knowledgeAgent[key];
  const target = event.target as HTMLInputElement;
  const value = key === 'similarityThreshold' ? parseFloat(target.value) : parseInt(target.value);
  await settingsStore.updateKnowledgeAgentSetting(key, value || 0);

  if ((key !== 'chunkSize' && key !== 'chunkOverlap') || previousValue === settingsStore.config.knowledgeAgent[key]) {
    return;
  }

  try {
    const shouldRebuild = await settingsService.confirmKnowledgeAgentChunkRebuild();
    if (!shouldRebuild) {
      return;
    }

    const notes = getNotesForIndexing();
    if (notes.length === 0) {
      await clearIndex();
    } else {
      await rebuildIndex(notes, 'manual', true);
    }
    await refreshStatus();
  } catch (error) {
    KnowledgeAgentSettingsLogger.error(`Failed to rebuild index after chunk setting change: ${getErrorMessage(error)}`);
  }
};

const handleRebuildIndex = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!isConfigured.value) {
    KnowledgeAgentSettingsLogger.error(t('message.error.knowledgeAgentNotConfigured'));
    return;
  }

  try {
    const rebuildMode = await settingsService.confirmKnowledgeAgentRebuildMode();
    if (rebuildMode === 'cancel') {
      return;
    }

    const notes = getNotesForIndexing();

    if (notes.length === 0) {
      KnowledgeAgentSettingsLogger.error(t('message.error.indexNotesNotFound'));
      return;
    }

    await rebuildIndex(notes, 'manual', rebuildMode === 'full');
    await refreshStatus();
  } catch (error) {
    KnowledgeAgentSettingsLogger.error(`Failed to rebuild index: ${getErrorMessage(error)}`);
  }
};

const rebuildButtonText = computed(() => {
  if (!isIndexing.value) {
    return t('button.rebuildIndex');
  }

  return `${indexStatus.value.progress} %`;
});

const indexStateText = computed(() => {
  if (isIndexing.value) {
    return t('label.knowledgeAgentIndexStateIndexing');
  }

  if (!isConfigured.value) {
    return t('label.knowledgeAgentIndexStateNeedsConfig');
  }

  if (!settingsStore.config.knowledgeAgent.lastIndexedAt || Number(indexStatus.value.totalChunks || 0) === 0) {
    return t('label.knowledgeAgentIndexStateEmpty');
  }

  return t('label.knowledgeAgentIndexStateIdle');
});

const lastIndexedText = computed(() => {
  const timestamp = settingsStore.config.knowledgeAgent.lastIndexedAt;
  return timestamp ? formatDate(timestamp) : t('label.knowledgeAgentNeverIndexed');
});

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};


</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.index-status-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.status-info {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: 13px;
  gap: 5px;
  min-width: 0;
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

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.status-pill.active {
  color: var(--accent-color);
}

.license-gate {
  margin-bottom: 1rem;
}

.index-tuning-details {
  margin-top: 12px;
}

.index-tuning-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  list-style: none;
  user-select: none;
}

.index-tuning-summary::-webkit-details-marker {
  display: none;
}

.summary-chevron {
  color: var(--text-muted);
  flex: 0 0 auto;
  transition: transform 0.16s ease;
}

.index-tuning-details[open] .summary-chevron {
  transform: rotate(90deg);
}

.summary-hint {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
}

.index-tuning-grid {
  margin-top: 10px;
}

@media (max-width: 760px) {
  .index-status-container {
    align-items: stretch;
    flex-direction: column;
  }

  .status-info {
    grid-template-columns: 1fr;
  }
}
</style>


