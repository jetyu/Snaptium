import { ref, readonly } from 'vue';
import { settingsService } from '../services/settings.service';
import { useSettingsStore } from '../store/settings.store';

const activeTab = ref('general');
const OPEN_SETTINGS_EVENT = 'settings-open-requested';

export function useSettings() {
  const settingsStore = useSettingsStore();

  const openSettings = (tab?: string) => {
    if (tab) {
      activeTab.value = tab;
    }
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { tab: activeTab.value } }));
  };

  const setActiveTab = (tab: string) => {
    activeTab.value = tab;
  };

  const initMainProcessListeners = (callback?: () => void) => {
    return settingsService.onOpenPreferences(() => {
      if (callback) {
        callback();
        return;
      }

      openSettings();
    });
  };

  const onOpenSettingsRequest = (callback: (tab: string) => void) => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: string }>;
      callback(customEvent.detail?.tab ?? activeTab.value);
    };

    window.addEventListener(OPEN_SETTINGS_EVENT, listener);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, listener);
    };
  };

  const exportSettings = async () => {
    return await settingsStore.exportSettings();
  };

  const importSettings = async () => {
    return await settingsStore.importSettings();
  };

  return {
    activeTab: readonly(activeTab),
    openSettings,
    setActiveTab,
    initMainProcessListeners,
    onOpenSettingsRequest,
    exportSettings,
    importSettings,
  };
}
