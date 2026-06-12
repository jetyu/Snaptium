<template>
  <div class="settings-view">
    <SettingsPanel />
  </div>
</template>

<script setup lang="ts">
import { SettingsPanel } from '@renderer/features/settings';
</script>

<style scoped>
.settings-view {
  height: 100%;
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
}
</style>
