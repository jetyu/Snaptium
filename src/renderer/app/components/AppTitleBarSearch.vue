<template>
  <div class="app-search" :class="{ 'is-active': isFocused || searchQuery }" @click.stop @dblclick.stop>
    <div class="app-search__input-wrapper">
      <IconSearch class="app-search__icon" :size="14" />
      <input ref="inputRef" v-model="searchQuery" type="text" class="app-search__input" role="combobox"
        aria-autocomplete="list" aria-haspopup="listbox" :aria-expanded="isDropdownVisible"
        :aria-controls="QUICK_SEARCH_LISTBOX_ID" :aria-activedescendant="activeOptionId"
        :placeholder="t('search.quickFindPlaceholder')" @focus="handleFocus" @blur="handleBlur" @input="handleInput"
        @keydown.down.prevent="moveHighlight(1)" @keydown.up.prevent="moveHighlight(-1)"
        @keydown.enter.prevent="selectHighlighted" @keydown.esc="handleEsc" />
      <button v-if="searchQuery" type="button" class="app-search__clear" :title="t('button.clear')"
        @mousedown.prevent @click="clearSearch">
        <IconX :size="12" />
      </button>
    </div>

    <transition name="dropdown-fade">
      <div v-if="isDropdownVisible" class="app-search__dropdown" @mouseenter="clearCloseTimer"
        @mouseleave="startCloseTimer" @click.stop @dblclick.stop>
        <p v-if="searchError" class="app-search__footer" role="alert">{{ searchError }}</p>
        <template v-else-if="isHistoryMode">
          <div class="app-search__history-header">
            <IconHistory :size="14" />
            <span>{{ t('search.quickHistory') }}</span>
          </div>
          <div :id="QUICK_SEARCH_LISTBOX_ID" class="app-search__results" role="listbox">
            <div v-for="(query, index) in searchHistory" :id="getHistoryOptionId(index)" :key="query"
              class="app-search__result-item app-search__history-item"
              :class="{ 'is-highlighted': highlightedIndex === index }" role="option"
              :aria-selected="highlightedIndex === index" @click="selectHistoryQuery(query)"
              @mouseenter="highlightedIndex = index">
              <div class="app-search__result-info app-search__history-info">
                <IconHistory :size="14" class="app-search__result-icon" />
                <span class="app-search__history-query">{{ query }}</span>
              </div>
              <button type="button" class="app-search__history-delete" :title="t('button.delete')"
                :aria-label="t('button.delete')" @mousedown.prevent @click.stop="deleteHistoryQuery(query)">
                <IconTrash :size="13" />
              </button>
            </div>
          </div>
          <div class="app-search__footer app-search__history-footer">
            <button type="button" class="app-search__clear-history" @mousedown.prevent @click="clearSearchHistory">
              {{ t('search.clearHistory') }}
            </button>
          </div>
        </template>
        <template v-else>
          <div :id="QUICK_SEARCH_LISTBOX_ID" class="app-search__results" role="listbox">
            <div v-for="(result, index) in results" :id="getResultOptionId(index)" :key="result.id"
              class="app-search__result-item" :class="{ 'is-highlighted': highlightedIndex === index }"
              role="option" :aria-selected="highlightedIndex === index" @click="selectResult(result)"
              @mouseenter="highlightedIndex = index">
              <div class="app-search__result-info">
                <IconFileText :size="14" class="app-search__result-icon" />
                <span class="app-search__result-title">{{ result.title }}</span>
              </div>
              <div v-if="result.matches.length > 0" class="app-search__result-match">
                <span class="app-search__match-text" v-html="highlightMatch(result.matches[0])"></span>
              </div>
            </div>
          </div>
          <div class="app-search__footer">
            <span class="app-search__hint">{{ t('search.pressEnterToSelect') }}</span>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconFileText, IconHistory, IconSearch, IconTrash, IconX } from '@tabler/icons-vue';
import { searchService, type SearchResult, type SearchMatch } from '@renderer/features/search/services/search.service';
import { useWorkspace } from '@renderer/features/workspace';
import { useAppShellStore } from '../store/appShell.store';
import { useSearch } from '@renderer/features/search';

const { t } = useI18n();
const { selectNote } = useWorkspace();
const appShellStore = useAppShellStore();
const { quickSearchRequest } = useSearch();

