<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Editor } from '@milkdown/kit/core';
import { callCommand } from '@milkdown/kit/utils';
import { toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInBlockquoteCommand } from '@milkdown/kit/preset/commonmark';
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { t } from '@snaptium/i18n';
import { createMarkdownEditor, focusEditor, readMarkdown, replaceMarkdown } from './engine';
import { MarkdownValidationError, validateMarkdown } from './markdown';
import type { MarkdownIssue } from './markdown';

const props = defineProps<{ initialMarkdown: string; initialMode?: 'rich' | 'source'; notice?: string }>();
const emit = defineEmits<{ change: [markdown: string]; draft: [snapshot: { markdown: string; mode: 'rich' | 'source' }] }>();
const root = ref<HTMLElement | null>(null);
const mode = ref<'rich' | 'source'>(props.initialMode ?? 'rich');
const source = ref(props.initialMarkdown);
const ready = ref(false);
const composing = ref(false);
const issue = ref<MarkdownIssue | null>(null);
const errorMessage = computed(() => issue.value ? t(issue.value) : '');
let editor: Editor | undefined;
let disposed = false;
type Format = 'bold' | 'italic' | 'strike' | 'heading' | 'list' | 'quote' | 'undo' | 'redo';

onMounted(async () => {
  if (!root.value) return;
  let initial = props.initialMarkdown;
  try { validateMarkdown(initial); } catch (error: unknown) {
    issue.value = error instanceof MarkdownValidationError ? error.code : 'editorUnavailable';
    initial = '';
    mode.value = 'source';
  }
  try {
    const instance = await createMarkdownEditor(root.value, {
      initialMarkdown: initial,
      onChange(markdown) {
        if (!disposed && mode.value === 'rich') {
          emit('change', markdown);
          emit('draft', { markdown, mode: 'rich' });
        }
      },
      onReject(code) { if (!disposed) issue.value = code; },
    });
    if (disposed) { await instance.destroy(); return; }
    editor = instance;
    ready.value = true;
  } catch {
    if (!disposed) { issue.value = 'editorUnavailable'; mode.value = 'source'; }
  }
});

onBeforeUnmount(() => {
  disposed = true;
  if (editor) void editor.destroy().catch(() => {});
});

function changeMode(next: 'rich' | 'source'): void {
  if (mode.value === next || composing.value || !editor) return;
  if (next === 'source') {
    source.value = readMarkdown(editor); mode.value = 'source';
    emit('draft', { markdown: source.value, mode: 'source' });
    return;
  }
  try {
    replaceMarkdown(editor, source.value);
    mode.value = 'rich';
    source.value = readMarkdown(editor);
    issue.value = null;
    emit('change', source.value);
    emit('draft', { markdown: source.value, mode: 'rich' });
  } catch (error: unknown) {
    issue.value = error instanceof MarkdownValidationError ? error.code : 'editorUnavailable';
  }
}

function format(action: Format): void {
  if (!editor || composing.value) return;
  focusEditor(editor);
  switch (action) {
    case 'bold': editor.action(callCommand(toggleStrongCommand.key)); break;
    case 'italic': editor.action(callCommand(toggleEmphasisCommand.key)); break;
    case 'strike': editor.action(callCommand(toggleStrikethroughCommand.key)); break;
    case 'heading': editor.action(callCommand(wrapInHeadingCommand.key, 2)); break;
    case 'list': editor.action(callCommand(wrapInBulletListCommand.key)); break;
    case 'quote': editor.action(callCommand(wrapInBlockquoteCommand.key)); break;
    case 'undo': editor.action(callCommand(undoCommand.key)); break;
    case 'redo': editor.action(callCommand(redoCommand.key)); break;
  }
}

const tools: Format[] = ['bold', 'italic', 'strike', 'heading', 'list', 'quote', 'undo', 'redo'];
</script>

<template>
  <section
    class="markdown-workspace"
    aria-labelledby="editor-title"
  >
    <div class="editor-heading">
      <div>
        <p class="eyebrow">
          {{ t('editorEyebrow') }}
        </p><h2 id="editor-title">
          {{ t('editorTitle') }}
        </h2>
      </div>
      <div
        class="editor-modes"
        :aria-label="t('editorMode')"
      >
        <button
          type="button"
          :aria-pressed="mode === 'rich'"
          :disabled="!ready || composing"
          @click="changeMode('rich')"
        >
          {{ t('richMode') }}
        </button>
        <button
          type="button"
          :aria-pressed="mode === 'source'"
          :disabled="!ready || composing"
          @click="changeMode('source')"
        >
          {{ t('sourceMode') }}
        </button>
      </div>
    </div>
    <p class="editor-preview-note">
      {{ notice ?? t('editorPreviewNote') }}
    </p>
    <div
      v-show="mode === 'rich'"
      class="editor-toolbar"
      role="toolbar"
      :aria-label="t('editorFormatting')"
    >
      <button
        v-for="tool in tools"
        :key="tool"
        type="button"
        :disabled="!ready || composing"
        @mousedown.prevent
        @click="format(tool)"
      >
        {{ t(tool) }}
      </button>
    </div>
    <div
      v-if="errorMessage"
      class="editor-error"
      role="alert"
    >
      {{ errorMessage }}
    </div>
    <div
      v-show="mode === 'rich'"
      ref="root"
      class="editor-content"
      @compositionstart.capture="composing = true"
      @compositionend.capture="composing = false"
    />
    <textarea
      v-if="mode === 'source'"
      v-model="source"
      class="editor-source"
      :aria-label="t('sourceBody')"
      spellcheck="false"
      @input="emit('draft', { markdown: ($event.target as HTMLTextAreaElement).value, mode: 'source' })"
      @compositionstart="composing = true"
      @compositionend="composing = false"
    />
    <p class="editor-footnote">
      {{ t('editorFootnote') }}
    </p>
  </section>
</template>
