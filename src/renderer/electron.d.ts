export { };

interface WorkspaceNodePayload {
  id: string;
  type: string;
  name: string;
  parentId?: string | null;
  order?: number;
  contentId?: string;
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;
  locked?: boolean;
  starred?: boolean;
  starredAt?: number;
  tags?: string[];
}

interface WorkspaceRootPayload {
  root: string;
  nodes: WorkspaceNodePayload[];
}

interface SavedImagePayload {
  fileName: string;
  filePath: string;
  markdownPath: string;
}

interface WorkspaceContextMenuItemPayload {
  action?: string | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu';
  enabled?: boolean;
  submenu?: WorkspaceContextMenuItemPayload[];
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

interface WindowStatePayload {
  isMaximized: boolean;
}

interface WallpaperRequestPayload {
  nextArchive?: boolean;
  currentArchiveIndex?: number;
}

interface WallpaperResult {
  success: boolean;
  dataUrl: string | null;
  source: 'bing' | 'cache' | 'fallback';
  archiveIndex: number;
  title: string;
  description: string;
  author: string;
  originUrl: string;
  date: string;
  cached: boolean;
  refreshedAt: number;
  error?: string;
}

interface AiSourceConfig {
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
}

interface AiCompletePayload {
  context: string;
  systemPrompt?: string;
}

interface AiCompleteResult {
  success: boolean;
  completion?: string;
  message?: string;
}

interface SyncSummary {
  uploaded: number;
  downloaded: number;
  deletedLocal: number;
  deletedRemote: number;
  merged: number;
  conflicts: number;
}

interface SyncErrorInfo {
  code: string;
  message: string;
  at?: number;
}

interface SyncTestConnectionResult {
  success: boolean;
  code?: string;
  message?: string;
}

type SyncRunResult =
  | {
    success: true;
    syncedAt: number;
    summary: SyncSummary;
    recoveredPendingSession: boolean;
  }
  | {
    success: false;
    code: string;
    message: string;
  };

interface E2eeErrorResult {
  success: false;
  code: string;
  message: string;
}

interface E2eeOperationResult {
  success: true;
}

interface AccessControlConfig {
  enabled: boolean;
  lockOnStartup: boolean;
  autoLockTimeoutMinutes: number;
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

interface HistoryVersion {
  timestamp: number;
  filename: string;
  size: number;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

interface ShortcutsKeybindingPayload {
  commandId: string;
  key: string;
  when?: string | null;
}

interface ShortcutsKeybindingsConfigPayload {
  version: string;
  keybindings: ShortcutsKeybindingPayload[];
}

type ShortcutsDataPayload = Array<Record<string, JsonValue>>;

interface UpdaterUpdateInfoPayload {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  files?: Array<Record<string, JsonValue>>;
}

interface UpdaterProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface UpdaterErrorPayload {
  message: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Global window augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __vfsListenerAdded?: boolean;
    electronAPI: {
      // Legacy file open/save (editor module)
      openFile: () => Promise<import('./core/bridge/electronApi').OpenFileResult | null>;
      saveFile: (payload: import('./core/bridge/electronApi').SaveFilePayload) => Promise<import('./core/bridge/electronApi').SaveFileResult | null>;

      logger: {
        log: (payload: { level: string; source: string; message: string; context?: JsonValue }) => void;
        openDir: () => Promise<boolean>;
      };

      app: {
        getVersion: () => Promise<string>;
        getEnvVersion: () => Promise<AppEnvVersion>;
        getName: () => Promise<string>;
      };

      window?: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        unmaximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onStateChanged: (callback: (data: WindowStatePayload) => void) => () => void;
      };

