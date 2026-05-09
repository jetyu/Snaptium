<template>
  <section
    ref="previewRoot"
    class="panel preview preview-panel"
    tabindex="0"
    v-html="html"
    :style="previewStyle"
    @click="handlePreviewClick"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../settings/store/settings.store';

type PreviewScrollBehavior = 'auto' | 'smooth' | 'instant';

const props = defineProps<{
  html: string;
}>();

const settingsStore = useSettingsStore();
const previewRoot = ref<HTMLElement | null>(null);
const { t } = useI18n();
const copyResetTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();

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

function clearCopyState(button: HTMLButtonElement) {
  const timeout = copyResetTimers.get(button);
  if (timeout) {
    clearTimeout(timeout);
    copyResetTimers.delete(button);
  }

  button.classList.remove('is-copied');
  button.textContent = button.dataset.copyLabel || t('preview.copyCode');
}

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (window.electronAPI?.editor) {
    await window.electronAPI.editor.writeClipboard(text);
    return;
  }

  throw new Error('Clipboard API is unavailable');
}

function scheduleCopyStateReset(button: HTMLButtonElement) {
  const existingTimeout = copyResetTimers.get(button);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const nextTimeout = setTimeout(() => {
    clearCopyState(button);
  }, 1500);

  copyResetTimers.set(button, nextTimeout);
}

async function handlePreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const copyButton = target?.closest<HTMLButtonElement>('[data-copy-code]');
  if (!copyButton) {
    return;
  }

  const codeElement = copyButton.closest('.preview-code-block')?.querySelector<HTMLElement>('code');
  const codeText = codeElement?.textContent ?? '';
  if (!codeText.trim()) {
    return;
  }

  try {
    await writeTextToClipboard(codeText);
    copyButton.classList.add('is-copied');
    copyButton.textContent = t('preview.codeCopied');
    scheduleCopyStateReset(copyButton);
  } catch {
    clearCopyState(copyButton);
  }
}

watch(
  () => props.html,
  () => {
    for (const [button, timeout] of copyResetTimers.entries()) {
      clearTimeout(timeout);
      if (button.isConnected) {
        clearCopyState(button);
      }
    }
    copyResetTimers.clear();
  },
);

onBeforeUnmount(() => {
  for (const timeout of copyResetTimers.values()) {
    clearTimeout(timeout);
  }
  copyResetTimers.clear();
});

defineExpose({
  getScrollContainer,
  getSourceLineAtScrollTop,
  scrollToSourceLine,
});
</script>
