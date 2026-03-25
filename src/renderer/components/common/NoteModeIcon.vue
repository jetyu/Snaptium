<template>
  <div class="app-icon" v-html="svgContent" />
</template>

<script setup lang="ts">
import { computed } from "vue";

// Use Vite's ?raw to import SVG content as a string
import lockedIconRaw from "@assets/icons/lock.svg?raw";
import noteIconRaw from "@assets/icons/note.svg?raw";
import notebookIconRaw from "@assets/icons/notebook.svg?raw";

const props = defineProps<{
  name: "locked" | "note" | "notebook";
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
