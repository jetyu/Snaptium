<template>
  <div class="app-layout">
    <AppSidebar :active-main-view="activeMainView" :main-views="mainViews" :custom-modules="enabledCustomModules"
      @select-main-view="setActiveMainView" @open-module="openModule" @manage-sidebar="openSidebarManager" />

    <WorkbenchView v-if="activeMainView === 'workbench'" />
    <WorkspaceView v-else />
  </div>

  <SearchDialog
    :is-open="isGlobalSearchOpen"
    :initial-query="globalSearchInitialQuery"
    @close="closeGlobalSearch"
    @select="handleSearchSelect"
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { SearchDialog, useSearch } from '@renderer/features/search';
import { useWorkspace } from '@renderer/features/workspace';
import { useWorkbenchStore } from '@renderer/features/workbench';
import { createLogger } from '@renderer/features/logger';
import { useSettings } from '@renderer/features/settings/composables/useSettings';
import { useTrash } from '@renderer/features/trash';
import { useAbout } from '@renderer/features/about';
import type { AppShellModuleId } from './constants/appShell.constants';
import { useAppShellStore } from './store/appShell.store';
import { useSidebarManager } from './composables/useSidebarManager';
import AppSidebar from './components/AppSidebar.vue';
import WorkbenchView from './views/WorkbenchView.vue';
import WorkspaceView from './views/WorkspaceView.vue';

const mainLayoutLogger = createLogger('MainLayout');
const appShellStore = useAppShellStore();
const { activeMainView, mainViews, enabledCustomModules } = storeToRefs(appShellStore);
const { setActiveMainView } = appShellStore;

const { openSettings } = useSettings();
const { openTrash } = useTrash();
const { openAbout } = useAbout();
const { openSidebarManager } = useSidebarManager();
const { isGlobalSearchOpen, globalSearchInitialQuery, openGlobalSearch, closeGlobalSearch } = useSearch();
const { selectNote, forceFlushAutoSave } = useWorkspace();
const workbenchStore = useWorkbenchStore();

async function openModule(moduleId: AppShellModuleId) {
  switch (moduleId) {
    case 'search':
      openGlobalSearch();
      return;
    case 'settings':
      openSettings('general');
      return;
    case 'trash':
      await openTrash();
      return;
    case 'about':
      openAbout();
      return;
    default:
      return;
  }
}

async function handleSearchSelect(result: any, match?: any) {
  const noteId = result?.chunk?.noteId ?? result?.id;
  if (!noteId) {
    return;
  }

  await setActiveMainView('workspace');
  selectNote(noteId);
  await workbenchStore.recordOpenedNote(noteId);

  setTimeout(() => {
    const detail = { noteId, match, title: result?.title };
    window.dispatchEvent(new CustomEvent('workspace-search-jump', { detail }));
  }, 100);
}

onMounted(() => {
  window.addEventListener('beforeunload', () => {
    forceFlushAutoSave().catch((err: unknown) => {
      mainLayoutLogger.error(`Failed to save before unload: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
});
</script>
