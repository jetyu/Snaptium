import { $t } from '../utils/i18n.js';
import { vfsService } from './vfs.service.js';
import { loggerService } from './log/logger.service.js';
import { getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Main:Search Service');

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchResultItem {
  id: string;
  contentId: string;
  title: string;
  matches: SearchMatch[];
  titleMatch: boolean;
}

interface SearchableNode {
  id: string;
  type: string;
  name: string;
  contentId?: string;
  trashed?: boolean;
}

class SearchService {
  async searchNotes(query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();
    const results: Array<SearchResultItem | undefined> = [];
    let failedReads = 0;

    try {
      await vfsService.ensureInitialized();
      const allNodes = vfsService.getAllNodes() as SearchableNode[];

      let cursor = 0;
      const searchNext = async (): Promise<void> => {
        while (cursor < allNodes.length) {
          const index = cursor++;
          const node = allNodes[index];
          if (node.type !== 'file' || typeof node.contentId !== 'string' || node.trashed) continue;
          try {
            const content = await vfsService.readContent(node.contentId);
            const lines = content.split('\n');
            const matches: SearchMatch[] = [];
            const titleMatch = node.name.toLowerCase().includes(searchTerm);

            lines.forEach((line: string, lineIndex: number) => {
              const lowerLine = line.toLowerCase();
              let startIndex = 0;
              let matchIndex = lowerLine.indexOf(searchTerm, startIndex);

              while (matchIndex !== -1) {
                matches.push({
                  line: lineIndex + 1,
                  column: matchIndex,
                  text: line,
                  matchStart: matchIndex,
                  matchEnd: matchIndex + searchTerm.length,
                });
                startIndex = matchIndex + 1;
                matchIndex = lowerLine.indexOf(searchTerm, startIndex);
              }
            });

            if (titleMatch || matches.length > 0) {
              results[index] = {
                id: node.id,
                contentId: node.contentId,
                title: node.name,
                matches,
                titleMatch,
              };
            }
          } catch (error: unknown) {
            failedReads += 1;
            logger.warn(`Failed to search note ${node.id}: ${getErrorMessage(error)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, allNodes.length) }, () => searchNext()));
      if (failedReads > 0) throw new Error($t('search.error.incomplete'));
      return results.filter((result): result is SearchResultItem => result !== undefined);
    } catch (error) {
      logger.error('Search operation failed', { error: getErrorMessage(error), query });
      throw error;
    }
  }
}

export const searchService = new SearchService();
