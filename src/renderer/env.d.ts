export {};

interface WorkspaceNodePayload {
  id: string;
  type: string;
  name: string;
  parentId?: string | null;
  contentId?: string;
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;
  locked?: boolean;
}

interface WorkspaceRootPayload {
  root: string;
  nodes: WorkspaceNodePayload[];
}

interface WorkspaceContextMenuItemPayload {
  action: string;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator';
  enabled?: boolean;
}

interface WorkspaceContextMenuPayload {
  items: WorkspaceContextMenuItemPayload[];
  labels?: Record<string, string>;
}

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<import('./services/electronApi').OpenFileResult | null>;
      saveFile: (payload: import('./services/electronApi').SaveFilePayload) => Promise<import('./services/electronApi').SaveFileResult | null>;
      log: (payload: { level: string; source: string; message: string }) => void;
      vfs?: {
        initWorkspace: (rootPath?: string) => Promise<WorkspaceRootPayload>;
        createFile: (payload: { parentId: string | null; name: string; content?: string }) => Promise<WorkspaceNodePayload>;
        createFolder: (payload: { parentId: string | null; name: string }) => Promise<WorkspaceNodePayload>;
        readContent: (contentId: string) => Promise<string>;
        writeContent: (payload: { contentId: string; content: string }) => Promise<boolean>;
      };
      workspace?: {
        showContextMenu: (payload: WorkspaceContextMenuPayload) => Promise<string | null>;
      };
    };
  }
}
