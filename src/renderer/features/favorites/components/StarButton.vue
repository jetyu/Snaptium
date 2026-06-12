<template>
  <button
    class="star-btn icon-wrapper"
    :class="{ 'is-starred': modelValue }"
    :title="modelValue ? $t('contextMenu.unstar') : $t('contextMenu.star')"
    @click.stop="$emit('update:modelValue', !modelValue)"
  >
    <IconStar :fill="modelValue ? 'currentColor' : 'none'" :size="14" />
  </button>
</template>

<script setup lang="ts">
import { IconStar } from '@tabler/icons-vue';

defineProps<{
  modelValue?: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<style scoped>
.star-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary, #888);
  transition: opacity 0.2s, background-color 0.2s, color 0.2s;
}

.star-btn:hover {
  background-color: var(--bg-hover, rgba(0, 0, 0, 0.05));
}

.star-btn.is-starred {
  color: var(--primary-color, #eebf0e);
}
</style>
