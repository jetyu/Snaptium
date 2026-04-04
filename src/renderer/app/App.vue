<template>
  <MainLayout />
  <SettingsDialog />
  <AboutDialog />
  <UpdateDialog />
  <TrashDialog />
  <HistoryDialog />
</template>


<script setup lang="ts">
import { onMounted } from 'vue';
import MainLayout from './MainLayout.vue';
import { SettingsDialog,useSettingsStore } from '@renderer/features/settings';
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

const settingsStore = useSettingsStore();
const shortcutsStore = useShortcutsStore();
const workspaceStore = useWorkspaceStore();
const { initializeRAG, setupAutoIndexOnSave } = useRAGInitialization();

useEditorSettings();
useGeneralSettings();
useCommandRegistration();

onMounted(async () => {
  await settingsStore.loadSettings();
  await shortcutsStore.initialize();
  
  // 等待工作区初始化完成
  await workspaceStore.initializeWorkspace();
  
  // 初始化 RAG 服务
  await initializeRAG();
  
  // 设置保存时自动索引
  setupAutoIndexOnSave();
});
</script>
