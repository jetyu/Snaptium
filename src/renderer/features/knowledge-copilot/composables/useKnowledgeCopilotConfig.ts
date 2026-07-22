/**
 * useKnowledgeCopilotConfig Composable
 * 
 */

import { computed } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { createLogger } from '@renderer/features/logger';

const knowledgeCopilotConfigLogger = createLogger('useKnowledgeCopilotConfig');

export function useKnowledgeCopilotConfig() {
  const settingsStore = useSettingsStore();

  const knowledgeCopilotConfig = computed(() => settingsStore.config.knowledgeCopilot);

  const isEnabled = computed(() => knowledgeCopilotConfig.value.enabled);

  const embeddingSource = computed(() => {
    const sourceId = knowledgeCopilotConfig.value.embeddingSourceId;
    return settingsStore.config.aiSources.find(s => s.id === sourceId);
  });

  const isConfigured = computed(() => {
    const embeddingSource = settingsStore.config.aiSources.find(
      source => source.id === knowledgeCopilotConfig.value.embeddingSourceId
    );

    return !!(
      knowledgeCopilotConfig.value.embeddingSourceId &&
      embeddingSource &&
      embeddingSource.aiModel
    );
  });

  /**
   * Update knowledge-copilot configuration.
   */
  const updateConfig = async <K extends keyof typeof knowledgeCopilotConfig.value>(
    key: K,
    value: typeof knowledgeCopilotConfig.value[K]
  ) => {
    try {
      await settingsStore.updateKnowledgeCopilotSetting(key, value);
      knowledgeCopilotConfigLogger.info(`Updated KnowledgeCopilot config: ${String(key)} = ${value}`);
    } catch (error) {
      knowledgeCopilotConfigLogger.error(`Failed to update KnowledgeCopilot config: ${error}`);
      throw error;
    }
  };

  /**
   * Enable knowledge-copilot.
   */
  const enable = async () => {
    if (!isConfigured.value) {
      throw new Error('KnowledgeCopilot is not configured. Please configure embedding source and model first.');
    }
    await updateConfig('enabled', true);
  };

  /**
   * Disable knowledge-copilot.
   */
  const disable = async () => {
    await updateConfig('enabled', false);
  };

  /**
   * Toggle knowledge-copilot.
   */
  const toggle = async () => {
    if (isEnabled.value) {
      await disable();
    } else {
      await enable();
    }
  };

  return {
    knowledgeCopilotConfig,
    isEnabled,
    isConfigured,
    embeddingSource,

    updateConfig,
    enable,
    disable,
    toggle,
  };
}

