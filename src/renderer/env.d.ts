import type { OpenFileResult, SaveFilePayload, SaveFileResult } from './services/electronApi';

export {};

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<OpenFileResult | null>;
      saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult | null>;
    };
  }
}
