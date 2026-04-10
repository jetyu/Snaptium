<template>
  <Teleport to="body">
    <div v-if="isOpen" class="search-overlay">
      <div class="search-dialog">
        <div class="search-header">
          <div class="search-input-row">
            <div class="search-input-wrapper">
              <input ref="searchInput" v-model="searchQuery" type="text" class="search-input"
                :placeholder="useSemanticSearch ? $t('search.semanticPlaceholder') : $t('search.placeholder')"
                @input="onInput" @keydown.enter="handleSearch(true)" @keydown.esc="close" />
              <button v-if="searchQuery" class="btn-clear" @click="searchQuery = ''; searchInput?.focus()"
                :title="$t('common.clear')">
                <Close theme="outline" :size="14" />
              </button>
            </div>
            <button class="btn-search" @click="handleSearch(true)" :title="$t('search.search')">
              <Search theme="outline" :size="18" />
            </button>
            <button class="btn-close" @click="close" :title="$t('common.close')">
              <Close theme="outline" :size="18" />
            </button>
          </div>
          <button v-if="ragAvailable" type="button" class="startup-switch"
            :class="{ enabled: useSemanticSearch }"
            @click="useSemanticSearch = !useSemanticSearch; handleSearchModeChange()">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ $t('search.semanticSearch') }}
            </span>
          </button>
        </div>

        <div class="search-results">
          <div v-if="useSemanticSearch && (isAIGenerating || aiAnswer)" class="ai-answer-section">
            <div class="ai-answer-header">
              <span class="ai-icon">
                <Search theme="outline" size="14" />
              </span>
              {{ $t('label.aiRAGSearch') }}
            </div>

            <div v-if="isAIGenerating" class="ai-generating">
              <div class="loading-spinner small"></div>
              <span>{{ $t('label.aiRAGThinking') }}</span>
            </div>

            <div v-else-if="aiAnswer" class="ai-answer-wrapper">
              <div class="ai-answer-content">
                {{ aiAnswer }}
              </div>

              <div v-if="uniqueSources.length > 0" class="ai-sources">
                <div class="ai-sources-label">{{ $t('label.aiRAGRelevanceSource') }}</div>
                <div class="sources-list">
                  <div v-for="source in uniqueSources" :key="source.noteId" class="source-tag"
                    @click="selectSemanticResult(source.originalResult)">
                    <FileText theme="outline" size="12" fill="currentColor" />
                    <span class="source-name">{{ source.noteTitle }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="isSearching" class="search-status">
            <div class="loading-spinner"></div>
            <div class="status-text">
              {{ useSemanticSearch ? $t('search.semanticSearching') : $t('search.searching') }}
            </div>
          </div>
          <div v-else-if="searchError" class="search-status">
            <div class="status-text error-text">{{ searchError }}</div>
          </div>
          <div
            v-else-if="hasSearched && searchQuery && (useSemanticSearch ? semanticResults.length === 0 : results.length === 0)"
            class="search-status">
            <div class="empty-icon"></div>
            <div class="status-text">{{ useSemanticSearch ? $t('search.noResultsSemantic') : $t('search.noResultsLocal')
            }}</div>
          </div>
          <div v-else-if="(!searchQuery || !hasSearched) && (!semanticResults.length && !results.length && !aiAnswer)"
            class="search-status search-hint">
            <div class="hint-text">
              {{ useSemanticSearch ? $t('search.semanticHint') : $t('search.typeToSearch') }}
            </div>
          </div>
          <div v-else-if="!useSemanticSearch" class="results-list">
            <div v-for="result in results" :key="result.id" class="result-item" @click="selectResult(result)">
              <div class="result-title">
                <span v-html="highlightText(result.title, searchQuery)"></span>
                <span v-if="result.titleMatch" class="title-badge">{{ $t('search.titleMatch') }}</span>
              </div>
              <div v-if="result.matches.length > 0" class="result-matches">
                <div v-for="(match, idx) in result.matches.slice(0, 3)" :key="idx" class="match-line"
                  @click.stop="selectMatch(result, match)">
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
import { ref, watch, nextTick, computed } from 'vue';
import { Close, FileText, Search } from '@icon-park/vue-next';
import { useRAGSearch, useRAGConfig, useRAGChat } from '@renderer/features/rag';
import { createLogger } from '@renderer/features/logger';
import { searchService } from '../services/search.service';

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

interface SemanticSearchResult {
  chunk: {
    id: string;
    noteId: string;
    content: string;
    startPos: number;
    endPos: number;
  };
  score: number;
  noteTitle?: string;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [result: SearchResult | SemanticSearchResult, match?: SearchMatch];
}>();
const searchDialogLogger = createLogger('SearchDialog');

const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const semanticResults = ref<SemanticSearchResult[]>([]);
const isSearching = ref(false);
const hasSearched = ref(false);
const searchError = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const useSemanticSearch = ref(false);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const { search: ragSearch } = useRAGSearch();
const { isEnabled: ragEnabled, isConfigured: ragConfigured } = useRAGConfig();
const { askQuestion, isGenerating: isAIGenerating, answer: aiAnswer } = useRAGChat();
const ragAvailable = computed(() => ragEnabled.value && ragConfigured.value);
const uniqueSources = computed(() => {
  const sourcesMap = new Map<string, { noteId: string; noteTitle: string; originalResult: SemanticSearchResult }>();

  semanticResults.value.forEach(result => {
    const noteId = result.chunk.noteId;
    if (!sourcesMap.has(noteId)) {
      sourcesMap.set(noteId, {
        noteId,
        noteTitle: result.noteTitle || 'Untitled Note',
        originalResult: result,
      });
    }
  });

  return Array.from(sourcesMap.values());
});

watch(() => props.isOpen, (open) => {
  if (open) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    searchQuery.value = '';
    results.value = [];
    semanticResults.value = [];
    aiAnswer.value = '';
    searchError.value = '';
  }
});

