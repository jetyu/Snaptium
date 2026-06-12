<template>
  <div class="workbench-view">
    <WorkbenchDashboard />
  </div>
</template>

<script setup lang="ts">
import WorkbenchDashboard from '@renderer/features/workbench/components/WorkbenchDashboard.vue';
</script>

<style scoped>
.workbench-view {
  height: 100%;
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
}
</style>
