<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="settings-overlay" @keydown.esc="handleEsc" tabindex="0" ref="overlayRef">
        <div class="settings-modal" @click.stop>

          <!-- Left Sidebar Navigation -->
          <div class="settings-sidebar">
            <div class="settings-sidebar-header">
              <h2>{{ t('pref.pane.title') }}</h2>
            </div>

            <div class="settings-sidebar-menu">
              <ul>
                <template v-for="tab in tabs" :key="tab.id">
                  <li v-if="tab.type === 'separator'" class="settings-tab-separator" role="separator" />
                  <li v-else>
                    <button @click="setActiveTab(tab.id)" class="settings-tab-btn"
                      :class="{ active: activeTab === tab.id }">
                      <span v-if="tab.label">{{ tab.label }}</span>
                      <span v-else>{{ t(tab.labelKey ?? '') }}</span>
                    </button>
                  </li>
                </template>
              </ul>
            </div>
          </div>

          <!-- Right Content Area -->
          <div class="settings-content">
            <div class="settings-close-btn-wrapper">
              <button @click="closeSettings" class="settings-close-btn" :aria-label="t('dialog.close')">
                <close theme="outline" size="16" />
              </button>
            </div>

            <div class="settings-content-inner">
              <Transition name="slide-up" mode="out-in">
                <component :is="currentComponent" :key="activeTab" />
              </Transition>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettings } from '../composables/useSettings';
import { Close } from '@icon-park/vue-next';
import GeneralSettings from './tabs/GeneralSettings.vue';
import PreviewSettings from './tabs/PreviewSettings.vue';
import EditorSettings from './tabs/EditorSettings.vue';
import AISourceSettings from './tabs/AISourceSettings.vue';
import AIAssistantSettings from './tabs/AIAssistantSettings.vue';
import RAGSettings from './tabs/RAGSettings.vue';
import LogSettings from './tabs/LogSettings.vue';
import ShortcutSettings from './tabs/ShortcutSettings.vue';
import NoteStorageSettings from './tabs/NoteStorageSettings.vue';
import SyncSettings from './tabs/SyncSettings.vue';

const { t } = useI18n();
const { isOpen, activeTab, closeSettings, setActiveTab, initMainProcessListeners } = useSettings();

const overlayRef = ref<HTMLElement | null>(null);
let removeListener: (() => void) | null = null;

type TabItem =
  | { id: string; type: 'separator' }
  | { id: string; type?: never; labelKey?: string; label?: string; component: unknown };

const tabs: TabItem[] = [
  { id: 'general', labelKey: 'pref.pane.general', component: GeneralSettings },
  { id: 'preview', labelKey: 'pref.pane.preview', component: PreviewSettings },
  { id: 'editor', labelKey: 'pref.pane.editor', component: EditorSettings },
  { id: 'sep-1', type: 'separator' },
  { id: 'noteStorage', labelKey: 'pref.pane.noteStorage', component: NoteStorageSettings },
  { id: 'sync', labelKey: 'pref.pane.sync', component: SyncSettings },
  { id: 'sep-2', type: 'separator' },
  { id: 'ai-sources', labelKey: 'pref.pane.aiSources', component: AISourceSettings },
  { id: 'ai-assistant', labelKey: 'pref.pane.aiAssistant', component: AIAssistantSettings },
  { id: 'rag', labelKey: 'pref.pane.aiRAG', component: RAGSettings },
  { id: 'sep-3', type: 'separator' },
  { id: 'shortcuts', labelKey: 'pref.pane.shortcuts', component: ShortcutSettings },
  { id: 'log', labelKey: 'pref.pane.log', component: LogSettings },
];

const currentComponent = computed(() => {
  const tab = tabs.find(t => t.id === activeTab.value);
  return tab && tab.type !== 'separator' ? tab.component : null;
});

const handleEsc = () => {
  if (isOpen.value) {
    closeSettings();
  }
};

watch(isOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    if (overlayRef.value) {
      overlayRef.value.focus();
    }
  }
});

onMounted(() => {
  removeListener = initMainProcessListeners();
});

onUnmounted(() => {
  if (removeListener) {
    removeListener();
  }
});
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.settings-modal {
  display: flex;
  width: 1000px;
  height: 700px;
  background-color: var(--bg-primary, #ffffff);
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  color: var(--text-primary, #1a1a1a);
}

.settings-sidebar {
  width: 240px;
  background-color: var(--bg-secondary, #f8f9fa);
  border-right: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  flex-direction: column;
}

.settings-sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.settings-sidebar-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.settings-sidebar-menu {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.settings-sidebar-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-tab-separator {
  height: 1px;
  background-color: var(--border-color, #e5e7eb);
  margin: 6px 4px;
  list-style: none;
}

.settings-tab-btn {
  width: 100%;
  text-align: left;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary, #4b5563);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.settings-tab-btn:hover {
  background-color: #eef2f5;
  border-color: #e3e8ee;
  color: #253041;
}

.settings-tab-btn.active {
  background-color: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border, #dde1e9));
  color: var(--accent-hover, #2563eb);
  font-weight: 600;
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: var(--bg-primary, #ffffff);
}

.settings-close-btn-wrapper {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 2000;
}

.settings-close-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 4px;
  color: var(--text-secondary, #4b5563);
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-close-btn:hover {
  background-color: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #1a1a1a);
}

.settings-content-inner {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
