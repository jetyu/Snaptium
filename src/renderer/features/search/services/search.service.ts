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
  score?: number; // Added score for orchestration
}

/**
 * Search Service - Orchestration Layer
 * Handles search logic and result processing.
 */
export const searchService = {
  /**
   * Search notes and process results (Orchestration)
   */
  async searchNotes(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const results = await electronApi.search.searchNotes(query);

    // Orchestration: Sort results by title match priority and number of matches
    return results.sort((a, b) => {
      if (a.titleMatch && !b.titleMatch) return -1;
      if (!a.titleMatch && b.titleMatch) return 1;
      return b.matches.length - a.matches.length;
    });
  },
};
