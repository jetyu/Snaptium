import { watch, onMounted, onUnmounted } from 'vue';
import { useSettingsStore, type AccentMode, type ThemeMode } from '../store/settings.store';

export function useGeneralSettings() {
  const settingsStore = useSettingsStore();
  let mediaQuery: MediaQueryList | null = null;
  let removeSystemThemeListener: (() => void) | null = null;

  const resolveThemeMode = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return mode;
  };

  const applyThemeAppearance = (themeMode: ThemeMode, accentMode: AccentMode) => {
    const activeTheme = resolveThemeMode(themeMode);
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.setAttribute('data-accent', accentMode);
    document.documentElement.style.colorScheme = activeTheme;
  };

  watch(
    () => [settingsStore.config.themeMode, settingsStore.config.accentMode] as const,
    ([newThemeMode, newAccentMode]) => {
      applyThemeAppearance(newThemeMode, newAccentMode);
    },
    { immediate: true },
  );

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settingsStore.config.themeMode === 'system') {
        applyThemeAppearance('system', settingsStore.config.accentMode);
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
