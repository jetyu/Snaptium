<template>
  <MainLayout />
  <SidebarManagerDialog />
  <AboutDialog />
  <UpdateDialog />
  <TrashDialog />
  <HistoryDialog />
  <AccessControlOverlay />
  <LicenseDialog />
</template>


<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import MainLayout from './MainLayout.vue';
import SidebarManagerDialog from './components/SidebarManagerDialog.vue';
import { useSettingsStore } from '@renderer/features/settings';
import { AboutDialog } from '@renderer/features/about';
import { UpdateDialog } from '@renderer/features/updater';
import { TrashDialog } from '@renderer/features/trash';
import { useEditorSettings } from '@renderer/features/settings/composables/useEditorSettings';

import { useGeneralSettings } from '@renderer/features/settings/composables/useGeneralSettings';
import { useShortcutsStore } from '@renderer/features/shortcuts';
import { useCommandRegistration } from '@renderer/features/shortcuts/composables/useCommandRegistration';
import { useRAGInitialization } from '@renderer/features/rag';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { HistoryDialog } from '@renderer/features/workspace';
import { useSyncLifecycle } from '@renderer/features/sync';
import { AccessControlOverlay } from '@renderer/features/security';
import { useFavoritesStore } from '@renderer/features/favorites/store/favorites.store';
import { LicenseDialog } from '@renderer/features/license';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { useUpdaterStore } from '@renderer/features/updater';

const settingsStore = useSettingsStore();
const shortcutsStore = useShortcutsStore();
const workspaceStore = useWorkspaceStore();
const favoritesStore = useFavoritesStore();
const updaterStore = useUpdaterStore();
const { initializeRAG, setupAutoIndexOnSave } = useRAGInitialization();
const { initializeSync, setupAutoSync } = useSyncLifecycle();

useEditorSettings();
useGeneralSettings();
useCommandRegistration();

// 原生菜单（macOS/Windows）的监听器清理函数
const unsubscribers: Array<(() => void)> = [];

onMounted(async () => {
  updaterStore.initialize();
  await settingsStore.loadSettings();
  await shortcutsStore.initialize();
  
  // 等待工作区初始化完成
  await workspaceStore.initializeWorkspace();
  await favoritesStore.initialize(true);

  await initializeSync();
  
  // 初始化 RAG 服务
  await initializeRAG();
  
  // 设置保存时自动索引
  setupAutoIndexOnSave();
  setupAutoSync();

  // 注册原生菜单监听（顶部菜单栏触发）
  if (electronApi.menu.isAvailable()) {
    unsubscribers.push(
      electronApi.menu.onOpenFile(() => {
        void workspaceStore.openExternalFile();
      })
    );
    unsubscribers.push(
      electronApi.menu.onImportMarkdown(() => {
        void workspaceStore.importMarkdown();
      })
    );
    unsubscribers.push(
      electronApi.menu.onImportEnex(() => {
        void workspaceStore.importEnex();
      })
    );
    unsubscribers.push(
      electronApi.menu.onImportSppx(() => {
        void workspaceStore.importSppx();
      })
    );
    unsubscribers.push(
      electronApi.menu.onImportNwp(() => {
        void workspaceStore.importNwp();
      })
    );
    unsubscribers.push(
      electronApi.menu.onExportMarkdown(() => {
        void workspaceStore.exportMarkdown();
      })
    );
    unsubscribers.push(
      electronApi.menu.onExportSppx(() => {
        void workspaceStore.exportSppx();
      })
    );
  }
});

onUnmounted(() => {
  updaterStore.dispose();
  unsubscribers.forEach((unsub) => unsub());
});
</script>
