import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { vfsService } from '../services/vfs.service.js';

export function registerSearchIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.SEARCH_NOTES);

  ipcMain.handle(IPC_CHANNELS.SEARCH_NOTES, async (_event, query) => {
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
          // Skip notes that can't be read
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  });
}
