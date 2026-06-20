import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAboutStore } from '../store/about.store';
import { aboutService } from '../services/about.service';
import type { AboutInfo } from '../services/about.service';
import { createLogger } from '@renderer/features/logger';
import { APP_DISTRIBUTIONS, type AppDistribution } from '@shared/updater.constants';
import { getErrorMessage } from '@shared/utils/error.utils';

const aboutLogger = createLogger('About');

export function useAbout() {
  const aboutStore = useAboutStore();
  const { isOpen } = storeToRefs(aboutStore);
  const appVersion = ref('');
  const appName = ref('');
  const distribution = ref<AppDistribution>(APP_DISTRIBUTIONS.DIRECT);
  const envVersion = ref<AboutInfo['envVersion']>({
    electron: '',
    node: '',
    chrome: '',
    v8: ''
  });

  const isMicrosoftStoreDistribution = computed(() => distribution.value === APP_DISTRIBUTIONS.MICROSOFT_STORE);

  const loadVersionInfo = async () => {
    try {
      const aboutInfo = await aboutService.loadAboutInfo();
      appVersion.value = aboutInfo.appVersion;
      appName.value = aboutInfo.appName;
      envVersion.value = aboutInfo.envVersion;
      distribution.value = aboutInfo.distribution;
    } catch (error) {
      aboutLogger.error(`Failed to load version info: ${getErrorMessage(error)}`);
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
    isMicrosoftStoreDistribution,
    openAbout: aboutStore.openAbout,
    closeAbout: aboutStore.closeAbout,
    loadVersionInfo,
    initMainProcessListeners
  };
}
