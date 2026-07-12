<template>
  <section class="settings-panel">
    <aside class="settings-panel__sidebar">
      <header class="settings-panel__sidebar-header">
        <h2>{{ t('pref.pane.title') }}</h2>
      </header>

      <nav class="settings-panel__nav" :aria-label="t('pref.pane.title')">
        <ul>
          <template v-for="tab in tabs" :key="tab.id">
            <li v-if="tab.type === 'separator'" class="settings-panel__separator" role="separator" />
            <li v-else>
              <button type="button" class="settings-panel__tab" :class="{ 'is-active': activeTab === tab.id }"
                @click="setActiveTab(tab.id)">
                <span class="settings-panel__tab-icon" aria-hidden="true">
                  <component :is="tab.icon" :size="17" />
                </span>
                <span class="settings-panel__tab-label">
                  <span v-if="tab.label">{{ tab.label }}</span>
                  <span v-else>{{ t(tab.labelKey ?? '') }}</span>
                </span>
              </button>
            </li>
          </template>
        </ul>
      </nav>
    </aside>

    <main class="settings-panel__content">
      <div class="settings-panel__content-inner">
        <Transition name="settings-panel-slide" mode="out-in">
          <component :is="currentComponent" :key="activeTab" />
        </Transition>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, type Component, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  IconAdjustments,
  IconBrowser,
  IconEdit,
  IconShield,
  IconUserKey,
  IconRefresh,
  IconAdjustmentsSpark,
  IconImageGeneration,
  IconSubtitlesAi,
  IconSettings2,
  IconKeyboard,
  IconFileAnalytics,
  IconRefreshDot,
} from '@tabler/icons-vue';
import { useUpdaterStore } from '@renderer/features/updater';
import { useSettings } from '../composables/useSettings';
import GeneralSettings from './tabs/GeneralSettings.vue';
import SoftwareUpdateSettings from './tabs/SoftwareUpdateSettings.vue';
import PreviewSettings from './tabs/PreviewSettings.vue';
import EditorSettings from './tabs/EditorSettings.vue';
import AISourceSettings from './tabs/AISourceSettings.vue';
import AIAssistantSettings from './tabs/AIAssistantSettings.vue';
import KnowledgeAgentSettings from './tabs/KnowledgeAgentSettings.vue';
import LogSettings from './tabs/LogSettings.vue';
import ShortcutSettings from './tabs/ShortcutSettings.vue';
import AdvancedOptionsSettings from './tabs/AdvancedOptionsSettings.vue';
import SyncSettings from './tabs/SyncSettings.vue';
import SecuritySettings from './tabs/SecuritySettings.vue';
import AccessControlSettings from './tabs/AccessControlSettings.vue';

const { t } = useI18n();
const updaterStore = useUpdaterStore();
const { activeTab, setActiveTab } = useSettings();

type TabItem =
  | { id: string; type: 'separator' }
  | { id: string; type?: never; labelKey?: string; label?: string; icon: Component; component: unknown };

const baseTabs: TabItem[] = [
  { id: 'general', labelKey: 'pref.pane.general', icon: IconAdjustments, component: GeneralSettings },

  { id: 'preview', labelKey: 'pref.pane.preview', icon: IconBrowser, component: PreviewSettings },
  { id: 'editor', labelKey: 'pref.pane.editor', icon: IconEdit, component: EditorSettings },
  { id: 'sep-1', type: 'separator' },
  { id: 'security', labelKey: 'pref.pane.security', icon: IconShield, component: SecuritySettings },
  { id: 'access-control', labelKey: 'pref.pane.accessControl', icon: IconUserKey, component: AccessControlSettings },
  { id: 'sync', labelKey: 'pref.pane.sync', icon: IconRefresh, component: SyncSettings },
  { id: 'sep-2', type: 'separator' },
  { id: 'ai-sources', labelKey: 'pref.pane.aiSources', icon: IconAdjustmentsSpark, component: AISourceSettings },
  { id: 'ai-assistant', labelKey: 'pref.pane.aiAssistant', icon: IconImageGeneration, component: AIAssistantSettings },
  { id: 'knowledge-agent', labelKey: 'pref.pane.knowledgeAgent', icon: IconSubtitlesAi, component: KnowledgeAgentSettings },
  { id: 'sep-3', type: 'separator' },
  { id: 'noteStorage', labelKey: 'pref.pane.noteStorage', icon: IconSettings2, component: AdvancedOptionsSettings },
  { id: 'sep-4', type: 'separator' },
  { id: 'shortcuts', labelKey: 'pref.pane.shortcuts', icon: IconKeyboard, component: ShortcutSettings },
  { id: 'log', labelKey: 'pref.pane.log', icon: IconFileAnalytics, component: LogSettings },
  { id: 'software-update', labelKey: 'label.softwareAutoUpdate', icon: IconRefreshDot, component: SoftwareUpdateSettings }
];

const tabs = computed(() => baseTabs.filter((tab) =>
  tab.id !== 'software-update' || !updaterStore.isStoreDistribution
));

watchEffect(() => {
  if (updaterStore.isStoreDistribution && activeTab.value === 'software-update') {
    setActiveTab('general');
  }
});

const currentComponent = computed(() => {
  const tab = tabs.value.find((item) => item.id === activeTab.value);
  return tab && tab.type !== 'separator' ? tab.component : null;
});
</script>

<style scoped>
.settings-panel {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  overflow: hidden;
  color: var(--text-primary);
  background: var(--surface-raised);
}

.settings-panel__sidebar {
  --settings-tab-bg-hover: color-mix(in srgb, var(--surface-soft) 76%, var(--surface-subtle));
  --settings-tab-border-hover: color-mix(in srgb, var(--border-color) 64%, transparent);
  --settings-tab-bg-active: color-mix(in srgb, var(--accent) 10%, var(--surface-raised));
  --settings-tab-bg-active-hover: color-mix(in srgb, var(--accent) 12%, var(--surface-soft));
  --settings-tab-border-active: color-mix(in srgb, var(--accent) 18%, var(--border-color));

  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-subtle);
  border-right: 1px solid var(--border-color);
}

.settings-panel__sidebar-header {
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--border-color);
}

.settings-panel__sidebar-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 700;
}

.settings-panel__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}

.settings-panel__nav ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings-panel__separator {
  height: 1px;
  margin: 6px 6px;
  background-color: var(--border-color);
}

.settings-panel__tab {
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  text-align: left;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.settings-panel__tab-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
}

.settings-panel__tab-label {
  min-width: 0;
  flex: 1;
  display: inline-flex;
  align-items: center;
}

.settings-panel__tab:hover {
  background-color: var(--settings-tab-bg-hover);
  border-color: var(--settings-tab-border-hover);
  color: var(--text-primary);
  box-shadow: var(--shadow-soft);
}

.settings-panel__tab.is-active {
  background: var(--settings-tab-bg-active);
  border-color: var(--settings-tab-border-active);
  color: var(--accent-hover);
  font-weight: 650;
  box-shadow: var(--shadow-soft);
}

.settings-panel__tab.is-active:hover {
  background-color: var(--settings-tab-bg-active-hover);
}

.settings-panel__content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-raised);
}

.settings-panel__content-inner {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px;
}

.settings-panel-slide-enter-active,
.settings-panel-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.settings-panel-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.settings-panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 900px) {
  .settings-panel {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .settings-panel__content-inner {
    padding: 22px;
  }
}
</style>

