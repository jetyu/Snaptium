import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAboutStore } from '../store/about.store';
import { aboutService } from '../services/about.service';
import type { EnvVersionInfo } from '../services/about.service';

export function useAbout() {
  const aboutStore = useAboutStore();
  const { isOpen } = storeToRefs(aboutStore);
  const appVersion = ref('');
  const appName = ref('');
  const envVersion = ref<EnvVersionInfo>({
    electron: '',
    node: '',
    chrome: '',
    v8: ''
  });

  const loadVersionInfo = async () => {
    try {
      appVersion.value = await aboutService.getAppVersion();
      appName.value = await aboutService.getAppName();
      envVersion.value = await aboutService.getEnvVersion();
    } catch (error) {
      console.error('Failed to load version info:', error);
    }
  };

  const initMainProcessListeners = () => {
    if (!window.electronAPI.menu) {
      return () => {};
    }
    const removeListener = window.electronAPI.menu.onOpenAbout(() => {
      aboutStore.openAbout();
    });
    return removeListener;
  };

  return {
    isOpen,
    appVersion,
    appName,
    envVersion,
    openAbout: aboutStore.openAbout,
    closeAbout: aboutStore.closeAbout,
    loadVersionInfo,
    initMainProcessListeners
  };
}
