<template>
  <div class="knowledge-copilot-settings">
    <h3 class="panel-title">{{ t('pref.pane.knowledgeCopilot') }}</h3>
    <LicenseGateNotice
      v-if="isLicenseLocked"
      class="license-gate"
      title-key="license.gate.knowledgeCopilot.title"
      description-key="license.gate.knowledgeCopilot.description"
    />

    <div class="settings-grid">
      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeCopilotSectionBasic') }}</p>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilot') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilot') }}</p>
          </div>

          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeCopilot.enabled }"
            :aria-pressed="settingsStore.config.knowledgeCopilot.enabled" :disabled="isLicenseLocked" @click="handleToggle('enabled')">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ settingsStore.config.knowledgeCopilot.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </button>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilotEmbeddingModel') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilotEmbeddingModel') }}</p>
          </div>
          <label class="select-shell" :class="{ disabled: isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeCopilot.embeddingSourceId"
              @change="handleKnowledgeCopilotUpdate('embeddingSourceId', ($event.target as HTMLSelectElement).value, $event)"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled">
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
        <p class="subtitle-settings-label">{{ t('label.knowledgeCopilotSectionAnswering') }}</p>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilotChatModel') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilotChatModel') }}</p>
          </div>
          <label class="select-shell"
            :class="{ disabled: isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeCopilot.askChatSourceId"
              @change="handleKnowledgeCopilotUpdate('askChatSourceId', ($event.target as HTMLSelectElement).value)"
              :disabled="isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled">
              <option value="">{{
                t('option.knowledgeCopilot.disabled') }}</option>
              <option v-for="source in chatSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>

            </select>
          </label>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilotAgentChatModel') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilotAgentChatModel') }}</p>
          </div>
          <label class="select-shell" :class="{ disabled: isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled }">
              <select class="settings-select" :value="settingsStore.config.knowledgeCopilot.agentChatSourceId"
                @change="handleKnowledgeCopilotUpdate('agentChatSourceId', ($event.target as HTMLSelectElement).value)"
                :disabled="isLicenseLocked || chatSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled">
                <option value="">{{ t('option.knowledgeCopilot.disabled') }}</option>
                <option v-for="source in chatSources" :key="source.id" :value="source.id">{{ source.name }}</option>
              </select>
          </label>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilotRerankerSource') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilotRerankerSource') }}</p>
          </div>
          <label class="select-shell"
            :class="{ disabled: isLicenseLocked || rerankerSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled }">
            <select class="settings-select" :value="settingsStore.config.knowledgeCopilot.rerankerSourceId"
              @change="handleKnowledgeCopilotUpdate('rerankerSourceId', ($event.target as HTMLSelectElement).value)"
              :disabled="isLicenseLocked || rerankerSources.length === 0 || !settingsStore.config.knowledgeCopilot.enabled">
              <option value="">{{
                t('option.knowledgeCopilot.disabled') }}</option>
              <option v-for="source in rerankerSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>

            </select>
          </label>
        </section>
      </section>

      <section class="subtitle-settings-section settings-section">
        <p class="subtitle-settings-label">{{ t('label.knowledgeCopilotSectionIndex') }}</p>
        <div class="settings-row-grid">
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeCopilotAutoIndex') }}</p>
              <p class="setting-description">{{ t('text.knowledgeCopilotAutoIndex') }}</p>
            </div>

            <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeCopilot.autoIndex }"
              :aria-pressed="settingsStore.config.knowledgeCopilot.autoIndex" @click="handleToggle('autoIndex')"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled">
              <span class="startup-switch-track">
                <span class="startup-switch-thumb" />
              </span>
              <span class="startup-switch-text">
                {{ settingsStore.config.knowledgeCopilot.autoIndex ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
              </span>
            </button>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeCopilotIndexOnSave') }}</p>
              <p class="setting-description">{{ t('text.knowledgeCopilotIndexOnSave') }}</p>
            </div>

            <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.knowledgeCopilot.indexOnSave }"
              :aria-pressed="settingsStore.config.knowledgeCopilot.indexOnSave" @click="handleToggle('indexOnSave')"
              :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled">
              <span class="startup-switch-track">
                <span class="startup-switch-thumb" />
              </span>
              <span class="startup-switch-text">
                {{ settingsStore.config.knowledgeCopilot.indexOnSave ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
              </span>
            </button>
          </section>
        </div>

        <section v-if="settingsStore.config.knowledgeCopilot.enabled" class="setting-card index-status-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.knowledgeCopilotIndexStatus') }}</p>
            <p class="setting-description">{{ t('text.knowledgeCopilotIndexStatus') }}</p>
          </div>
          <div class="index-status-container">
            <div class="status-info">
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeCopilotIndexCurrentState') }}</span>
                <span class="status-value status-pill" :class="{ active: isIndexing }">{{ indexStateText }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeCopilotTotalChunks') }}</span>
                <span class="status-value">{{ indexStatus.totalChunks || 0 }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">{{ t('label.knowledgeCopilotLastIndexed') }}</span>
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
        <p class="subtitle-settings-label">{{ t('label.knowledgeCopilotSectionRetrieval') }}</p>
        <div class="settings-row-grid">
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeCopilotTopK') }}</p>
              <p class="setting-description">{{ t('text.knowledgeCopilotTopK') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeCopilot.topK"
                @change="handleKnowledgeCopilotNumberUpdate('topK', $event)" step="1" min="1" max="10"
                :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled" />
            </div>
          </section>

          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('label.knowledgeCopilotSimilarityThreshold') }}</p>
              <p class="setting-description">{{ t('text.knowledgeCopilotSimilarityThreshold') }}</p>
            </div>
            <div class="number-input-container">
              <input type="number" class="settings-input number-input"
                :value="settingsStore.config.knowledgeCopilot.similarityThreshold"
                @change="handleKnowledgeCopilotNumberUpdate('similarityThreshold', $event)" step="0.05" min="0" max="1"
                :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled" />
            </div>
          </section>
        </div>

        <details class="index-tuning-details">
          <summary class="index-tuning-summary">
            <IconChevronRight class="summary-chevron" :size="15" aria-hidden="true" />
            <span>{{ t('label.knowledgeCopilotIndexTuning') }}</span>
            <span class="summary-hint">{{ t('text.knowledgeCopilotIndexTuning') }}</span>
          </summary>

          <div class="settings-row-grid index-tuning-grid">
            <section class="setting-card">
              <div class="setting-copy">
                <p class="setting-label">{{ t('label.knowledgeCopilotChunkSize') }}</p>
                <p class="setting-description">{{ t('text.knowledgeCopilotChunkSize') }}</p>
              </div>
              <div class="number-input-container">
                <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeCopilot.chunkSize"
                  @change="handleKnowledgeCopilotNumberUpdate('chunkSize', $event)" step="100" min="500" max="800"
                  :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled" />
              </div>
            </section>

            <section class="setting-card">
              <div class="setting-copy">
                <p class="setting-label">{{ t('label.knowledgeCopilotChunkOverlap') }}</p>
                <p class="setting-description">{{ t('text.knowledgeCopilotChunkOverlap') }}</p>
              </div>
              <div class="number-input-container">
                <input type="number" class="settings-input number-input" :value="settingsStore.config.knowledgeCopilot.chunkOverlap"
                  @change="handleKnowledgeCopilotNumberUpdate('chunkOverlap', $event)" step="10" min="50" max="100"
                  :disabled="isLicenseLocked || !settingsStore.config.knowledgeCopilot.enabled" />
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
import { useSettingsStore, type KnowledgeCopilotSettings } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';
import { useKnowledgeCopilotIndex, useKnowledgeCopilotConfig } from '@renderer/features/knowledge-copilot';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { LICENSE_FEATURES } from '@shared/license.constants';
import { knowledgeCopilotService } from '@renderer/features/knowledge-copilot/services/knowledge-copilot.service';
import { LicenseGateNotice, useLicenseGate } from '@renderer/features/license';
import { IconChevronRight } from '@tabler/icons-vue';


const { t } = useI18n();
const settingsStore = useSettingsStore();
const workspaceStore = useWorkspaceStore();
const { indexStatus, isIndexing, rebuildIndex, refreshStatus, clearIndex } = useKnowledgeCopilotIndex();
const { isConfigured } = useKnowledgeCopilotConfig();
const KnowledgeCopilotSettingsLogger = createLogger('KnowledgeCopilotSettings');
const knowledgeCopilotLicenseGate = useLicenseGate(LICENSE_FEATURES.KNOWLEDGE_COPILOT);
const isLicenseLocked = computed(() => !knowledgeCopilotLicenseGate.allowed.value);

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

  knowledgeCopilotLicenseGate.requestAccess();
  return true;
};

onMounted(() => {
  if (!isLicenseLocked.value && settingsStore.config.knowledgeCopilot.enabled) {
    refreshStatus();
  }
});

const handleToggle = async (key: keyof KnowledgeCopilotSettings) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  await settingsStore.updateKnowledgeCopilotSetting(key, !settingsStore.config.knowledgeCopilot[key]);
};

const revertSelectValue = (key: keyof KnowledgeCopilotSettings, event?: Event) => {
  if (event?.target) {
    (event.target as HTMLSelectElement).value = String(settingsStore.config.knowledgeCopilot[key] ?? '');
  }
};

const getNotesForIndexing = () => workspaceStore.notes.map((node) => ({
  id: node.id,
  title: node.title,
  content: node.content,
}));

const handleKnowledgeCopilotUpdate = async <K extends keyof KnowledgeCopilotSettings>(key: K, value: KnowledgeCopilotSettings[K], event?: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    revertSelectValue(key, event);
    return;
  }

  if (key === 'embeddingSourceId') {
    if (value === settingsStore.config.knowledgeCopilot[key]) return;

    const confirmed = await settingsService.confirmEmbeddingSourceChange(
      settingsStore.config.knowledgeCopilot.embeddingSourceId,
      String(value)
    );
    if (!confirmed) {
      revertSelectValue(key, event);
      return;
    }

    await settingsStore.updateKnowledgeCopilotSetting(key, value);

    try {
      await knowledgeCopilotService.initialize();

      const notes = getNotesForIndexing();
      if (notes.length === 0) {
        await clearIndex();
      } else {
        await rebuildIndex(notes, 'manual', true);
      }

      await refreshStatus();
    } catch (e) {
      KnowledgeCopilotSettingsLogger.error(`Failed to handle clear index after model change: ${getErrorMessage(e)}`);
      revertSelectValue(key, event);
    }
    return;
  }

  await settingsStore.updateKnowledgeCopilotSetting(key, value);
};

const handleKnowledgeCopilotNumberUpdate = async (key: keyof KnowledgeCopilotSettings, event: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const previousValue = settingsStore.config.knowledgeCopilot[key];
  const target = event.target as HTMLInputElement;
  const value = key === 'similarityThreshold' ? parseFloat(target.value) : parseInt(target.value);
  await settingsStore.updateKnowledgeCopilotSetting(key, value || 0);

  if ((key !== 'chunkSize' && key !== 'chunkOverlap') || previousValue === settingsStore.config.knowledgeCopilot[key]) {
    return;
  }

  try {
    const shouldRebuild = await settingsService.confirmKnowledgeCopilotChunkRebuild();
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
    KnowledgeCopilotSettingsLogger.error(`Failed to rebuild index after chunk setting change: ${getErrorMessage(error)}`);
  }
};

const handleRebuildIndex = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!isConfigured.value) {
    KnowledgeCopilotSettingsLogger.error(t('message.error.knowledgeCopilotNotConfigured'));
    return;
  }

  try {
    const rebuildMode = await settingsService.confirmKnowledgeCopilotRebuildMode();
    if (rebuildMode === 'cancel') {
      return;
    }

    const notes = getNotesForIndexing();

    if (notes.length === 0) {
      KnowledgeCopilotSettingsLogger.error(t('message.error.indexNotesNotFound'));
      return;
    }

    await rebuildIndex(notes, 'manual', rebuildMode === 'full');
    await refreshStatus();
  } catch (error) {
    KnowledgeCopilotSettingsLogger.error(`Failed to rebuild index: ${getErrorMessage(error)}`);
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
    return t('label.knowledgeCopilotIndexStateIndexing');
  }

  if (!isConfigured.value) {
    return t('label.knowledgeCopilotIndexStateNeedsConfig');
  }

  if (!settingsStore.config.knowledgeCopilot.lastIndexedAt || Number(indexStatus.value.totalChunks || 0) === 0) {
    return t('label.knowledgeCopilotIndexStateEmpty');
  }

  return t('label.knowledgeCopilotIndexStateIdle');
});

const lastIndexedText = computed(() => {
  const timestamp = settingsStore.config.knowledgeCopilot.lastIndexedAt;
  return timestamp ? formatDate(timestamp) : t('label.knowledgeCopilotNeverIndexed');
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


