<template>
  <Teleport to="body">
    <div v-if="isOpen" class="search-overlay" @click="close">
      <div class="search-dialog" @click.stop>
        <div class="search-header">
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="$t('search.placeholder')"
            @input="handleSearch"
            @keydown.esc="close"
          />
          <button class="btn-close" @click="close" :title="$t('close')">
            <Close theme="outline" :size="16" />
          </button>
        </div>

        <div class="search-results">
          <div v-if="isSearching" class="search-status">
            {{ $t('search.searching') }}
          </div>
          <div v-else-if="searchQuery && results.length === 0" class="search-status">
            {{ $t('search.noResults') }}
          </div>
          <div v-else-if="!searchQuery" class="search-status">
            {{ $t('search.typeToSearch') }}
          </div>
          <div v-else class="results-list">
            <div
              v-for="result in results"
              :key="result.id"
              class="result-item"
              @click="selectResult(result)"
            >
              <div class="result-title">
                <span v-html="highlightText(result.title, searchQuery)"></span>
                <span v-if="result.titleMatch" class="title-badge">{{ $t('search.titleMatch') }}</span>
              </div>
              <div v-if="result.matches.length > 0" class="result-matches">
                <div
                  v-for="(match, idx) in result.matches.slice(0, 3)"
                  :key="idx"
                  class="match-line"
                  @click.stop="selectMatch(result, match)"
                >
                  <span class="match-line-number">{{ match.line }}</span>
                  <span class="match-text" v-html="highlightMatch(match)"></span>
                </div>
                <div v-if="result.matches.length > 3" class="more-matches">
                  +{{ result.matches.length - 3 }} {{ $t('search.moreMatches') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Close } from '@icon-park/vue-next';

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchResult {
  id: string;
  contentId: string;
  title: string;
  matches: SearchMatch[];
  titleMatch: boolean;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [result: SearchResult, match?: SearchMatch];
}>();

const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const isSearching = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

watch(() => props.isOpen, (open) => {
  if (open) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    searchQuery.value = '';
    results.value = [];
  }
});

function close() {
  emit('close');
}

async function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const query = searchQuery.value.trim();
  if (!query) {
    results.value = [];
    return;
  }

  searchTimeout = setTimeout(async () => {
    isSearching.value = true;
    try {
      const searchResults = await window.electronAPI.search?.searchNotes(query);
      results.value = searchResults || [];
    } catch (error) {
      console.error('Search error:', error);
      results.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 300);
}

function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function highlightMatch(match: SearchMatch): string {
  const { text, matchStart, matchEnd } = match;
  const before = escapeHtml(text.substring(0, matchStart));
  const matched = escapeHtml(text.substring(matchStart, matchEnd));
  const after = escapeHtml(text.substring(matchEnd));
  return `${before}<mark>${matched}</mark>${after}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectResult(result: SearchResult) {
  emit('select', result);
  close();
}

function selectMatch(result: SearchResult, match: SearchMatch) {
  emit('select', result, match);
  close();
}
</script>

<style scoped>
.search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 1000;
}

.search-dialog {
  background: var(--panel);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent);
}

.btn-close {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-close:hover {
  background: var(--panel-hover);
  color: var(--text);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-status {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: var(--panel-hover);
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.title-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent);
  color: white;
}

.result-matches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.match-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  background: var(--bg);
  cursor: pointer;
  transition: background 0.15s;
}

.match-line:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
}

.match-line-number {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 12px;
  min-width: 30px;
  text-align: right;
}

.match-text {
  flex: 1;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-matches {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

:deep(mark) {
  background: #ffd700;
  color: #000;
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: 600;
}
</style>
