<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="settings-overlay" @keydown.esc="handleEsc" tabindex="0" ref="overlayRef">
        <div class="settings-modal" @click.stop>

          <!-- Left Sidebar Navigation -->
          <div class="settings-sidebar">
            <div class="settings-sidebar-header">
              <h2>{{ t('preferencesTitle') }}</h2>
            </div>

            <div class="settings-sidebar-menu">
              <ul>
                <li v-for="tab in tabs" :key="tab.id">
                  <button @click="setActiveTab(tab.id)" class="settings-tab-btn"
                    :class="{ active: activeTab === tab.id }">
                    <span>{{ t(tab.labelKey) }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Right Content Area -->
          <div class="settings-content">
            <div class="settings-close-btn-wrapper">
              <button @click="closeSettings" class="settings-close-btn" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
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

// Import Tabs
import GeneralSettings from './tabs/GeneralSettings.vue';
import AppearanceSettings from './tabs/AppearanceSettings.vue';
import SecuritySettings from './tabs/SecuritySettings.vue';
import AIAssistantSettings from './tabs/AIAssistantSettings.vue';
import RAGSettings from './tabs/RAGSettings.vue';
import UpdateSettings from './tabs/UpdateSettings.vue';
import LogSettings from './tabs/LogSettings.vue';
import ShortcutSettings from './tabs/ShortcutSettings.vue';

const { t } = useI18n();
const { isOpen, activeTab, closeSettings, setActiveTab, initMainProcessListeners } = useSettings();

const overlayRef = ref<HTMLElement | null>(null);
let removeListener: (() => void) | null = null;

const tabs = [
  { id: 'general', labelKey: 'paneGeneral', component: GeneralSettings },
  { id: 'appearance', labelKey: 'paneAppearance', component: AppearanceSettings },
  { id: 'security', labelKey: 'paneSecurity', component: SecuritySettings },
  { id: 'ai', labelKey: 'paneAIConfiguration', component: AIAssistantSettings },
  { id: 'rag', labelKey: 'paneRAG', component: RAGSettings },
  { id: 'shortcuts', labelKey: 'paneShortcuts', component: ShortcutSettings },
  { id: 'update', labelKey: 'labelAutoUpdate', component: UpdateSettings },
  { id: 'log', labelKey: 'paneLog', component: LogSettings },
];

const currentComponent = computed(() => {
  const tab = tabs.find(t => t.id === activeTab.value);
  return tab ? tab.component : null;
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
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  backdrop-filter: blur(4px);
}

.settings-modal {
  display: flex;
  width: 900px;
  height: 650px;
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
  padding: 24px;
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

.settings-tab-btn {
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #4b5563);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-tab-btn:hover {
  background-color: var(--bg-hover, #e5e7eb);
  color: var(--text-primary, #1a1a1a);
}

.settings-tab-btn.active {
  background-color: var(--primary-color, #2563eb);
  color: #ffffff;
  font-weight: 500;
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
  top: 16px;
  right: 16px;
  z-index: 10;
}

.settings-close-btn {
  background: transparent;
  border: none;
  border-radius: 50%;
  padding: 8px;
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
  padding: 48px;
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
