<template>
  <div class="workbench-view">
    <section class="workbench-col panel">
      <WorkbenchDashboard />
    </section>
  </div>
</template>

<script setup lang="ts">
import WorkbenchDashboard from '@renderer/features/workbench/components/WorkbenchDashboard.vue';
</script>

<style scoped>
.workbench-view {
  display: flex;
  min-width: 0;
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

.workbench-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: var(--bg);
}
</style>
