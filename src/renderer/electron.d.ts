export { };

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

interface EditorContextMenuItemPayload {
  action?: string | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu';
  enabled?: boolean;
  submenu?: EditorContextMenuItemPayload[];
}

interface EditorContextMenuPayload {
  items: EditorContextMenuItemPayload[];
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
  context: string;
}

interface AiCompleteResult {
  success: boolean;
  completion?: string;
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
        log: (payload: { level: string; source: string; message: string; context?: unknown }) => void;
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
        getTrashedNodes: () => Promise<WorkspaceNodePayload[]>;
        restoreNode: (nodeId: string) => Promise<WorkspaceNodePayload>;
        permanentlyDeleteNode: (nodeId: string) => Promise<boolean>;
        emptyTrash: () => Promise<boolean>;
        getHistory: (contentId: string) => Promise<any[]>;
        getHistoryContent: (payload: { contentId: string; timestamp: number }) => Promise<string>;
        recoverVersion: (payload: { nodeId: string; timestamp: number }) => Promise<boolean>;
      };

      search?: {
        searchNotes: (query: string) => Promise<SearchResult[]>;
      };

      workspace?: {
        showContextMenu: (payload: WorkspaceContextMenuPayload) => Promise<string | null>;
      };

      editor?: {
        showContextMenu: (payload: EditorContextMenuPayload) => Promise<string | null>;
        readClipboard: () => Promise<string>;
        writeClipboard: (text: string) => Promise<void>;
      };

      menu?: {
        onOpenPreferences: (callback: () => void) => () => void;
        onOpenAbout: (callback: () => void) => () => void;
        onCheckForUpdates: (callback: () => void) => () => void;
      };

      settings?: {
        getConfig: () => Promise<Record<string, unknown>>;
        saveConfig: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
        setStartup: (enabled: boolean) => Promise<{ enabled: boolean; supported: boolean }>;
        pickDirectory: () => Promise<string | null>;
        switchLanguage: (locale: string) => void;
        exportConfig: () => Promise<boolean>;
        importConfig: () => Promise<boolean>;
      };

      aiSource?: {
        testConnection: (config: AiSourceConfig) => Promise<{ success: boolean; message?: string }>;
      };

      aiAssistant?: {
        complete: (payload: AiCompletePayload) => Promise<AiCompleteResult>;
      };

      shortcuts?: {
        getCommands: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        getCommandsByCategory: (category: string) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        loadKeybindings: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        saveKeybindings: (keybindings: unknown[]) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        addKeybinding: (payload: { commandId: string; key: string; when?: string | null }) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        removeKeybinding: (payload: { commandId: string; key: string }) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        resetToDefaults: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        detectConflicts: (payload: { key: string; excludeCommandId?: string }) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        validateKeybinding: (key: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
        normalizeKeybinding: (key: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        getKeybindingsForCommand: (commandId: string) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        exportKeybindings: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
        importKeybindings: (config: unknown) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
      };

      rag?: {
        initialize: (payload: {
          workspaceRoot: string;
          embeddingConfig: {
            endpoint: string;
            apiKey: string;
            model: string;
          };
        }) => Promise<{ success: boolean; error?: string }>;
        indexNote: (request: {
          noteId: string;
          noteTitle: string;
          notePath: string;
          chunkSize: number;
          chunkOverlap: number;
        }) => Promise<{ success: boolean; chunksIndexed?: number; error?: string }>;
        rebuildIndex: (request: {
          notes: Array<{
            id: string;
            title: string;
            path: string;
          }>;
          chunkSize: number;
          chunkOverlap: number;
        }) => Promise<{
          success: boolean;
          notesIndexed?: number;
          notesFailed?: number;
          totalChunks?: number;
          error?: string;
        }>;
        search: (request: {
          query: string;
          topK: number;
          similarityThreshold: number;
        }) => Promise<{
          success: boolean;
          results: Array<{
            chunk: {
              id: string;
              noteId: string;
              content: string;
              startPos: number;
              endPos: number;
            };
            score: number;
            noteTitle?: string;
          }>;
          error?: string;
        }>;
        deleteNoteIndex: (noteId: string) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{
          success: boolean;
          isInitialized: boolean;
          totalChunks: number;
          tableName?: string;
          error?: string;
        }>;
        updateConfig: (embeddingConfig: {
          endpoint: string;
          apiKey: string;
          model: string;
        }) => Promise<{ success: boolean; error?: string }>;
      };

      aiChat?: {
        generate: (config: {
          endpoint: string;
          apiKey: string;
          model: string;
          messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
        }) => Promise<{ success: boolean; answer?: string; error?: string }>;
      };

      updater?: {
        check: (silent?: boolean) => Promise<{ success: boolean }>;
        download: () => Promise<{ success: boolean }>;
        install: () => Promise<{ success: boolean }>;
        getVersion: () => Promise<string>;
        updateConfig: (config: { autoCheckUpdates: boolean; updateCheckInterval: number }) => Promise<{ success: boolean }>;
        onChecking: (callback: () => void) => () => void;
        onAvailable: (callback: (data: any) => void) => () => void;
        onNotAvailable: (callback: (data: any) => void) => () => void;
        onDownloadProgress: (callback: (data: any) => void) => () => void;
        onDownloaded: (callback: (data: any) => void) => () => void;
        onError: (callback: (data: any) => void) => () => void;
      };
    };
  }
}
