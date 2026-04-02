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
import { useShortcutsStore } from '@renderer/features/shortcuts';
import { useCommandRegistration } from '@renderer/features/shortcuts/composables/useCommandRegistration';

const settingsStore = useSettingsStore();
const shortcutsStore = useShortcutsStore();

useEditorSettings();
useGeneralSettings();
useCommandRegistration();

onMounted(async () => {
  await settingsStore.loadSettings();
  await shortcutsStore.initialize();
});
</script>
