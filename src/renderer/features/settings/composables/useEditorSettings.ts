import { watch, onMounted } from 'vue';
import { useSettingsStore } from '../store/settings.store';

export function useEditorSettings() {
  const settingsStore = useSettingsStore();

  const applyEditorTypography = (fontSize: number, fontFamily: string) => {
    const root = document.documentElement;
    root.style.setProperty('--editor-font-size', `${fontSize}px`);
    
    if (fontFamily) {
      root.style.setProperty('--editor-font-family', fontFamily);
    } else {
      root.style.removeProperty('--editor-font-family');
    }
  };

  onMounted(() => {
    applyEditorTypography(settingsStore.config.editorFontSize, settingsStore.config.editorFont);

    // Watch for config changes
    watch(
      () => [settingsStore.config.editorFontSize, settingsStore.config.editorFont],
      ([size, font]) => {
        applyEditorTypography(size as number, font as string);
      }
    );
  });
}
