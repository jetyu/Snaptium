import { ref, readonly } from 'vue';
import { settingsService } from '../services/settings.service';

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
    return settingsService.onOpenPreferences(() => {
      openSettings();
    });
  };

  const exportSettings = async () => {
    return await settingsService.exportConfig();
  };

  const importSettings = async () => {
    return await settingsService.importConfig();
  };

  return {
    isOpen: readonly(isOpen),
    activeTab: readonly(activeTab),
    openSettings,
    closeSettings,
    setActiveTab,
    initMainProcessListeners,
    exportSettings,
    importSettings,
  };
}