      vfs?: {
        initWorkspace: (rootPath?: string) => Promise<WorkspaceRootPayload>;
        createFile: (payload: { parentId: string | null; name: string; content?: string }) => Promise<WorkspaceNodePayload>;
        createFolder: (payload: { parentId: string | null; name: string }) => Promise<WorkspaceNodePayload>;
        renameNode: (payload: { nodeId: string; name: string }) => Promise<WorkspaceNodePayload>;
        readContent: (contentId: string) => Promise<string>;
        writeContent: (payload: { contentId: string; content: string }) => Promise<boolean>;
        saveImage: (payload: { contentId: string; fileName?: string; mimeType: string; dataBase64: string }) => Promise<SavedImagePayload>;
        showNoteInFolder: (nodeId: string) => Promise<boolean>;
        deleteNode: (nodeId: string) => Promise<WorkspaceNodePayload>;
        moveNode: (payload: { nodeId: string; parentId: string | null; index: number }) => Promise<WorkspaceNodePayload>;
        toggleNodeLock: (payload: { nodeId: string; locked: boolean }) => Promise<WorkspaceNodePayload>;
        updateNodeTags: (payload: { nodeId: string; tags: string[] }) => Promise<WorkspaceNodePayload>;
        getTrashedNodes: () => Promise<WorkspaceNodePayload[]>;
        restoreNode: (nodeId: string) => Promise<WorkspaceNodePayload>;
        permanentlyDeleteNode: (nodeId: string) => Promise<boolean>;
        emptyTrash: () => Promise<boolean>;
        confirmPermanentDeleteNode: () => Promise<boolean>;
        confirmEmptyTrash: () => Promise<boolean>;
        confirmDeleteNode: (name: string) => Promise<boolean>;
        confirmRecoverVersion: () => Promise<boolean>;
        getHistory: (contentId: string) => Promise<HistoryVersion[]>;
        getHistoryContent: (payload: { contentId: string; filename: string }) => Promise<string>;
        recoverVersion: (payload: { nodeId: string; filename: string }) => Promise<boolean>;
        toggleNodeStar: (payload: { nodeId: string; starred: boolean }) => Promise<WorkspaceNodePayload>;
        getStarredNodes: () => Promise<WorkspaceNodePayload[]>;
      };

      search?: {
        searchNotes: (query: string) => Promise<SearchResult[]>;
      };

      workspace?: {
        showContextMenu: (payload: WorkspaceContextMenuPayload) => Promise<string | null>;
        getDailyWallpaper: (payload?: WallpaperRequestPayload) => Promise<WallpaperResult>;
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
        getConfig: () => Promise<JsonObject>;
        saveConfig: (config: JsonObject) => Promise<JsonObject>;
        setStartup: (enabled: boolean) => Promise<{ enabled: boolean; supported: boolean }>;
        pickDirectory: () => Promise<string | null>;
        confirmEmbeddingSourceChange: () => Promise<boolean>;
        confirmDeleteAiSource: (name: string) => Promise<boolean>;
        confirmResetSyncProvider: (name: string) => Promise<boolean>;
        showMessage: (options: {
          type?: 'none' | 'info' | 'error' | 'question' | 'warning';
          title?: string;
          message: string;
          detail?: string;
        }) => Promise<boolean>;
        switchLanguage: (locale: string) => void;
        exportConfig: () => Promise<boolean>;
        importConfig: () => Promise<boolean>;
        resetConfig: () => Promise<boolean>;
      };

      dataTransfer?: {
        exportSppx: () => Promise<{
          success: boolean;
          cancelled?: boolean;
          filePath?: string;
          exportedAt?: number;
        }>;
        importSppx: () => Promise<{
          success: boolean;
          cancelled?: boolean;
          filePath?: string;
          importedAt?: number;
        }>;
        exportMarkdown: () => Promise<{
          success: boolean;
          cancelled?: boolean;
          directoryPath?: string;
          exportedNotes?: number;
          createdDirectories?: number;
          copiedImages?: number;
          skippedImages?: number;
          failedFiles?: number;
          failedFilePaths?: string[];
        }>;
        importMarkdown: () => Promise<{
          success: boolean;
          cancelled?: boolean;
          directoryPath?: string;
          scannedFiles?: number;
          importedNotes?: number;
          createdNotebooks?: number;
          copiedImages?: number;
          skippedFiles?: number;
          skippedImages?: number;
          failedFiles?: number;
          failedFilePaths?: string[];
        }>;
      };

      aiSource?: {
        testConnection: (config: AiSourceConfig) => Promise<{ success: boolean; message?: string }>;
      };

      sync?: {
        testConnection: (config: JsonObject) => Promise<SyncTestConnectionResult>;
        run: (payload: {
          config: JsonObject;
          trigger: 'manual' | 'timer' | 'save';
        }) => Promise<SyncRunResult>;
        getStatus: () => Promise<{
          success: boolean;
          lastSyncedAt: number | null;
          lastSummary: SyncSummary | null;
          lastError: SyncErrorInfo | null;
          recoveredPendingSession: boolean;
        }>;
      };

