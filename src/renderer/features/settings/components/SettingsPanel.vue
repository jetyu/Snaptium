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
                <span v-if="tab.label">{{ tab.label }}</span>
                <span v-else>{{ t(tab.labelKey ?? '') }}</span>
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
import { computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUpdaterStore } from '@renderer/features/updater';
import { useSettings } from '../composables/useSettings';
import GeneralSettings from './tabs/GeneralSettings.vue';
import SoftwareUpdateSettings from './tabs/SoftwareUpdateSettings.vue';
import PreviewSettings from './tabs/PreviewSettings.vue';
import EditorSettings from './tabs/EditorSettings.vue';
import AISourceSettings from './tabs/AISourceSettings.vue';
import AIAssistantSettings from './tabs/AIAssistantSettings.vue';
import RAGSettings from './tabs/RAGSettings.vue';
import LogSettings from './tabs/LogSettings.vue';
import ShortcutSettings from './tabs/ShortcutSettings.vue';
import NoteStorageSettings from './tabs/NoteStorageSettings.vue';
import SyncSettings from './tabs/SyncSettings.vue';
import SecuritySettings from './tabs/SecuritySettings.vue';
import AccessControlSettings from './tabs/AccessControlSettings.vue';

const { t } = useI18n();
const updaterStore = useUpdaterStore();
const { activeTab, setActiveTab } = useSettings();

type TabItem =
  | { id: string; type: 'separator' }
  | { id: string; type?: never; labelKey?: string; label?: string; component: unknown };

const baseTabs: TabItem[] = [
  { id: 'general', labelKey: 'pref.pane.general', component: GeneralSettings },

  { id: 'preview', labelKey: 'pref.pane.preview', component: PreviewSettings },
  { id: 'editor', labelKey: 'pref.pane.editor', component: EditorSettings },
  { id: 'sep-1', type: 'separator' },
  { id: 'security', labelKey: 'pref.pane.security', component: SecuritySettings },
  { id: 'access-control', labelKey: 'pref.pane.accessControl', component: AccessControlSettings },
  { id: 'sync', labelKey: 'pref.pane.sync', component: SyncSettings },
  { id: 'sep-2', type: 'separator' },
  { id: 'ai-sources', labelKey: 'pref.pane.aiSources', component: AISourceSettings },
  { id: 'ai-assistant', labelKey: 'pref.pane.aiAssistant', component: AIAssistantSettings },
  { id: 'rag', labelKey: 'pref.pane.aiRAG', component: RAGSettings },
  { id: 'sep-3', type: 'separator' },
  { id: 'noteStorage', labelKey: 'pref.pane.noteStorage', component: NoteStorageSettings },
  { id: 'sep-4', type: 'separator' },
  { id: 'shortcuts', labelKey: 'pref.pane.shortcuts', component: ShortcutSettings },
  { id: 'log', labelKey: 'pref.pane.log', component: LogSettings },
  { id: 'software-update', labelKey: 'label.softwareAutoUpdate', component: SoftwareUpdateSettings }
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
  color: var(--text-primary, #1a1a1a);
  background: var(--bg-primary, #ffffff);
}

.settings-panel__sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, white), var(--panel)),
    var(--bg-secondary, #f8f9fa);
  border-right: 1px solid var(--border-color, #e5e7eb);
}

.settings-panel__sidebar-header {
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.settings-panel__sidebar-header h2 {
  margin: 0;
  color: var(--text-primary, #1a1a1a);
  font-size: 1.15rem;
  font-weight: 700;
}

.settings-panel__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.settings-panel__nav ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings-panel__separator {
  height: 1px;
  margin: 6px 4px;
  background-color: var(--border-color, #e5e7eb);
}

.settings-panel__tab {
  width: 100%;
  min-height: 34px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #4b5563);
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.settings-panel__tab:hover {
  background-color: var(--panel-hover, #eef2f5);
  border-color: color-mix(in srgb, var(--accent) 14%, var(--border-color, #e5e7eb));
  color: var(--text-primary, #253041);
}

.settings-panel__tab.is-active {
  background-color: color-mix(in srgb, var(--accent) 12%, var(--panel, #eef1f5));
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border-color, #c9d1dc));
  color: var(--accent-hover, #1f2937);
  font-weight: 650;
}

.settings-panel__content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-primary, #ffffff);
}

.settings-panel__content-inner {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 30px;
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
