<template>
  <EditorWorkspaceView />
  <SettingsDialog />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import EditorWorkspaceView from '@renderer/views/EditorWorkspaceView.vue';
import { SettingsDialog } from '@renderer/features/settings';
import { useSettingsStore } from '@renderer/features/settings';

const settingsStore = useSettingsStore();

onMounted(async () => {
  await settingsStore.loadSettings();
});
</script>
