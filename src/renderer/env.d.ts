import type { OpenFileResult, SaveFilePayload, SaveFileResult } from './services/electronApi';

export {};

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<import('./services/electronApi').OpenFileResult | null>;
      saveFile: (payload: import('./services/electronApi').SaveFilePayload) => Promise<import('./services/electronApi').SaveFileResult | null>;
      log: (payload: { level: string; source: string; message: string }) => void;
      vfs?: {
        initWorkspace: (rootPath?: string) => Promise<{ root: string, nodes: any[] }>;
        createFile: (payload: { parentId: string | null, name: string, content?: string }) => Promise<any>;
        readContent: (contentId: string) => Promise<string>;
        writeContent: (payload: { contentId: string, content: string }) => Promise<boolean>;
      }
    };
  }
}