      e2ee?: {
        hasKeySlots: () => Promise<{ success: true; hasKeySlots: boolean } | E2eeErrorResult>;
        setupPassword: (password: string) => Promise<{ success: true; recoveryKey: string } | E2eeErrorResult>;
        unlock: (password: string) => Promise<E2eeOperationResult | E2eeErrorResult>;
        unlockWithRecovery: (key: string) => Promise<E2eeOperationResult | E2eeErrorResult>;
        lock: () => Promise<E2eeOperationResult>;
        isUnlocked: () => Promise<{ success: true; isUnlocked: boolean } | E2eeErrorResult>;
        changePassword: (
          payload: { oldPassword: string; newPassword: string }
        ) => Promise<{ success: true; recoveryKey: string } | E2eeErrorResult>;
        resetPassword: (
          payload: { recoveryKey: string; newPassword: string }
        ) => Promise<{ success: true; recoveryKey: string } | E2eeErrorResult>;
        exportRecoveryKey: (
          recoveryKey: string
        ) => Promise<{ success: true; canceled: boolean; filePath?: string } | E2eeErrorResult>;
      };

      accessControl?: {
        getConfig: () => Promise<{ success: true; config: AccessControlConfig } | E2eeErrorResult>;
        updateConfig: (lockConfig: AccessControlConfig) => Promise<E2eeOperationResult | E2eeErrorResult>;
        lock: () => Promise<E2eeOperationResult>;
        unlock: (password: string) => Promise<E2eeOperationResult | E2eeErrorResult>;
        isLocked: () => Promise<{ success: true; isLocked: boolean } | E2eeErrorResult>;
        onStateChanged: (callback: (payload: { locked: boolean }) => void) => () => void;
      };

      aiAssistant?: {
        complete: (payload: AiCompletePayload) => Promise<AiCompleteResult>;
      };

      shortcuts?: {
        getCommands: () => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        getCommandsByCategory: (category: string) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        loadKeybindings: () => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        saveKeybindings: (keybindings: ShortcutsKeybindingPayload[]) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        addKeybinding: (payload: { commandId: string; key: string; when?: string | null }) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        removeKeybinding: (payload: { commandId: string; key: string }) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        resetToDefaults: () => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        confirmResetToDefaults: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
        detectConflicts: (payload: { key: string; excludeCommandId?: string }) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        validateKeybinding: (key: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
        normalizeKeybinding: (key: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        getKeybindingsForCommand: (commandId: string) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
        exportKeybindings: () => Promise<{ success: boolean; data?: ShortcutsKeybindingsConfigPayload; error?: string }>;
        importKeybindings: (config: ShortcutsKeybindingsConfigPayload) => Promise<{ success: boolean; data?: ShortcutsDataPayload; error?: string }>;
      };

      rag?: {
        initialize: () => Promise<{ success: boolean; error?: string }>;
        indexNote: (payload: {
          noteId: string;
          noteTitle: string;
          content: string;
          chunkSize?: number;
          chunkOverlap?: number;
        }) => Promise<{ success: boolean; chunksIndexed?: number; error?: string }>;
        searchText: (payload: {
          query: string;
          topK?: number;
          similarityThreshold?: number;
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
        askQuestion: (payload: { query: string }) => Promise<{
          success: boolean;
          answer?: string;
          error?: string;
          usedSearchFallback?: boolean;
        }>;
        deleteNoteIndex: (noteId: string) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{
          success: boolean;
          isInitialized: boolean;
          totalChunks: number;
          tableName?: string;
          error?: string;
        }>;
        rebuildIndex: () => Promise<{ success: boolean; error?: string }>;
      };

      aiChat?: {
        generate: (config: {
          messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
        }) => Promise<{ success: boolean; answer?: string; error?: string }>;
        generateCompletion: (payload: AiCompletePayload) => Promise<{ success: boolean; answer?: string; error?: string }>;
      };

      updater?: {
        check: (silent?: boolean) => Promise<{ success: boolean }>;
        download: () => Promise<{ success: boolean }>;
        install: () => Promise<{ success: boolean }>;
        getVersion: () => Promise<string>;
        updateConfig: (config: { autoCheckUpdates: boolean; updateCheckInterval: number }) => Promise<{ success: boolean }>;
        onChecking: (callback: () => void) => () => void;
        onAvailable: (callback: (data: UpdaterUpdateInfoPayload) => void) => () => void;
        onNotAvailable: (callback: (data: UpdaterUpdateInfoPayload) => void) => () => void;
        onDownloadProgress: (callback: (data: UpdaterProgressPayload) => void) => () => void;
        onDownloaded: (callback: (data: UpdaterUpdateInfoPayload) => void) => () => void;
        onError: (callback: (data: UpdaterErrorPayload) => void) => () => void;
      };
    };
  }
}


