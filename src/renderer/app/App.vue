<template>
  <MainLayout />
  <SettingsDialog />
  <AboutDialog />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import MainLayout from './MainLayout.vue';
import { SettingsDialog,useSettingsStore } from '@renderer/features/settings';
import { AboutDialog } from '@renderer/features/about';
import { useEditorSettings } from '@renderer/features/settings/composables/useEditorSettings';
import { useGeneralSettings } from '@renderer/features/settings/composables/useGeneralSettings';

const settingsStore = useSettingsStore();

useEditorSettings();
useGeneralSettings();

onMounted(async () => {
  await settingsStore.loadSettings();
});
</script>