const QUICK_SEARCH_LISTBOX_ID = 'quick-search-listbox';
const searchQuery = ref('');
const searchError = ref('');
const results = ref<SearchResult[]>([]);
const searchHistory = ref<string[]>(searchService.quickHistory.list());
const isFocused = ref(false);
const showDropdown = ref(false);
const highlightedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
let searchTimeout: number | null = null;
let closeTimer: number | null = null;

const isHistoryMode = computed(() => searchQuery.value.trim().length === 0);
const activeItemCount = computed(() => {
  return isHistoryMode.value ? searchHistory.value.length : results.value.length;
});
const isDropdownVisible = computed(() => showDropdown.value && (activeItemCount.value > 0 || Boolean(searchError.value)));
const activeOptionId = computed<string | undefined>(() => {
  if (!isDropdownVisible.value) {
    return undefined;
  }

  return isHistoryMode.value
    ? getHistoryOptionId(highlightedIndex.value)
    : getResultOptionId(highlightedIndex.value);
});

function focusInput(selectAll = true) {
  clearCloseTimer();
  inputRef.value?.focus({ preventScroll: true });
  if (selectAll) {
    inputRef.value?.select();
  }
  showDropdown.value = activeItemCount.value > 0;
}

function handleFocus() {
  isFocused.value = true;
  showDropdown.value = activeItemCount.value > 0;
}

function handleBlur() {
  isFocused.value = false;
  startCloseTimer();
}

function handleEsc() {
  if (showDropdown.value) {
    showDropdown.value = false;
  } else {
    inputRef.value?.blur();
  }
}

function handleInput() {
  clearSearchTimeout();

  const query = searchQuery.value.trim();
  searchError.value = '';
  results.value = [];
  highlightedIndex.value = 0;
  if (!query) {
    showDropdown.value = searchHistory.value.length > 0;
    return;
  }

  showDropdown.value = false;
  searchTimeout = window.setTimeout(() => {
    searchTimeout = null;
    void runSearch(query);
  }, 300);
}

function clearSearch() {
  clearSearchTimeout();
  searchQuery.value = '';
  searchError.value = '';
  results.value = [];
  highlightedIndex.value = 0;
  showDropdown.value = isFocused.value && searchHistory.value.length > 0;
}

async function runSearch(query: string): Promise<void> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return;
  }

  let nextResults: SearchResult[];
  searchError.value = '';
  try {
    nextResults = await searchService.searchNotes(normalizedQuery);
  } catch {
    if (searchQuery.value.trim() === normalizedQuery) {
      results.value = [];
      searchError.value = t('search.error.incomplete');
      showDropdown.value = isFocused.value;
    }
    return;
  }
  if (searchQuery.value.trim() !== normalizedQuery) {
    return;
  }

  results.value = nextResults;
  highlightedIndex.value = 0;
  showDropdown.value = isFocused.value && nextResults.length > 0;
}

function clearSearchTimeout(): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
}

function startCloseTimer() {
  clearCloseTimer();
  closeTimer = window.setTimeout(() => {
    showDropdown.value = false;
  }, 200);
}

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function moveHighlight(delta: number) {
  if (!isDropdownVisible.value || activeItemCount.value === 0) return;
  highlightedIndex.value = (
    highlightedIndex.value + delta + activeItemCount.value
  ) % activeItemCount.value;
}

function selectHighlighted() {
  if (!isDropdownVisible.value) {
    return;
  }

  if (isHistoryMode.value) {
    const query = searchHistory.value[highlightedIndex.value];
    if (query) {
      selectHistoryQuery(query);
    }
    return;
  }

  const result = results.value[highlightedIndex.value];
  if (result) {
    void selectResult(result);
  }
}

function selectHistoryQuery(query: string): void {
  clearSearchTimeout();
  clearCloseTimer();
  searchQuery.value = query;
  results.value = [];
  highlightedIndex.value = 0;
  showDropdown.value = false;
  inputRef.value?.focus({ preventScroll: true });
  void runSearch(query);
}

function deleteHistoryQuery(query: string): void {
  searchHistory.value = searchService.quickHistory.remove(query);
  highlightedIndex.value = Math.min(
    highlightedIndex.value,
    Math.max(0, searchHistory.value.length - 1),
  );
  showDropdown.value = searchHistory.value.length > 0;
  void nextTick(() => inputRef.value?.focus({ preventScroll: true }));
}

function clearSearchHistory(): void {
  searchHistory.value = searchService.quickHistory.clear();
  highlightedIndex.value = 0;
  showDropdown.value = false;
  void nextTick(() => inputRef.value?.focus({ preventScroll: true }));
}

