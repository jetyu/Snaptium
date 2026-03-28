import { ref, readonly } from 'vue';

const isOpen = ref(false);
const activeTab = ref('general');

export function useSettings() {
  const openSettings = (tab?: string) => {
    if (tab) {
      activeTab.value = tab;
    }
    isOpen.value = true;
  };

  const closeSettings = () => {
    isOpen.value = false;
  };

  const setActiveTab = (tab: string) => {
    activeTab.value = tab;
  };

  const initMainProcessListeners = () => {
    if (window.electronAPI?.menu?.onOpenPreferences) {
      return window.electronAPI.menu.onOpenPreferences(() => {
        openSettings();
      });
    }
    return () => {}; // fallback if not available
  };

  return {
    isOpen: readonly(isOpen),
    activeTab: readonly(activeTab),
    openSettings,
    closeSettings,
    setActiveTab,
    initMainProcessListeners,
  };
}
