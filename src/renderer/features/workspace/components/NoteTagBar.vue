<template>
  <div ref="rootRef" class="note-tag-bar">
    <span class="note-tag-bar__label">{{ t('tags.label') }}</span>
    <div class="note-tag-bar__list">
      <span v-for="tag in activeTags" :key="tag" class="note-tag-bar__pill">
        <TagOne theme="outline" :size="13" />
        <span class="note-tag-bar__pill-text">#{{ tag }}</span>
        <button type="button" class="note-tag-bar__remove" :title="t('tags.remove', { tag })"
          :aria-label="t('tags.remove', { tag })" @click="removeTag(tag)">
          <span class="note-tag-bar__icon note-tag-bar__icon--remove">
            <CloseSmall theme="outline" :size="13" />
          </span>
        </button>
      </span>

      <button type="button" class="note-tag-bar__add" :title="addButtonTitle" :aria-label="addButtonTitle"
        :disabled="hasReachedTagLimit" @click="togglePicker">
        <span class="note-tag-bar__icon note-tag-bar__icon--add">
          <Plus theme="outline" :size="14" />
        </span>
      </button>
    </div>

    <div v-if="isPickerOpen" ref="pickerRef" class="note-tag-bar__picker">
      <input ref="inputRef" v-model="query" class="note-tag-bar__input" type="text"
        :placeholder="t('tags.inputPlaceholder')" @keydown.enter.prevent="commitQuery"
        @keydown.esc.prevent="closePicker" />

      <div v-if="availableTags.length > 0" ref="pickerRef" class="note-tag-bar__suggestions">
        <button v-for="tag in availableTags" :key="tag.name" type="button" class="note-tag-bar__suggestion"
          @click="addTag(tag.name)">
          <span class="note-tag-bar__suggestion-name">#{{ tag.name }}</span>
          <span class="note-tag-bar__suggestion-count">{{ tag.count }}</span>
        </button>
      </div>

      <button v-if="canCreateTag" type="button" class="note-tag-bar__create" @click="commitQuery">
        {{ t('tags.create', { tag: normalizedQuery }) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CloseSmall, Plus, TagOne } from '@icon-park/vue-next';
import {
  MAX_TAGS_PER_NOTE,
  normalizeNoteTag,
  normalizeNoteTags,
} from '@renderer/features/workspace/services/workspace.service';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';

const workspaceStore = useWorkspaceStore();
const { t } = useI18n();

const isPickerOpen = ref(false);
const query = ref('');
const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const pickerRef = ref<HTMLElement | null>(null);

const activeTags = computed(() => normalizeNoteTags(workspaceStore.activeNote?.tags));
const activeTagKeys = computed(() => new Set(activeTags.value.map((tag) => tag.toLocaleLowerCase())));
const normalizedQuery = computed(() => normalizeNoteTag(query.value) ?? '');
const hasReachedTagLimit = computed(() => activeTags.value.length >= MAX_TAGS_PER_NOTE);
const addButtonTitle = computed(() => {
  return hasReachedTagLimit.value
    ? t('tags.maxReached', { count: MAX_TAGS_PER_NOTE })
    : t('tags.add');
});

const availableTags = computed(() => {
  const queryKey = normalizedQuery.value.toLocaleLowerCase();

  return workspaceStore.allTags
    .filter((tag) => !activeTagKeys.value.has(tag.name.toLocaleLowerCase()))
    .filter((tag) => !queryKey || tag.name.toLocaleLowerCase().includes(queryKey))
    .slice(0, 8);
});

const canCreateTag = computed(() => {
  if (!normalizedQuery.value || hasReachedTagLimit.value) {
    return false;
  }

  const queryKey = normalizedQuery.value.toLocaleLowerCase();
  return !activeTagKeys.value.has(queryKey) && !workspaceStore.allTags.some((tag) => tag.name.toLocaleLowerCase() === queryKey);
});

async function focusInput(): Promise<void> {
  await nextTick();
  inputRef.value?.focus();
}

async function togglePicker(): Promise<void> {
  if (hasReachedTagLimit.value) {
    closePicker();
    return;
  }

  isPickerOpen.value = !isPickerOpen.value;
  if (isPickerOpen.value) {
    query.value = '';
    await focusInput();
  }
}

function closePicker(): void {
  isPickerOpen.value = false;
  query.value = '';
}

async function addTag(tagName: string): Promise<void> {
  if (hasReachedTagLimit.value) {
    closePicker();
    return;
  }

  await workspaceStore.addTagToActiveNote(tagName);
  closePicker();
}

async function removeTag(tagName: string): Promise<void> {
  await workspaceStore.removeTagFromActiveNote(tagName);
}

async function commitQuery(): Promise<void> {
  if (!normalizedQuery.value) {
    closePicker();
    return;
  }

  await addTag(normalizedQuery.value);
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!isPickerOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (rootRef.value?.contains(target)) {
    return;
  }

  closePicker();
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<style scoped>
.note-tag-bar {
  position: relative;
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 97%, var(--panel-hover));
}

.note-tag-bar__label {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.note-tag-bar__list {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.note-tag-bar__pill {
  max-width: 150px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px 0 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--panel-border));
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
  color: var(--text-muted);
  font-size: 0.74rem;
}

.note-tag-bar__pill-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-tag-bar__remove,
.note-tag-bar__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.note-tag-bar__remove {
  width: 16px;
  height: 16px;
  align-self: center;
  padding: 0;
  border-radius: 4px;
}

.note-tag-bar__icon {
  width: 1em;
  height: 1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.note-tag-bar__icon--remove {
  font-size: 13px;
  transform: translateY(0.5px);
}

.note-tag-bar__icon--add {
  font-size: 14px;
}

.note-tag-bar__icon :deep(.i-icon),
.note-tag-bar__icon :deep(svg) {
  display: block;
  flex: 0 0 auto;
}

.note-tag-bar__remove:hover,
.note-tag-bar__add:hover {
  color: var(--text);
  background: var(--panel-hover);
}

.note-tag-bar__add:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.note-tag-bar__add:disabled:hover {
  color: var(--text-muted);
  background: transparent;
}

.note-tag-bar__add {
  width: 24px;
  height: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
}

.note-tag-bar__picker {
  position: absolute;
  top: calc(100% + 4px);
  left: 12px;
  width: min(260px, calc(100% - 24px));
  z-index: 40;
  padding: 8px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
}

.note-tag-bar__input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--input-bg, var(--panel));
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
}

.note-tag-bar__input:focus {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--panel-border));
}

.note-tag-bar__suggestions {
  max-height: 190px;
  margin-top: 7px;
  overflow-y: auto;
}

.note-tag-bar__suggestion,
.note-tag-bar__create {
  width: 100%;
  height: 30px;
  display: flex;
  align-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.82rem;
}

.note-tag-bar__suggestion {
  justify-content: space-between;
  gap: 10px;
  padding: 0 8px;
}

.note-tag-bar__suggestion:hover,
.note-tag-bar__create:hover {
  background: var(--panel-hover);
}

.note-tag-bar__suggestion-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-tag-bar__suggestion-count {
  color: var(--text-muted);
  font-size: 0.74rem;
}

.note-tag-bar__create {
  margin-top: 6px;
  justify-content: flex-start;
  padding: 0 8px;
  color: var(--accent-hover);
}
</style>
