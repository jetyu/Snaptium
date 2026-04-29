import { watch, onMounted } from 'vue';
import { useSettingsStore } from '../store/settings.store';

export function useGeneralSettings() {
  const settingsStore = useSettingsStore();

  const applyThemeMode = (mode: 'system' | 'light' | 'dark') => {
    let activeTheme = mode;
    if (mode === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', activeTheme);
  };

  onMounted(() => {
    applyThemeMode(settingsStore.config.themeMode);

    // Watch for config changes
    watch(() => settingsStore.config.themeMode, (newMode) => {
      applyThemeMode(newMode);
    });

    // Watch for system theme changes if set to 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settingsStore.config.themeMode === 'system') {
        applyThemeMode('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  });
}