function close() {
  emit('close');
}

function handleSearchModeChange() {
  if (searchQuery.value.trim()) {
    handleSearch();
  }
}

function onInput() {
  hasSearched.value = false;
  if (!useSemanticSearch.value) {
    handleSearch(false);
  }
}

async function handleSearch(isExplicitTrigger = true) {
  if (useSemanticSearch.value && !isExplicitTrigger) {
    return;
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const query = searchQuery.value.trim();
  if (!query) {
    results.value = [];
    semanticResults.value = [];
    searchError.value = '';
    isSearching.value = false;
    return;
  }

  const delay = isExplicitTrigger ? 0 : 300;
  searchTimeout = setTimeout(async () => {
    isSearching.value = true;
    hasSearched.value = false;
    aiAnswer.value = '';
    searchError.value = '';
    try {
      if (useSemanticSearch.value && ragAvailable.value) {
        const ragResults = await ragSearch(query);
        semanticResults.value = ragResults;
        results.value = [];
        if (ragResults.length > 0) {
          try {
            await askQuestion(query);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            searchDialogLogger.error(`AI answer generation failed: ${message}`);
            searchError.value = message;
          }
        }
      } else {
        const searchResults = await searchService.searchNotes(query);
        results.value = searchResults || [];
        semanticResults.value = [];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      searchDialogLogger.error(`Search error: ${message}`);
      searchError.value = message;
      results.value = [];
      semanticResults.value = [];
    } finally {
      isSearching.value = false;
      hasSearched.value = true; // 搜索完成
    }
  }, delay);
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

function selectSemanticResult(result: SemanticSearchResult) {
  emit('select', result);
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
  height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.search-status,
.search-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
}

.search-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 10px 30px 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-header :deep(.startup-switch) {
  align-self: flex-start;
  margin-left: 2px;
}

.btn-close,
.btn-search {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
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

.btn-clear {
  position: absolute;
  right: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
}

.btn-close:hover,
.btn-search:hover,
.btn-clear:hover {
  background: var(--panel-hover);
  color: var(--text);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.ai-answer-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.ai-answer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 13px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-icon {
  display: flex;
  align-items: center;
}

.ai-generating {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  color: var(--text-muted);
  font-size: 14px;
}

.ai-answer-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-answer-content {
  line-height: 1.7;
  font-size: 14.5px;
  color: var(--text);
  white-space: pre-wrap;
}

.ai-sources {
  padding-top: 12px;
  border-top: 1px dashed var(--color-border);
}

.ai-sources-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 600;
}

.sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--panel-hover);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.source-tag:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg));
  transform: translateY(-1px);
}

.source-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: white;
}

.search-status {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-size: 14px;
  color: var(--text-muted);
}

.error-text {
  color: var(--color-danger, #ef4444);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.search-hint {
  padding: 60px 20px;
}

.hint-icon {
  font-size: 56px;
  opacity: 0.3;
  margin-bottom: 16px;
}

.hint-text {
  font-size: 15px;
  color: var(--text-muted);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.semantic-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.semantic-result-item {
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s;
}

.semantic-result-item:hover {
  background: var(--panel-hover);
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 12px;
}

.note-icon {
  font-size: 16px;
  margin-right: 6px;
}

.similarity-score {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.score-icon {
  font-size: 13px;
}

.score-excellent {
  background: color-mix(in srgb, #10b981 20%, transparent);
  color: #10b981;
}

.score-good {
  background: color-mix(in srgb, #3b82f6 20%, transparent);
  color: #3b82f6;
}

.score-fair {
  background: color-mix(in srgb, #f59e0b 20%, transparent);
  color: #f59e0b;
}

.score-low {
  background: color-mix(in srgb, #6b7280 20%, transparent);
  color: #6b7280;
}

.result-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.result-meta {
  font-size: 12px;
  color: var(--text-muted);
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
