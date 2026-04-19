import { vfsService } from './vfs.service.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Main:Search Service');

/**
 * Search Service - Execution Layer
 * Provides atomic search capabilities across notes.
 */
class SearchService {
  /**
   * Search in all notes (Atomic)
   * @param {string} query - Search term
   * @returns {Promise<Array<Object>>} Search results
   */
  async searchNotes(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();
    const results = [];

    try {
      await vfsService.ensureInitialized();
      const allNodes = vfsService.getAllNodes();

      for (const node of allNodes) {
        if (node.type !== 'file' || !node.contentId || node.trashed) {
          continue;
        }

        try {
          const content = await vfsService.readContent(node.contentId);
          const lines = content.split('\n');
          const matches = [];

          // Search in title
          const titleMatch = node.name.toLowerCase().includes(searchTerm);

          // Search in content
          lines.forEach((line, lineIndex) => {
            const lowerLine = line.toLowerCase();
            let startIndex = 0;
            let matchIndex;

            while ((matchIndex = lowerLine.indexOf(searchTerm, startIndex)) !== -1) {
              matches.push({
                line: lineIndex + 1,
                column: matchIndex,
                text: line,
                matchStart: matchIndex,
                matchEnd: matchIndex + searchTerm.length,
              });
              startIndex = matchIndex + 1;
            }
          });

          if (titleMatch || matches.length > 0) {
            results.push({
              id: node.id,
              contentId: node.contentId,
              title: node.name,
              matches,
              titleMatch,
            });
          }
        } catch (error) {
          // Skip file on error (e.g., read failed)
          continue;
        }
      }

      return results;
    } catch (error) {
      logger.error('Search operation failed', { error: error.message, query });
      throw error;
    }
  }
}

export const searchService = new SearchService();
