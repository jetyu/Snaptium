export { default as SearchView } from './components/SearchView.vue';
export { useSearch } from './composables/useSearch';
export type {
  OpenSearchViewOptions,
  SearchMode,
  SearchViewRequest,
  QuickSearchRequest,
  RequestQuickSearchOptions,
} from './composables/useSearch';
export { searchService } from './services/search.service';
