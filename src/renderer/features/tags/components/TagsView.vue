<template>
  <div class="tags-view panel">
    <aside class="tags-view__sidebar">
      <header class="tags-view__header">
        <h1 class="tags-view__title">{{ t('tags.title') }}</h1>
      </header>

      <div class="tags-view__search">
        <input v-model="tagQuery" class="tags-view__search-input" type="search"
          :placeholder="t('tags.searchPlaceholder')" />
      </div>

      <div class="tags-view__filters">
        <button type="button" class="tags-view__filter" :class="{ 'is-active': selectedFilter.kind === 'tagged' }"
          @click="selectedFilter = { kind: 'tagged' }">
          <span class="tags-view__filter-icon">
            <TagOne theme="outline" :size="15" />
          </span>
          <span class="tags-view__filter-name">{{ t('tags.allTagged') }}</span>
          <span class="tags-view__filter-count">{{ taggedNotes.length }}</span>
        </button>

        <button type="button" class="tags-view__filter" :class="{ 'is-active': selectedFilter.kind === 'untagged' }"
          @click="selectedFilter = { kind: 'untagged' }">
          <span class="tags-view__filter-icon">
            <TagOne theme="outline" :size="15" />
          </span>
          <span class="tags-view__filter-name">{{ t('tags.untagged') }}</span>
          <span class="tags-view__filter-count">{{ untaggedNotes.length }}</span>
        </button>
      </div>

      <div class="tags-view__tag-list" role="list">
        <button v-for="tag in filteredTags" :key="tag.name" type="button" class="tags-view__tag"
          :class="{ 'is-active': selectedFilter.kind === 'tag' && selectedFilter.name === tag.name }"
          @click="selectedFilter = { kind: 'tag', name: tag.name }">
          <span class="tags-view__tag-name">#{{ tag.name }}</span>
          <span class="tags-view__tag-count">{{ tag.count }}</span>
        </button>
      </div>

      <div v-if="filteredTags.length === 0" class="tags-view__empty">
        {{ t('tags.emptyTagList') }}
      </div>
    </aside>

    <main class="tags-view__main">
      <header class="tags-view__main-header">
        <div class="tags-view__title-stack">
          <h2 class="tags-view__heading">{{ t('tags.notesTitle', { selectedTitle: selectedTitle }) }}
          </h2>
        </div>
        <span class="tags-view__note-count">{{ t('tags.noteCount', { count: selectedNotes.length }) }}</span>
      </header>

      <div class="tags-view__main-content">
        <section class="tags-view__notes-pane">
          <div v-if="selectedNotes.length > 0" class="tags-view__notes">
            <button v-for="note in selectedNotes" :key="note.id" type="button" class="tags-view__note"
              @click="openNote(note.id)">
              <div class="tags-view__note-icon">
                <FileLockOne v-if="note.locked" theme="outline" :size="17" />
                <Notes v-else theme="outline" :size="17" />
              </div>
              <div class="tags-view__note-body">
                <div class="tags-view__note-row">
                  <span class="tags-view__note-title">{{ note.title }}</span>
                  <span class="tags-view__note-date">{{ formatNoteDate(note.updatedAt) }}</span>
                </div>
                <p class="tags-view__note-preview">{{ getNotePreview(note.content) }}</p>
              </div>
            </button>
          </div>
          <div v-else class="tags-view__empty-state">
            {{ t('tags.emptyNotes') }}
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { TagOne, Notes, FileLockOne } from '@icon-park/vue-next';
import { formatDate } from '@renderer/core/utils/date.utils';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { normalizeNoteTags, type Note } from '@renderer/features/workspace/services/workspace.service';

type TagFilter =
  | { kind: 'tagged' }
  | { kind: 'untagged' }
  | { kind: 'tag'; name: string };

const workspaceStore = useWorkspaceStore();
const appShellStore = useAppShellStore();
const { t, locale } = useI18n();

const tagQuery = ref('');
const selectedFilter = ref<TagFilter>({ kind: 'tagged' });

const taggedNotes = computed<Note[]>(() => {
  return workspaceStore.notes.filter((note) => normalizeNoteTags(note.tags).length > 0);
});

const untaggedNotes = computed<Note[]>(() => {
  return workspaceStore.notes.filter((note) => normalizeNoteTags(note.tags).length === 0);
});

