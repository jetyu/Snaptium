/**
 * useRAGConfig Composable
 * 
 * 管理 RAG 配置的组合式函数
 */

import { computed } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { createLogger } from '@renderer/features/logger';

const ragConfigLogger = createLogger('useRAGConfig');

export function useRAGConfig() {
  const settingsStore = useSettingsStore();

  // RAG 配置
  const ragConfig = computed(() => settingsStore.config.rag);

  // 是否启用
  const isEnabled = computed(() => ragConfig.value.enabled);

  // 嵌入服务源
  const embeddingSource = computed(() => {
    const sourceId = ragConfig.value.embeddingSourceId;
    return settingsStore.config.aiSources.find(s => s.id === sourceId);
  });

  // 配置是否完整
  const isConfigured = computed(() => {
    const embeddingSource = settingsStore.config.aiSources.find(
      source => source.id === ragConfig.value.embeddingSourceId
    );
    
    return !!(
      ragConfig.value.embeddingSourceId &&
      embeddingSource &&
      embeddingSource.defaultModel
    );
  });

  /**
   * 更新 RAG 配置
   */
  const updateConfig = async <K extends keyof typeof ragConfig.value>(
    key: K,
    value: typeof ragConfig.value[K]
  ) => {
    try {
      await settingsStore.updateRAGSetting(key, value);
      ragConfigLogger.info(`Updated RAG config: ${String(key)} = ${value}`);
    } catch (error) {
      ragConfigLogger.error(`Failed to update RAG config: ${error}`);
      throw error;
    }
  };

  /**
   * 启用 RAG
   */
  const enable = async () => {
    if (!isConfigured.value) {
      throw new Error('RAG is not configured. Please configure embedding source and model first.');
    }
    await updateConfig('enabled', true);
  };

  /**
   * 禁用 RAG
   */
  const disable = async () => {
    await updateConfig('enabled', false);
  };

  /**
   * 切换 RAG 状态
   */
  const toggle = async () => {
    if (isEnabled.value) {
      await disable();
    } else {
      await enable();
    }
  };

  return {
    // State
    ragConfig,
    isEnabled,
    isConfigured,
    embeddingSource,

    // Actions
    updateConfig,
    enable,
    disable,
    toggle,
  };
}
