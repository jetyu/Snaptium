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

interface AppEnvVersion {
  electron: string;
  node: string;
  chrome: string;
  v8: string;
}

interface AiSourceConfig {
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
}

interface AiCompletePayload {
  sourceId: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
}

interface AiCompleteResult {
  success: boolean;
  content?: string;
  message?: string;
}

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchResult {
  id: string;
  contentId: string;
  title: string;
  matches: SearchMatch[];
  titleMatch: boolean;
}

// ---------------------------------------------------------------------------
// Global window augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    electronAPI: {
      // Legacy file open/save (editor module)
      openFile: () => Promise<import('./core/bridge/electronApi').OpenFileResult | null>;
      saveFile: (payload: import('./core/bridge/electronApi').SaveFilePayload) => Promise<import('./core/bridge/electronApi').SaveFileResult | null>;

      logger: {
        log: (payload: { level: string; source: string; message: string }) => void;
        openDir: () => Promise<boolean>;
      };

      app: {
        getVersion: () => Promise<string>;
        getEnvVersion: () => Promise<AppEnvVersion>;
        getName: () => Promise<string>;
      };

      vfs?: {
        initWorkspace: (rootPath?: string) => Promise<WorkspaceRootPayload>;
        createFile: (payload: { parentId: string | null; name: string; content?: string }) => Promise<WorkspaceNodePayload>;
        createFolder: (payload: { parentId: string | null; name: string }) => Promise<WorkspaceNodePayload>;
        renameNode: (payload: { nodeId: string; name: string }) => Promise<WorkspaceNodePayload>;
        readContent: (contentId: string) => Promise<string>;
        writeContent: (payload: { contentId: string; content: string }) => Promise<boolean>;
        showNoteInFolder: (nodeId: string) => Promise<boolean>;
        deleteNode: (nodeId: string) => Promise<WorkspaceNodePayload>;
        toggleNodeLock: (payload: { nodeId: string; locked: boolean }) => Promise<WorkspaceNodePayload>;
      };

      search?: {
        searchNotes: (query: string) => Promise<SearchResult[]>;
      };

      workspace?: {
        showContextMenu: (payload: WorkspaceContextMenuPayload) => Promise<string | null>;
      };

      menu?: {
        onOpenPreferences: (callback: () => void) => () => void;
        onOpenAbout: (callback: () => void) => () => void;
      };

      settings?: {
        getConfig: () => Promise<Record<string, unknown>>;
        saveConfig: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
        setStartup: (enabled: boolean) => Promise<{ enabled: boolean; supported: boolean }>;
        pickDirectory: () => Promise<string | null>;
        switchLanguage: (locale: string) => void;
      };

      aiSource?: {
        testConnection: (config: AiSourceConfig) => Promise<{ success: boolean; message?: string }>;
      };

      aiAssistant?: {
        complete: (payload: AiCompletePayload) => Promise<AiCompleteResult>;
      };
    };
  }
}
