<template>
  <section
    ref="previewRoot"
    class="panel preview preview-panel"
    tabindex="0"
    v-html="html"
    :style="previewStyle"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '../../settings/store/settings.store';

type PreviewScrollBehavior = 'auto' | 'smooth' | 'instant';

defineProps<{
  html: string;
}>();

const settingsStore = useSettingsStore();
const previewRoot = ref<HTMLElement | null>(null);

const previewStyle = computed(() => {
  const { fontSize, fontFamily } = settingsStore.config.previewAppearance;
  return {
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily || 'inherit',
  };
});

function getScrollContainer() {
  return previewRoot.value;
}

function getSourceBlocks() {
  return Array.from(previewRoot.value?.querySelectorAll<HTMLElement>('[data-source-line]') ?? []);
}

function scrollToSourceLine(lineNumber: number, behavior: PreviewScrollBehavior = 'auto') {
  const container = previewRoot.value;
  if (!container) {
    return;
  }

  const blocks = getSourceBlocks();
  if (blocks.length === 0) {
    return;
  }

  const target = [...blocks]
    .reverse()
    .find((block) => Number(block.dataset.sourceLine ?? 0) <= lineNumber)
    ?? blocks[0];

  container.scrollTo({
    top: Math.max(0, target.offsetTop - 12),
    behavior,
  });
}

function getSourceLineAtScrollTop(scrollTop?: number) {
  const container = previewRoot.value;
  if (!container) {
    return null;
  }

  const blocks = getSourceBlocks();
  if (blocks.length === 0) {
    return null;
  }

  const effectiveTop = (scrollTop ?? container.scrollTop) + 16;
  let current = blocks[0];

  for (const block of blocks) {
    if (block.offsetTop > effectiveTop) {
      break;
    }
    current = block;
  }

  return Number(current.dataset.sourceLine ?? 1);
}

defineExpose({
  getScrollContainer,
  getSourceLineAtScrollTop,
  scrollToSourceLine,
});
</script>
