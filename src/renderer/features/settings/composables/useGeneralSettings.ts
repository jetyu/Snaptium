import { watch, onMounted, onUnmounted } from 'vue';
import { useSettingsStore } from '../store/settings.store';

export function useGeneralSettings() {
  const settingsStore = useSettingsStore();
  let mediaQuery: MediaQueryList | null = null;
  let removeSystemThemeListener: (() => void) | null = null;

  const applyThemeMode = (mode: 'system' | 'light' | 'dark') => {
    let activeTheme = mode;
    if (mode === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = activeTheme;
  };

  watch(
    () => settingsStore.config.themeMode,
    (newMode) => {
      applyThemeMode(newMode);
    },
    { immediate: true },
  );

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settingsStore.config.themeMode === 'system') {
        applyThemeMode('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    removeSystemThemeListener = () => {
      mediaQuery?.removeEventListener('change', handleSystemThemeChange);
    };
  });

  onUnmounted(() => {
    removeSystemThemeListener?.();
  });
}
