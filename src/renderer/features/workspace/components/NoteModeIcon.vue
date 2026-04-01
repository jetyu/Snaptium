<template>
  <div class="app-icon" v-html="svgContent" />
</template>

<script setup lang="ts">
import { computed } from "vue";

// Use Vite's ?raw to import SVG content as a string
import lockedIconRaw from "@assets/icons/workspace/lock.svg?raw";
import noteIconRaw from "@assets/icons/common/note.svg?raw";
import notebookIconRaw from "@assets/icons/common/notebook.svg?raw";

const props = defineProps<{
  name: "lockedIcon" | "noteIcon" | "notebookIcon";
}>();

const icons = {
  lockedIcon: lockedIconRaw,
  noteIcon: noteIconRaw,
  notebookIcon: notebookIconRaw,
};

const svgContent = computed(() => icons[props.name] || "");
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
}

.app-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
