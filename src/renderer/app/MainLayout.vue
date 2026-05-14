<template>
  <div class="main-shell">
    <AppWindowFrame />
    <div class="app-layout">
      <AppSidebar :active-main-view="activeMainView" :main-views="mainViews" :custom-modules="enabledCustomModules"
        @select-main-view="setActiveMainView" @open-module="openModule" @manage-sidebar="openSidebarManager" />

      <WorkbenchView v-if="activeMainView === 'workbench'" />
      <MyFavoritesView v-else-if="activeMainView === 'favorites'" />
      <WorkspaceView v-else />
    </div>
  </div>

  <SearchDialog :is-open="isGlobalSearchOpen" :initial-query="globalSearchInitialQuery" @close="closeGlobalSearch"
    @select="handleSearchSelect" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { SearchDialog, useSearch } from '@renderer/features/search';
import { useWorkspace } from '@renderer/features/workspace';
import { createLogger } from '@renderer/features/logger';
import { useSettings } from '@renderer/features/settings/composables/useSettings';
import { useTrash } from '@renderer/features/trash';
import { useAbout } from '@renderer/features/about';
import type { RagSearchResult } from '@renderer/core/bridge/electronApi';
import type { SearchResult, SearchMatch } from '@renderer/features/search/services/search.service';
import { getErrorMessage } from '@shared/utils/error.utils';
import type { AppShellModuleId } from './constants/appShell.constants';
import { useAppShellStore } from './store/appShell.store';
import { useSidebarManager } from './composables/useSidebarManager';
import AppSidebar from './components/AppSidebar.vue';
import AppWindowFrame from './components/AppWindowFrame.vue';
import WorkbenchView from './views/WorkbenchView.vue';
import WorkspaceView from './views/WorkspaceView.vue';
import MyFavoritesView from '@renderer/features/favorites/components/MyFavoritesView.vue';

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

type SearchSelectResult = SearchResult | RagSearchResult;
type SearchSelectMatch = SearchMatch;

function isRagSearchResult(result: SearchSelectResult): result is RagSearchResult {
  return 'chunk' in result;
}

function isSearchResult(result: SearchSelectResult): result is SearchResult {
  return 'id' in result;
}

async function openModule(moduleId: AppShellModuleId) {
  switch (moduleId) {
    case 'favorites':
      await setActiveMainView('favorites');
      return;
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

async function handleSearchSelect(result: SearchSelectResult, match?: SearchSelectMatch) {
  const noteId = isRagSearchResult(result) ? result.chunk.noteId : result.id;
  if (!noteId) {
    return;
  }

  await setActiveMainView('workspace');
  selectNote(noteId);

  setTimeout(() => {
    const title = isSearchResult(result) ? result.title : result.noteTitle;
    const detail = { noteId, match, title };
    window.dispatchEvent(new CustomEvent('workspace-search-jump', { detail }));
  }, 100);
}

onMounted(() => {
  window.addEventListener('beforeunload', () => {
    forceFlushAutoSave().catch((err) => {
      mainLayoutLogger.error(`Failed to save before unload: ${getErrorMessage(err)}`);
    });
  });
});
</script>

<style scoped>
.main-shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.app-layout {
  min-height: 0;
}
</style>
