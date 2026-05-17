import { computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@renderer/features/settings';
import {
  APP_SHELL_CUSTOM_MODULE_MAP,
  APP_SHELL_CUSTOM_MODULES,
  APP_SHELL_MAIN_VIEWS,
  APP_SHELL_MAX_CUSTOM_MODULES,
  type AppShellMainViewId,
  type AppShellModuleDefinition,
  type AppShellModuleId,
} from '../constants/appShell.constants';

function sanitizeCustomModules(moduleIds: AppShellModuleId[]): AppShellModuleId[] {
  const uniqueModuleIds = moduleIds.filter((moduleId, index) => {
    return APP_SHELL_CUSTOM_MODULE_MAP.has(moduleId) && moduleIds.indexOf(moduleId) === index;
  });

  return uniqueModuleIds.slice(0, APP_SHELL_MAX_CUSTOM_MODULES);
}

export const useAppShellStore = defineStore('app-shell', () => {
  const settingsStore = useSettingsStore();
  const { config } = storeToRefs(settingsStore);

  const activeMainView = computed<AppShellMainViewId>(() => config.value.appShell.activeMainView);
  const maxCustomModules = computed(() => APP_SHELL_MAX_CUSTOM_MODULES);
  const enabledCustomModuleIds = computed<AppShellModuleId[]>(() => {
    return sanitizeCustomModules(config.value.appShell.customSidebarModules);
  });

  const mainViews = computed(() => APP_SHELL_MAIN_VIEWS);
  const customModules = computed(() => APP_SHELL_CUSTOM_MODULES);
  const enabledCustomModules = computed<AppShellModuleDefinition[]>(() => {
    return enabledCustomModuleIds.value.reduce<AppShellModuleDefinition[]>((modules, moduleId) => {
      const module = APP_SHELL_CUSTOM_MODULE_MAP.get(moduleId);
      if (module) {
        modules.push(module);
      }
      return modules;
    }, []);
  });
  const availableCustomModules = computed(() => {
    return APP_SHELL_CUSTOM_MODULES.filter((module) => !enabledCustomModuleIds.value.includes(module.id));
  });
  const hasReachedCustomModuleLimit = computed(() => {
    return enabledCustomModuleIds.value.length >= maxCustomModules.value;
  });

  async function saveAppShell(partialConfig: Partial<(typeof config.value)['appShell']>) {
    await settingsStore.saveSettings({
      appShell: {
        ...config.value.appShell,
        ...partialConfig,
      },
    });
  }

  async function setActiveMainView(viewId: AppShellMainViewId) {
    if (activeMainView.value === viewId) {
      return;
    }

    await saveAppShell({ activeMainView: viewId });
  }

  async function enableCustomModule(moduleId: AppShellModuleId) {
    if (enabledCustomModuleIds.value.includes(moduleId) || hasReachedCustomModuleLimit.value) {
      return;
    }

    await saveAppShell({
      customSidebarModules: [...enabledCustomModuleIds.value, moduleId],
    });
  }

  async function disableCustomModule(moduleId: AppShellModuleId) {
    if (!enabledCustomModuleIds.value.includes(moduleId)) {
      return;
    }

    await saveAppShell({
      customSidebarModules: enabledCustomModuleIds.value.filter((item) => item !== moduleId),
    });
  }

  return {
    activeMainView,
    mainViews,
    customModules,
    enabledCustomModules,
    availableCustomModules,
    enabledCustomModuleIds,
    maxCustomModules,
    hasReachedCustomModuleLimit,
    setActiveMainView,
    enableCustomModule,
    disableCustomModule,
  };
});
