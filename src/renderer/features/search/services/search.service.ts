import { electronApi } from '@renderer/core/bridge/electronApi';

export interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  id: string;
  contentId: string;
  title: string;
  matches: SearchMatch[];
  titleMatch: boolean;
}

export const searchService = {
  searchNotes: (query: string): Promise<SearchResult[]> =>
    electronApi.search.searchNotes(query),
};
