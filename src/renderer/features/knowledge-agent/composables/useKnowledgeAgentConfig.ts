/**
 * useKnowledgeAgentConfig Composable
 * 
 * 绠＄悊 KnowledgeAgent 閰嶇疆鐨勭粍鍚堝紡鍑芥暟
 */

import { computed } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { createLogger } from '@renderer/features/logger';

const knowledgeAgentConfigLogger = createLogger('useKnowledgeAgentConfig');

export function useKnowledgeAgentConfig() {
  const settingsStore = useSettingsStore();

  const knowledgeAgentConfig = computed(() => settingsStore.config.knowledgeAgent);

  const isEnabled = computed(() => knowledgeAgentConfig.value.enabled);

  const embeddingSource = computed(() => {
    const sourceId = knowledgeAgentConfig.value.embeddingSourceId;
    return settingsStore.config.aiSources.find(s => s.id === sourceId);
  });

  const isConfigured = computed(() => {
    const embeddingSource = settingsStore.config.aiSources.find(
      source => source.id === knowledgeAgentConfig.value.embeddingSourceId
    );

    return !!(
      knowledgeAgentConfig.value.embeddingSourceId &&
      embeddingSource &&
      embeddingSource.aiModel
    );
  });

  /**
   * Update knowledge-agent configuration.
   */
  const updateConfig = async <K extends keyof typeof knowledgeAgentConfig.value>(
    key: K,
    value: typeof knowledgeAgentConfig.value[K]
  ) => {
    try {
      await settingsStore.updateKnowledgeAgentSetting(key, value);
      knowledgeAgentConfigLogger.info(`Updated KnowledgeAgent config: ${String(key)} = ${value}`);
    } catch (error) {
      knowledgeAgentConfigLogger.error(`Failed to update KnowledgeAgent config: ${error}`);
      throw error;
    }
  };

  /**
   * Enable knowledge-agent.
   */
  const enable = async () => {
    if (!isConfigured.value) {
      throw new Error('KnowledgeAgent is not configured. Please configure embedding source and model first.');
    }
    await updateConfig('enabled', true);
  };

  /**
   * Disable knowledge-agent.
   */
  const disable = async () => {
    await updateConfig('enabled', false);
  };

  /**
   * Toggle knowledge-agent.
   */
  const toggle = async () => {
    if (isEnabled.value) {
      await disable();
    } else {
      await enable();
    }
  };

  return {
    knowledgeAgentConfig,
    isEnabled,
    isConfigured,
    embeddingSource,

    updateConfig,
    enable,
    disable,
    toggle,
  };
}

