<template>
  <EditorWorkspaceView />
  <SettingsDialog />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import EditorWorkspaceView from '@renderer/views/EditorWorkspaceView.vue';
import { SettingsDialog } from '@renderer/features/settings';
import { useSettingsStore } from '@renderer/features/settings';
import { useEditorSettings } from '@renderer/features/settings/composables/useEditorSettings';
import { useGeneralSettings } from '@renderer/features/settings/composables/useGeneralSettings';

const settingsStore = useSettingsStore();

useEditorSettings();
useGeneralSettings();

onMounted(async () => {
  await settingsStore.loadSettings();
});
</script>
