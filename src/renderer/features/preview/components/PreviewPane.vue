<template>
  <section
    ref="previewRoot"
    class="panel preview preview-panel markdown-body"
    tabindex="0"
    v-html="html"
    :style="previewStyle"
    @click="handlePreviewClick"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { renderMarkdownEnhancements } from '@renderer/core/markdown/markdownEnhancements';
import { useSettingsStore } from '../../settings/store/settings.store';

type PreviewScrollBehavior = 'auto' | 'smooth' | 'instant';

const props = defineProps<{
  html: string;
}>();

const emit = defineEmits<{
  'sync-to-source': [payload: { line: number; relativeOffset: number }];
}>();

const settingsStore = useSettingsStore();
const previewRoot = ref<HTMLElement | null>(null);
const { t } = useI18n();
const copyResetTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
let enhancementRunId = 0;

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

async function syncMarkdownEnhancements() {
  const runId = ++enhancementRunId;
  await nextTick();
  if (runId !== enhancementRunId) {
    return;
  }

  await renderMarkdownEnhancements(previewRoot.value);
}

interface SourceMapEntry {
  sourceStart: number;
  sourceEnd: number;
  domTop: number;
  domBottom: number;
  element: HTMLElement;
}

function getSyncSourceMap(): SourceMapEntry[] {
  const container = previewRoot.value;
  if (!container) {
    return [];
  }

  const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-source-start]'));
  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;

  return blocks.map((block) => {
    const rect = block.getBoundingClientRect();
    return {
      sourceStart: Number(block.dataset.sourceStart),
      sourceEnd: Number(block.dataset.sourceEnd),
      domTop: rect.top - containerRect.top + scrollTop,
      domBottom: rect.bottom - containerRect.top + scrollTop,
      element: block,
    };
  });
}

function scrollToSourceLine(lineNumber: number, behavior: PreviewScrollBehavior = 'auto', relativeOffset?: number) {
  const container = previewRoot.value;
  if (!container) {
    return;
  }

  const sourceMap = getSyncSourceMap();
  if (sourceMap.length === 0) {
    return;
  }

  // Find the entry that contains the line or is closest after it
  let targetEntry: SourceMapEntry | undefined;
  for (let i = 0; i < sourceMap.length; i++) {
    const entry = sourceMap[i];
    if (lineNumber >= entry.sourceStart && lineNumber < entry.sourceEnd) {
      targetEntry = entry;
      break;
    }
    if (entry.sourceStart > lineNumber) {
      targetEntry = sourceMap[i - 1] || entry;
      break;
    }
  }

  if (!targetEntry) {
    targetEntry = sourceMap[sourceMap.length - 1];
  }

  let scrollPos = targetEntry.domTop;

  // Interpolate within the block
  if (lineNumber >= targetEntry.sourceStart && lineNumber < targetEntry.sourceEnd) {
    const lineCount = targetEntry.sourceEnd - targetEntry.sourceStart;
    if (lineCount > 1) {
      const progress = (lineNumber - targetEntry.sourceStart) / lineCount;
      scrollPos = targetEntry.domTop + (targetEntry.domBottom - targetEntry.domTop) * progress;
    }
  }

  // If a relative offset is provided (e.g. 0.8 means 80% from top), adjust scroll position
  // so the target line appears at that exact visual height.
  if (relativeOffset !== undefined) {
    const containerHeight = container.clientHeight;
    scrollPos = scrollPos - (containerHeight * relativeOffset);
  } else {
    scrollPos = scrollPos - 12;
  }

  container.scrollTo({
    top: Math.max(0, scrollPos),
    behavior,
  });
}

function getSourceLineAtScrollTop(scrollTop?: number) {
  const container = previewRoot.value;
  if (!container) {
    return null;
  }

  const sourceMap = getSyncSourceMap();
  if (sourceMap.length === 0) {
    return null;
  }

  const effectiveTop = (scrollTop ?? container.scrollTop) + 12;
  
  // Find the entry that covers the current scroll position
  let targetEntry = sourceMap[0];
  for (const entry of sourceMap) {
    if (entry.domTop > effectiveTop) {
      break;
    }
    targetEntry = entry;
  }

  let line = targetEntry.sourceStart;

  // Interpolate line within the block
  if (effectiveTop >= targetEntry.domTop && effectiveTop < targetEntry.domBottom) {
    const blockHeight = targetEntry.domBottom - targetEntry.domTop;
    if (blockHeight > 20) {
      const progress = (effectiveTop - targetEntry.domTop) / blockHeight;
      const lineCount = targetEntry.sourceEnd - targetEntry.sourceStart;
      line = Math.floor(targetEntry.sourceStart + lineCount * progress);
    }
  }

  return Math.max(1, line);
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

  const editorApi = window.electronAPI.editor;
  if (editorApi) {
    await editorApi.writeClipboard(text);
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
  if (!target) return;

  // Handle copy code button
  const copyButton = target.closest<HTMLButtonElement>('[data-copy-code]');
  if (copyButton) {
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
    return;
  }

  // Handle click to sync to source
  const sourceMappedElement = target.closest<HTMLElement>('[data-source-start]');
  if (sourceMappedElement) {
    const line = Number(sourceMappedElement.dataset.sourceStart);
    if (!isNaN(line)) {
      const container = previewRoot.value;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        // Calculate where the element is relative to the preview viewport
        const elementRect = sourceMappedElement.getBoundingClientRect();
        const relativeOffset = (elementRect.top - containerRect.top) / container.clientHeight;
        
        emit('sync-to-source', { line, relativeOffset });
      }
    }
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
    void syncMarkdownEnhancements();
  },
);

onMounted(() => {
  void syncMarkdownEnhancements();
});

onBeforeUnmount(() => {
  enhancementRunId += 1;
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