const filteredTags = computed(() => {
  const query = tagQuery.value.trim().toLocaleLowerCase();
  const tags = workspaceStore.allTags;

  if (!query) {
    return tags;
  }

  return tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query));
});

const selectedTitle = computed(() => {
  switch (selectedFilter.value.kind) {
    case 'tag':
      return `#${selectedFilter.value.name}`;
    case 'untagged':
      return t('tags.untagged');
    case 'tagged':
    default:
      return t('tags.allTagged');
  }
});

const selectedNotes = computed<Note[]>(() => {
  const filter = selectedFilter.value;
  const notes = workspaceStore.notes.filter((note) => {
    const noteTags = normalizeNoteTags(note.tags);

    switch (filter.kind) {
      case 'tag':
        return noteTags.some((tag) => tag.toLocaleLowerCase() === filter.name.toLocaleLowerCase());
      case 'untagged':
        return noteTags.length === 0;
      case 'tagged':
      default:
        return noteTags.length > 0;
    }
  });

  return notes.sort((left, right) => right.updatedAt - left.updatedAt);
});

function getNotePreview(content: string): string {
  const preview = content
    .replace(/[#*_>`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return preview || t('tags.emptyPreview');
}

function formatNoteDate(timestamp: number): string {
  return formatDate(timestamp, locale.value);
}

async function openNote(noteId: string): Promise<void> {
  workspaceStore.selectNote(noteId);
  await appShellStore.setActiveMainView('workspace');
}

watch(
  () => workspaceStore.allTags,
  (tags) => {
    const filter = selectedFilter.value;
    if (filter.kind === 'tag' && !tags.some((tag) => tag.name === filter.name)) {
      selectedFilter.value = tags.length > 0 ? { kind: 'tag', name: tags[0].name } : { kind: 'tagged' };
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.tags-view {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--panel);
}

.tags-view__sidebar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 96%, var(--panel-hover));
}

.tags-view__header,
.tags-view__main-header {
  min-height: var(--col-header-h, 60px);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--panel-border);
}

.tags-view__header {
  padding: 0 18px;
}

.tags-view__title,
.tags-view__heading {
  margin: 0;
  color: var(--text);
}

.tags-view__title-stack {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tags-view__title {
  font-size: 1rem;
  font-weight: 650;
}

.tags-view__search {
  padding: 12px 14px 8px;
}

.tags-view__search-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--input-bg, var(--panel));
  color: var(--text);
  font-size: 0.84rem;
  outline: none;
}

.tags-view__search-input:focus {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--panel-border));
}

.tags-view__filters {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 10px 10px;
}

.tags-view__filter,
.tags-view__tag {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.tags-view__filter {
  min-height: 34px;
  padding: 0 9px;
}

.tags-view__filter:hover,
.tags-view__tag:hover,
.tags-view__filter.is-active,
.tags-view__tag.is-active {
  background: var(--panel-hover);
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
}

.tags-view__filter-icon {
  width: 18px;
  display: inline-flex;
  justify-content: center;
  flex: 0 0 auto;
}

.tags-view__filter-name,
.tags-view__tag-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.tags-view__filter-count,
.tags-view__tag-count,
.tags-view__note-count {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.tags-view__tag-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 12px;
}

.tags-view__tag {
  min-height: 32px;
  padding: 0 10px;
  margin-bottom: 4px;
  font-size: 0.84rem;
}

.tags-view__main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tags-view__main-header {
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
}

.tags-view__main-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tags-view__notes-pane {
  min-height: 0;
}

.tags-view__heading {
  max-width: min(58vw, 720px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.05rem;
  font-weight: 650;
}

.tags-view__notes {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tags-view__note {
  width: 100%;
  min-width: 0;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--panel-border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.tags-view__note:hover {
  background: var(--panel-hover);
}

.tags-view__note-icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--text-muted);
}

.tags-view__note-body {
  min-width: 0;
  flex: 1;
}

.tags-view__note-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tags-view__note-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
}

.tags-view__note-date {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.tags-view__note-preview {
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  font-size: 0.82rem;
  line-height: 1.45;
}

.tags-view__empty,
.tags-view__empty-state {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.tags-view__empty {
  padding: 10px 18px 18px;
}

.tags-view__empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

@media (max-width: 780px) {
  .tags-view {
    grid-template-columns: minmax(170px, 34vw) minmax(0, 1fr);
  }

  .tags-view__main-header {
    padding: 0 16px;
  }
}
</style>
