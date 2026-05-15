<template>
  <div class="app-search" :class="{ 'is-active': isFocused || searchQuery }" @click.stop @dblclick.stop>
    <div class="app-search__input-wrapper">
      <Search class="app-search__icon" theme="outline" :size="14" />
      <input ref="inputRef" v-model="searchQuery" type="text" class="app-search__input" :placeholder="t('search.placeholder')"
        @focus="handleFocus" @blur="handleBlur" @input="handleInput" @keydown.down.prevent="moveHighlight(1)"
        @keydown.up.prevent="moveHighlight(-1)" @keydown.enter="selectHighlighted" @keydown.esc="handleEsc" />
      <button v-if="searchQuery" class="app-search__clear" @click="clearSearch">
        <Close theme="outline" :size="12" />
      </button>
    </div>

    <transition name="dropdown-fade">
      <div v-if="showDropdown && results.length > 0" class="app-search__dropdown" @mouseenter="clearCloseTimer"
        @mouseleave="startCloseTimer" @click.stop @dblclick.stop>
        <div class="app-search__results">
          <div v-for="(result, index) in results" :key="result.id" class="app-search__result-item"
            :class="{ 'is-highlighted': highlightedIndex === index }" @click="selectResult(result)"
            @mouseenter="highlightedIndex = index">
            <div class="app-search__result-info">
              <FileText theme="outline" :size="14" class="app-search__result-icon" />
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
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Close, FileText } from '@icon-park/vue-next';
import { searchService, type SearchResult, type SearchMatch } from '@renderer/features/search/services/search.service';
import { useWorkspace } from '@renderer/features/workspace';
import { useAppShellStore } from '../store/appShell.store';

const { t } = useI18n();
const { selectNote } = useWorkspace();
const appShellStore = useAppShellStore();

const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const isFocused = ref(false);
const showDropdown = ref(false);
const highlightedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
let searchTimeout: number | null = null;
let closeTimer: number | null = null;

function handleFocus() {
  isFocused.value = true;
  if (searchQuery.value) {
    showDropdown.value = true;
  }
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
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const query = searchQuery.value.trim();
  if (!query) {
    results.value = [];
    showDropdown.value = false;
    return;
  }

  searchTimeout = window.setTimeout(async () => {
    results.value = await searchService.searchNotes(query);
    showDropdown.value = results.value.length > 0;
    highlightedIndex.value = 0;
  }, 300);
}

function clearSearch() {
  searchQuery.value = '';
  results.value = [];
  showDropdown.value = false;
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
  if (!showDropdown.value) return;
  highlightedIndex.value = (highlightedIndex.value + delta + results.value.length) % results.value.length;
}

function selectHighlighted() {
  if (showDropdown.value && results.value[highlightedIndex.value]) {
    selectResult(results.value[highlightedIndex.value]);
  }
}

async function selectResult(result: SearchResult) {
  await appShellStore.setActiveMainView('workspace');
  selectNote(result.id);
  
  // Dispatch jump event for highlighting if match exists
  if (result.matches.length > 0) {
    setTimeout(() => {
      const detail = { noteId: result.id, match: result.matches[0], title: result.title };
      window.dispatchEvent(new CustomEvent('workspace-search-jump', { detail }));
    }, 100);
  }
  
  showDropdown.value = false;
  searchQuery.value = '';
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

onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  clearCloseTimer();
});
</script>

<style scoped>
.app-search {
  position: relative;
  width: 420px;
  max-width: 800px;
  margin: 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-app-region: no-drag;
}

.app-search.is-active {
  width: 640px;
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
