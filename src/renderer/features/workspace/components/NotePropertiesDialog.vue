<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="workspaceStore.isNotePropertiesDialogOpen && note"
        ref="overlayRef"
        class="note-properties-overlay"
        tabindex="0"
        @click="closeDialog"
        @keydown.esc="closeDialog"
      >
        <div class="note-properties-modal" @click.stop>
          <div class="note-properties-header">
            <div class="note-properties-heading">
              <p class="note-properties-kicker">{{ $t('contextMenu.properties') }}</p>
              <h2 :title="note.title">{{ note.title || $t('common.untitledNote') }}</h2>
            </div>
            <button class="note-properties-close dialog-close-button" type="button" :aria-label="$t('button.close')" @click="closeDialog">
              <IconX :size="18" />
            </button>
          </div>

          <div class="note-properties-body">
            <section class="properties-section">
              <h3>{{ $t('noteProperties.timeInfo') }}</h3>
              <dl class="properties-grid">
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.createdAt') }}</dt>
                  <dd>{{ formatTimestamp(note.createdAt) }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.updatedAt') }}</dt>
                  <dd>{{ formatTimestamp(note.updatedAt) }}</dd>
                </div>
              </dl>
            </section>

            <section class="properties-section">
              <h3>{{ $t('noteProperties.contentStats') }}</h3>
              <dl class="properties-grid">
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.wordCount') }}</dt>
                  <dd>{{ stats.wordCount }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.characterCount') }}</dt>
                  <dd>{{ stats.characterCount }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.lineCount') }}</dt>
                  <dd>{{ stats.lineCount }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.contentSize') }}</dt>
                  <dd>{{ stats.contentSize }}</dd>
                </div>
              </dl>
            </section>

            <section class="properties-section">
              <h3>{{ $t('noteProperties.technicalInfo') }}</h3>
              <dl class="properties-grid properties-grid--single">
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.workspace') }}</dt>
                  <dd :title="workspaceRootLabel">{{ workspaceRootLabel }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.noteId') }}</dt>
                  <dd class="properties-mono" :title="note.id">{{ note.id }}</dd>
                </div>
                <div class="properties-item">
                  <dt>{{ $t('noteProperties.contentId') }}</dt>
                  <dd class="properties-mono" :title="note.contentId">{{ note.contentId }}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div class="note-properties-footer">
            <button
              class="footer-button footer-button--copy"
              :class="{ 'is-copied': isCopied }"
              type="button"
              @click="copyProperties"
            >
              <IconCheck v-if="isCopied" :size="15" />
              <IconCopy v-else :size="15" />
              <span>{{ isCopied ? $t('preview.codeCopied') : $t('noteProperties.copyInfo') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconCheck, IconCopy, IconX } from '@tabler/icons-vue';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { EDITOR_CONSTANTS } from '@renderer/features/editor/constants/editor.constants';
import { workspaceService } from '../services/workspace.service';
import { useWorkspaceStore } from '../store/workspace.store';

const workspaceStore = useWorkspaceStore();
const { t } = useI18n();
const overlayRef = ref<HTMLElement | null>(null);
const isCopied = ref(false);
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const note = computed(() => workspaceStore.notePropertiesTarget);

const workspaceRootLabel = computed(() => {
  return workspaceService.getCurrentWorkspaceRoot() ?? t('noteProperties.unavailable');
});

const stats = computed(() => {
  const content = note.value?.content ?? '';
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const chineseChars = normalizedContent.match(EDITOR_CONSTANTS.STATUSBAR.REGEX.CHINESE_CHARS) ?? [];
  const englishWords = normalizedContent.match(EDITOR_CONSTANTS.STATUSBAR.REGEX.ENGLISH_WORDS) ?? [];
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(normalizedContent).length;
  const lines = normalizedContent.length === 0 ? 0 : normalizedContent.split('\n').length;

  return {
    wordCount: chineseChars.length + englishWords.length,
    characterCount: normalizedContent.length,
    lineCount: lines,
    contentSize: formatFileSize(byteLength),
  };
});

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatFileSize(sizeInBytes: number): string {
  const units = EDITOR_CONSTANTS.STATUSBAR.FILE_SIZE.UNITS;
  const threshold = EDITOR_CONSTANTS.STATUSBAR.FILE_SIZE.THRESHOLD;

  if (sizeInBytes <= 0) {
    return `0 ${units[0]}`;
  }

  let value = sizeInBytes;
  let unitIndex = 0;

  while (value >= threshold && unitIndex < units.length - 1) {
    value /= threshold;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function closeDialog(): void {
  clearCopyFeedbackTimer();
  workspaceStore.closeNotePropertiesDialog();
}

async function copyProperties(): Promise<void> {
  if (!note.value) {
    return;
  }

  const payload = [
    `${t('contextMenu.properties')}: ${note.value.title || t('common.untitledNote')}`,
    `${t('noteProperties.createdAt')}: ${formatTimestamp(note.value.createdAt)}`,
    `${t('noteProperties.updatedAt')}: ${formatTimestamp(note.value.updatedAt)}`,
    `${t('noteProperties.wordCount')}: ${stats.value.wordCount}`,
    `${t('noteProperties.characterCount')}: ${stats.value.characterCount}`,
    `${t('noteProperties.lineCount')}: ${stats.value.lineCount}`,
    `${t('noteProperties.contentSize')}: ${stats.value.contentSize}`,
    `${t('noteProperties.workspace')}: ${workspaceRootLabel.value}`,
    `${t('noteProperties.noteId')}: ${note.value.id}`,
    `${t('noteProperties.contentId')}: ${note.value.contentId}`,
  ].join('\n');

  await electronApi.editor.writeClipboard(payload);
  isCopied.value = true;
  clearCopyFeedbackTimer();
  copyFeedbackTimer = setTimeout(() => {
    isCopied.value = false;
    copyFeedbackTimer = null;
  }, 2000);
}

function clearCopyFeedbackTimer(): void {
  if (!copyFeedbackTimer) {
    return;
  }

  clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = null;
}

watch(
  () => workspaceStore.isNotePropertiesDialogOpen,
  async (isOpen) => {
    if (!isOpen) {
      isCopied.value = false;
      clearCopyFeedbackTimer();
      return;
    }

    await nextTick();
    overlayRef.value?.focus();
  },
);

watch(note, (nextNote) => {
  if (!workspaceStore.isNotePropertiesDialogOpen) {
    return;
  }

  if (!nextNote) {
    workspaceStore.closeNotePropertiesDialog();
  }
});
</script>

<style scoped>
.note-properties-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.note-properties-modal {
  width: min(560px, calc(100vw - 32px));
  background: var(--panel, #ffffff);
  border: 1px solid var(--panel-border, #e5e7eb);
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.note-properties-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
  background: var(--panel-header, #f9fafb);
}

.note-properties-heading {
  min-width: 0;
}

.note-properties-kicker {
  margin: 0 0 6px;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted, #6b7280);
}

.note-properties-heading h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-properties-close {
  flex: 0 0 auto;
}

.note-properties-body {
  display: grid;
  gap: 18px;
  padding: 18px 20px 20px;
}

.properties-section {
  display: grid;
  gap: 12px;
}

.properties-section h3 {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted, #6b7280);
}

.properties-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 0;
}

.properties-grid--single {
  grid-template-columns: 1fr;
}

.properties-item {
  min-width: 0;
}

.properties-item dt {
  margin: 0 0 4px;
  font-size: 0.78rem;
  color: var(--text-muted, #6b7280);
}

.properties-item dd {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.properties-mono {
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 0.82rem;
}

.note-properties-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--panel-border, #e5e7eb);
  background: var(--panel-header, #f9fafb);
}

.footer-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--panel-border, #e5e7eb);
  border-radius: 8px;
  background: transparent;
  color: var(--text, #374151);
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.footer-button:hover {
  background: var(--panel-hover, #f3f4f6);
}

.footer-button--copy.is-copied {
  border-color: color-mix(in srgb, #10b981 40%, var(--panel-border));
  background: color-mix(in srgb, #10b981 10%, var(--panel));
  color: #047857;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .note-properties-modal {
    width: calc(100vw - 20px);
  }

  .properties-grid {
    grid-template-columns: 1fr;
  }

  .note-properties-footer {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