async function selectResult(result: SearchResult) {
  const query = searchQuery.value.trim();
  await appShellStore.setActiveMainView('workspace');
  selectNote(result.id);
  searchHistory.value = searchService.quickHistory.record(query);

  // Dispatch jump event for highlighting if match exists
  if (result.matches.length > 0) {
    setTimeout(() => {
      const detail = { noteId: result.id, match: result.matches[0], title: result.title };
      window.dispatchEvent(new CustomEvent('workspace-search-jump', { detail }));
    }, 100);
  }

  showDropdown.value = false;
  searchQuery.value = '';
  searchError.value = '';
  results.value = [];
  highlightedIndex.value = 0;
}

function getHistoryOptionId(index: number): string {
  return `quick-search-history-${index}`;
}

function getResultOptionId(index: number): string {
  return `quick-search-result-${index}`;
}

function highlightMatch(match: SearchMatch): string {
  const { text, matchStart, matchEnd } = match;
  const before = escapeHtml(text.substring(Math.max(0, matchStart - 20), matchStart));
  const matched = escapeHtml(text.substring(matchStart, matchEnd));
  const after = escapeHtml(text.substring(matchEnd, matchEnd + 40));
  return `...${before}<mark>${matched}</mark>${after}...`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

watch(
  () => quickSearchRequest.value.id,
  () => {
    void nextTick(() => {
      focusInput(quickSearchRequest.value.selectAll);
    });
  },
);

onBeforeUnmount(() => {
  clearSearchTimeout();
  clearCloseTimer();
});
</script>

<style scoped>
.app-search {
  position: relative;
  width: 38%;
  min-width: 320px;
  max-width: 600px;
  margin: 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-search.is-active {
  width: 60%;
  max-width: 900px;
}

.app-search__input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  border-radius: 8px;
  padding: 0 8px;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

[data-theme='dark'] .app-search__input-wrapper {
  background: color-mix(in srgb, #ffffff 6%, transparent);
}

.app-search__input-wrapper:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.app-search.is-active .app-search__input-wrapper {
  background: var(--panel);
  box-shadow: 0 0 0 1px var(--accent), 0 4px 12px rgba(0, 0, 0, 0.08);
}

.app-search__icon {
  color: var(--text-muted);
  margin-right: 6px;
  flex-shrink: 0;
}

.app-search__input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 0.78rem;
  outline: none;
  width: 100%;
}

.app-search__input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.app-search__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  margin-left: 4px;
}

.app-search__clear:hover {
  background: color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--text);
}

.app-search__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  backdrop-filter: blur(20px);
}

[data-theme='dark'] .app-search__dropdown {
  background: color-mix(in srgb, var(--panel) 95%, black);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

.app-search__history-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.app-search__results {
  max-height: 400px;
  overflow-y: auto;
  padding: 6px;
}

.app-search__result-item {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-search__result-item:hover,
.app-search__result-item.is-highlighted {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

[data-theme='dark'] .app-search__result-item:hover,
[data-theme='dark'] .app-search__result-item.is-highlighted {
  background: color-mix(in srgb, #ffffff 8%, transparent);
}

.app-search__history-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
}

.app-search__history-info {
  min-width: 0;
}

.app-search__history-query {
  overflow: hidden;
  color: var(--text);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-search__history-delete {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.app-search__history-item:hover .app-search__history-delete,
.app-search__history-item.is-highlighted .app-search__history-delete,
.app-search__history-delete:focus-visible {
  opacity: 1;
}

.app-search__history-delete:hover,
.app-search__history-delete:focus-visible {
  background: color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--text);
  outline: none;
}

.app-search__result-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-search__result-icon {
  color: var(--text-muted);
}

.app-search__result-title {
  font-size: 0.82rem;
  font-weight: 550;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-search__result-match {
  font-size: 0.72rem;
  color: var(--text-muted);
  padding-left: 22px;
}

.app-search__result-match :deep(mark) {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  font-weight: 600;
  padding: 0 2px;
  border-radius: 2px;
}

.app-search__footer {
  padding: 8px 12px;
  border-top: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--text) 2%, transparent);
  text-align: right;
}

.app-search__history-footer {
  display: flex;
  justify-content: flex-end;
}

.app-search__clear-history {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.68rem;
  cursor: pointer;
}

.app-search__clear-history:hover,
.app-search__clear-history:focus-visible {
  color: var(--text);
  text-decoration: underline;
  outline: none;
}

.app-search__hint {
  font-size: 0.68rem;
  color: var(--text-muted);
  opacity: 0.8;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
