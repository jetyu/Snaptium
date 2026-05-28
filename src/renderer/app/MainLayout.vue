<template>
  <div class="main-shell" :class="{ 'main-shell--maximized': isWindowMaximized }">
    <AppWindowFrame />
    <div class="app-layout">
      <AppSidebar :active-main-view="activeMainView" :main-views="mainViews" :custom-modules="enabledCustomModules"
        @select-main-view="setActiveMainView" @open-module="openModule" @manage-sidebar="openSidebarManager" />

      <WorkbenchView v-if="activeMainView === 'workbench'" />
      <MyFavoritesView v-else-if="activeMainView === 'favorites'" />
      <TagsView v-else-if="activeMainView === 'tags'" />
      <SettingsView v-else-if="activeMainView === 'settings'" />
      <WorkspaceView v-else />
    </div>
  </div>

  <SearchDialog v-if="isGlobalSearchOpen" :is-open="isGlobalSearchOpen" :initial-query="globalSearchInitialQuery" @close="closeGlobalSearch"
    @select="handleSearchSelect" />
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSearch } from '@renderer/features/search';
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
import { electronApi } from '@renderer/core/bridge/electronApi';

const WorkbenchView = defineAsyncComponent(() => import('./views/WorkbenchView.vue'));
const WorkspaceView = defineAsyncComponent(() => import('./views/WorkspaceView.vue'));
const SettingsView = defineAsyncComponent(() => import('./views/SettingsView.vue'));
const TagsView = defineAsyncComponent(() => import('@renderer/features/tags/components/TagsView.vue'));
const MyFavoritesView = defineAsyncComponent(() => import('@renderer/features/favorites/components/MyFavoritesView.vue'));
const SearchDialog = defineAsyncComponent(() => import('@renderer/features/search/components/SearchDialog.vue'));

const mainLayoutLogger = createLogger('MainLayout');
const appShellStore = useAppShellStore();
const { activeMainView, mainViews, enabledCustomModules } = storeToRefs(appShellStore);
const { setActiveMainView } = appShellStore;

const { setActiveTab, initMainProcessListeners, onOpenSettingsRequest } = useSettings();
const { openTrash } = useTrash();
const { openAbout } = useAbout();
const { openSidebarManager } = useSidebarManager();
const { isGlobalSearchOpen, globalSearchInitialQuery, openGlobalSearch, closeGlobalSearch } = useSearch();
const { selectNote, forceFlushAutoSave } = useWorkspace();
const isWindowMaximized = ref(false);
let removeWindowStateListener: (() => void) | null = null;
let removeSettingsMenuListener: (() => void) | null = null;
let removeSettingsRequestListener: (() => void) | null = null;

type SearchSelectResult = SearchResult | RagSearchResult;
type SearchSelectMatch = SearchMatch;

function isRagSearchResult(result: SearchSelectResult): result is RagSearchResult {
  return 'chunk' in result;
}

function isSearchResult(result: SearchSelectResult): result is SearchResult {
  return 'id' in result;
}

async function syncWindowState(): Promise<void> {
  if (!electronApi.window.isAvailable()) {
    return;
  }
  isWindowMaximized.value = await electronApi.window.isMaximized();
}

async function openModule(moduleId: AppShellModuleId) {
  switch (moduleId) {
    case 'favorites':
      await setActiveMainView('favorites');
      return;
    case 'tags':
      await setActiveMainView('tags');
      return;
    case 'search':
      openGlobalSearch();
      return;
    case 'settings':
      await showSettings('general');
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

async function showSettings(tab: string = 'general'): Promise<void> {
  setActiveTab(tab);
  await setActiveMainView('settings');
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

function handleBeforeUnload(): void {
  forceFlushAutoSave().catch((err) => {
    mainLayoutLogger.error(`Failed to save before unload: ${getErrorMessage(err)}`);
  });
}

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  removeSettingsRequestListener = onOpenSettingsRequest((tab) => {
    void showSettings(tab);
  });
  removeSettingsMenuListener = initMainProcessListeners(() => {
    void showSettings('general');
  });
  await syncWindowState();

  if (electronApi.window.isAvailable()) {
    removeWindowStateListener = electronApi.window.onStateChanged((payload) => {
      isWindowMaximized.value = payload.isMaximized;
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  removeSettingsMenuListener?.();
  removeSettingsMenuListener = null;
  removeSettingsRequestListener?.();
  removeSettingsRequestListener = null;
  removeWindowStateListener?.();
  removeWindowStateListener = null;
});
</script>

<style scoped>
.main-shell {
  --shell-radius: 8px;
  --shell-border: color-mix(in srgb, var(--panel-border) 78%, transparent);
  position: relative;
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border-radius: var(--shell-radius);
  border: 1px solid var(--shell-border);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 72%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--panel-border) 46%, transparent),
    0 0 0 1px color-mix(in srgb, var(--panel-border) 34%, transparent),
    0 14px 30px rgba(15, 23, 42, 0.2);
  transition: border-radius 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

[data-theme='dark'] .main-shell {
  --shell-border: color-mix(in srgb, var(--panel-border) 84%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 18px 34px rgba(0, 0, 0, 0.44);
}

.main-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 44%, transparent);
}

.main-shell.main-shell--maximized {
  border-radius: 0;
  border-color: transparent;
  box-shadow: none;
}

.main-shell.main-shell--maximized::before {
  box-shadow: none;
}

.app-layout {
  overflow: hidden;
  min-height: 0;
}
</style>
