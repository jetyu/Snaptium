import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAboutStore } from '../store/about.store';
import { aboutService } from '../services/about.service';
import type { AboutInfo } from '../services/about.service';
import { createLogger } from '@renderer/features/logger';

const aboutLogger = createLogger('About');

export function useAbout() {
  const aboutStore = useAboutStore();
  const { isOpen } = storeToRefs(aboutStore);
  const appVersion = ref('');
  const appName = ref('');
  const envVersion = ref<AboutInfo['envVersion']>({
    electron: '',
    node: '',
    chrome: '',
    v8: ''
  });

  const loadVersionInfo = async () => {
    try {
      const aboutInfo = await aboutService.loadAboutInfo();
      appVersion.value = aboutInfo.appVersion;
      appName.value = aboutInfo.appName;
      envVersion.value = aboutInfo.envVersion;
    } catch (error) {
      aboutLogger.error(`Failed to load version info: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const initMainProcessListeners = () => {
    return aboutService.onOpenAbout(() => {
      aboutStore.openAbout();
    });
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
