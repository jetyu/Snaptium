import { readonly, ref } from 'vue';
import { useAppShellStore } from '@renderer/app/store/appShell.store';

export type SearchMode = 'semantic';

export interface OpenSearchViewOptions {
  query?: string;
  mode?: SearchMode;
  run?: boolean;
}

export interface SearchViewRequest {
  id: number;
  query: string;
  mode: SearchMode;
  run: boolean;
}

export interface QuickSearchRequest {
  id: number;
  selectAll: boolean;
}

export interface RequestQuickSearchOptions {
  selectAll?: boolean;
}

const searchViewRequest = ref<SearchViewRequest>({
  id: 0,
  query: '',
  mode: 'semantic',
  run: false,
});

const quickSearchRequest = ref<QuickSearchRequest>({
  id: 0,
  selectAll: true,
});

export function useSearch() {
  const openSearchView = async (options: OpenSearchViewOptions = {}): Promise<void> => {
    const query = options.query ?? '';
    searchViewRequest.value = {
      id: searchViewRequest.value.id + 1,
      query,
      mode: options.mode ?? 'semantic',
      run: options.run ?? Boolean(query.trim()),
    };

    await useAppShellStore().setActiveMainView('search');
  };

  const requestFocusQuickSearch = (options: RequestQuickSearchOptions = {}): void => {
    quickSearchRequest.value = {
      id: quickSearchRequest.value.id + 1,
      selectAll: options.selectAll ?? true,
    };
  };

  return {
    searchViewRequest: readonly(searchViewRequest),
    quickSearchRequest: readonly(quickSearchRequest),
    openSearchView,
    requestFocusQuickSearch,
  };
}
