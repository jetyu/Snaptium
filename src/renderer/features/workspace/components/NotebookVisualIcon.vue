<template>
  <span
    class="notebook-visual-icon icon-wrapper"
    :class="[colorClass, { 'notebook-visual-icon--surface': surface }]"
    :style="iconStyle"
  >
    <IconNotebook :size="iconSize" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IconNotebook } from '@tabler/icons-vue';
import { isNotebookIconColor, type NotebookIconColor } from '@shared/notebook-icon.constants';
import { NOTEBOOK_ICON_COLOR_CLASS_MAP } from '../constants/notebookIcon.constants';

const props = withDefaults(defineProps<{
  iconColor?: NotebookIconColor;
  iconSize?: number;
  boxSize?: number;
  surface?: boolean;
}>(), {
  iconColor: undefined,
  iconSize: 14,
  boxSize: 18,
  surface: true,
});

const colorClass = computed(() => {
  if (!isNotebookIconColor(props.iconColor)) {
    return null;
  }

  return NOTEBOOK_ICON_COLOR_CLASS_MAP[props.iconColor];
});

const iconStyle = computed(() => {
  return {
    '--notebook-icon-size': `${props.iconSize}px`,
    '--notebook-icon-box-size': `${props.boxSize}px`,
  };
});
</script>

<style scoped>
.notebook-visual-icon {
  width: var(--notebook-icon-box-size);
  height: var(--notebook-icon-box-size);
  color: var(--text-muted);
  border-radius: 5px;
  transition: color 0.15s, background 0.15s, box-shadow 0.15s;
}

.notebook-visual-icon--surface {
  /* Default is transparent for "Follow Theme" to achieve "no added color" */
  background: transparent;
}

/* Colored states: apply background and border only when a color is explicitly selected */
.notebook-visual-icon--surface[class*="--color-"] {
  background: color-mix(in srgb, currentColor 22%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 36%, transparent);
}

.notebook-visual-icon--color-slate {
  color: var(--notebook-icon-slate);
}

.notebook-visual-icon--color-blue {
  color: var(--notebook-icon-blue);
}

.notebook-visual-icon--color-cyan {
  color: var(--notebook-icon-cyan);
}

.notebook-visual-icon--color-green {
  color: var(--notebook-icon-green);
}

.notebook-visual-icon--color-amber {
  color: var(--notebook-icon-amber);
}

.notebook-visual-icon--color-rose {
  color: var(--notebook-icon-rose);
}

.notebook-visual-icon--color-indigo {
  color: var(--notebook-icon-indigo);
}

.notebook-visual-icon--color-teal {
  color: var(--notebook-icon-teal);
}

.notebook-visual-icon--color-lime {
  color: var(--notebook-icon-lime);
}

.notebook-visual-icon--color-red {
  color: var(--notebook-icon-red);
}

/* Special handling for White: white background with dark lines */
.notebook-visual-icon--color-white {
  background-color: #ffffff !important;
  color: #1e2330 !important;
  box-shadow: inset 0 0 0 1px var(--panel-border) !important;
}
</style>
