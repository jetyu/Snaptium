import { defineStore } from 'pinia';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import {
  workspaceService,
  type StarredNode,
  type StarredNote,
  type StarredNotebook,
} from '../../workspace/services/workspace.service';
import { useWorkspaceStore } from '../../workspace/store/workspace.store';

const logger = createLogger('Favorites Store');
let hasFavoritesVfsListener = false;

function isStarredNote(node: StarredNode): node is StarredNote {
  return node.kind === 'note';
}

function isStarredNotebook(node: StarredNode): node is StarredNotebook {
  return node.kind === 'notebook';
}

export const useFavoritesStore = defineStore('favorites', {
  state: () => ({
    starredNodes: [] as StarredNode[],
    loading: false,
    initialized: false,
  }),

  getters: {
    starredNotes: (state): StarredNote[] => state.starredNodes.filter(isStarredNote),
    starredNotebooks: (state): StarredNotebook[] => state.starredNodes.filter(isStarredNotebook),
    sortedStarredNotes(): StarredNote[] {
      return [...this.starredNotes].sort((a, b) => b.starredAt - a.starredAt);
    },
    sortedStarredNotebooks(): StarredNotebook[] {
      return [...this.starredNotebooks].sort((a, b) => b.starredAt - a.starredAt);
    },
    totalCount: (state): number => state.starredNodes.length,
    starredNoteIds: (state): string[] => {
      return state.starredNodes
        .filter(isStarredNote)
        .map((note) => note.id);
    },
  },

  actions: {
    async initialize(force = false) {
      if (!hasFavoritesVfsListener) {
        window.addEventListener('vfs-changed', () => {
          void this.refreshStarredNodes();
        });
        hasFavoritesVfsListener = true;
      }

      if (this.initialized && !force) {
        return;
      }

      await this.refreshStarredNodes();
    },

    async refreshStarredNodes() {
      this.loading = true;
      try {
        this.starredNodes = await workspaceService.getStarredNodes();
      } catch (err: unknown) {
        logger.error(`Failed to refresh favorites: ${getErrorMessage(err)}`);
      } finally {
        this.initialized = true;
        this.loading = false;
      }
    },

    isStarredNote(noteId: string): boolean {
      const normalized = noteId.trim();
      if (!normalized) {
        return false;
      }

      return this.starredNoteIds.includes(normalized);
    },

    async toggleStar(id: string, type: 'note' | 'notebook', starred: boolean) {
      const workspaceStore = useWorkspaceStore();
      await workspaceStore.toggleNodeStar(id, type, starred);
      await this.refreshStarredNodes();
    },
  },
});
