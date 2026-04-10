export interface OpenFileResult {
  filePath: string;
  content: string;
}

export interface SaveFilePayload {
  filePath: string | null;
  content: string;
}

export interface SaveFileResult {
  filePath: string;
}

export interface LogPayload {
  level: string;
  source: string;
  message: string;
  context?: unknown;
}

export interface AiCompletePayload {
  context: string;
}

export interface AiCompleteResult {
  success: boolean;
  completion?: string;
  message?: string;
}

export interface AiSourceConfig {
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
}

export interface AiSourceTestResult {
  success: boolean;
  message?: string;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatGeneratePayload {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
}

export interface AiChatGenerateResult {
  success: boolean;
  answer?: string;
  error?: string;
}

export interface AppEnvVersion {
  electron: string;
  node: string;
  chrome: string;
  v8: string;
}

export interface WorkspaceContextMenuItemPayload {
  action: string;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator';
  enabled?: boolean;
}

export interface WorkspaceContextMenuPayload {
  items: WorkspaceContextMenuItemPayload[];
  labels?: Record<string, string>;
}

export interface EditorContextMenuItemPayload {
  action?: string | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu';
  enabled?: boolean;
  submenu?: EditorContextMenuItemPayload[];
}

export interface EditorContextMenuPayload {
  items: EditorContextMenuItemPayload[];
  labels?: Record<string, string>;
}

export interface WorkspaceNodePayload {
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

export interface WorkspaceRootPayload {
  root: string;
  nodes: WorkspaceNodePayload[];
}

export interface RagInitializePayload {
  workspaceRoot: string;
  embeddingConfig: {
    endpoint: string;
    apiKey: string;
    model: string;
  };
}

export interface RagIndexNotePayload {
  noteId: string;
  noteTitle: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface RagSearchPayload {
  queryEmbedding: number[];
  topK?: number;
  similarityThreshold?: number;
}

export interface RagSearchResult {
  chunk: {
    id: string;
    noteId: string;
    content: string;
    startPos: number;
    endPos: number;
  };
  score: number;
  noteTitle?: string;
}

export interface RagStatusResult {
  success: boolean;
  isInitialized: boolean;
  totalChunks: number;
  tableName?: string;
  error?: string;
}

export interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface EmbeddingGeneratePayload {
  texts: string[];
  config: EmbeddingConfig;
}

export interface EmbeddingGenerateSinglePayload {
  text: string;
  config: EmbeddingConfig;
}

export interface HistoryVersion {
  timestamp: number;
  filename: string;
  size: number;
}

function ensureElectronApi() {
  if (!window.electronAPI) {
    throw new Error('electronAPI bridge is unavailable. Make sure preload is loaded.');
  }

  return window.electronAPI;
}

export const electronApi = {
  openFile: async (): Promise<OpenFileResult | null> => {
    return ensureElectronApi().openFile();
  },

  saveFile: async (payload: SaveFilePayload): Promise<SaveFileResult | null> => {
    return ensureElectronApi().saveFile(payload);
  },

  logger: {
    isAvailable: (): boolean => !!window.electronAPI?.logger,
    getLoggerApi: () => {
      const api = ensureElectronApi().logger;
      if (!api) throw new Error('Logger bridge is unavailable');
      return api;
    },
    log: (payload: LogPayload): void => {
      electronApi.logger.getLoggerApi().log(payload);
    },
    openDir: (): Promise<boolean> => {
      return electronApi.logger.getLoggerApi().openDir();
    },
  },

  aiAssistant: {
    isAvailable: (): boolean => !!window.electronAPI?.aiAssistant,
    getApi: () => {
      const api = ensureElectronApi().aiAssistant;
      if (!api) throw new Error('AI Assistant bridge is unavailable');
      return api;
    },
    complete: (payload: AiCompletePayload): Promise<AiCompleteResult> => {
      return electronApi.aiAssistant.getApi().complete(payload);
    },
  },

  embedding: {
    isAvailable: (): boolean => !!window.electronAPI?.embedding,
    getApi: () => {
      const api = ensureElectronApi().embedding;
      if (!api) throw new Error('Embedding bridge is unavailable');
      return api;
    },
    generate: (payload: EmbeddingGeneratePayload): Promise<number[][]> => {
      return electronApi.embedding.getApi().generate(payload);
    },
    generateSingle: (payload: EmbeddingGenerateSinglePayload): Promise<number[]> => {
      return electronApi.embedding.getApi().generateSingle(payload);
    },
    generateBatch: (payload: EmbeddingGeneratePayload): Promise<number[][]> => {
      return electronApi.embedding.getApi().generateBatch(payload);
    },
  },

  menu: {
    isAvailable: (): boolean => !!window.electronAPI?.menu,
    getApi: () => {
      const api = ensureElectronApi().menu;
      if (!api) throw new Error('Menu bridge is unavailable');
      return api;
    },
    onOpenPreferences: (callback: () => void) => electronApi.menu.getApi().onOpenPreferences(callback),
    onOpenAbout: (callback: () => void) => electronApi.menu.getApi().onOpenAbout(callback),
    onCheckForUpdates: (callback: () => void) => electronApi.menu.getApi().onCheckForUpdates(callback),
  },

  app: {
    isAvailable: (): boolean => !!window.electronAPI?.app,
    getApi: () => {
      const api = ensureElectronApi().app;
      if (!api) throw new Error('App bridge is unavailable');
      return api;
    },
    getVersion: () => electronApi.app.getApi().getVersion(),
    getName: () => electronApi.app.getApi().getName(),
    getEnvVersion: () => electronApi.app.getApi().getEnvVersion(),
  },

  settings: {
    isAvailable: (): boolean => !!window.electronAPI?.settings,
    getApi: () => {
      const api = ensureElectronApi().settings;
      if (!api) throw new Error('Settings bridge is unavailable');
      return api;
    },
    getConfig: () => electronApi.settings.getApi().getConfig(),
    saveConfig: (config: Record<string, unknown>) => electronApi.settings.getApi().saveConfig(config),
    setStartup: (enabled: boolean) => electronApi.settings.getApi().setStartup(enabled),
    switchLanguage: (locale: string) => electronApi.settings.getApi().switchLanguage(locale),
    pickDirectory: () => electronApi.settings.getApi().pickDirectory(),
    exportConfig: () => electronApi.settings.getApi().exportConfig(),
    importConfig: () => electronApi.settings.getApi().importConfig(),
  },

  search: {
    isAvailable: (): boolean => !!window.electronAPI?.search,
    getApi: () => {
      const api = ensureElectronApi().search;
      if (!api) throw new Error('Search bridge is unavailable');
      return api;
    },
    searchNotes: (query: string) => electronApi.search.getApi().searchNotes(query),
  },

  aiSource: {
    isAvailable: (): boolean => !!window.electronAPI?.aiSource,
    getApi: () => {
      const api = ensureElectronApi().aiSource;
      if (!api) throw new Error('AI Source bridge is unavailable');
      return api;
    },
    testConnection: (config: AiSourceConfig) => electronApi.aiSource.getApi().testConnection(config),
  },

  aiChat: {
    isAvailable: (): boolean => !!window.electronAPI?.aiChat,
    getApi: () => {
      const api = ensureElectronApi().aiChat;
      if (!api) throw new Error('AI Chat bridge is unavailable');
      return api;
    },
    generate: (payload: AiChatGeneratePayload) => {
      return electronApi.aiChat.getApi().generate(payload);
    },
  },

  rag: {
    isAvailable: (): boolean => !!window.electronAPI?.rag,
    getApi: () => {
      const api = ensureElectronApi().rag;
      if (!api) throw new Error('RAG bridge is unavailable');
      return api;
    },
    initialize: (payload: RagInitializePayload) => {
      return electronApi.rag.getApi().initialize(payload);
    },
    indexNote: (payload: RagIndexNotePayload) => {
      return electronApi.rag.getApi().indexNote(payload);
    },
    search: (payload: RagSearchPayload) => {
      return electronApi.rag.getApi().search(payload);
    },
    deleteNoteIndex: (noteId: string) => {
      return electronApi.rag.getApi().deleteNoteIndex(noteId);
    },
    getStatus: (): Promise<RagStatusResult> => {
      return electronApi.rag.getApi().getStatus();
    },
    updateConfig: (payload: { endpoint: string; apiKey: string; model: string }) => {
      return electronApi.rag.getApi().updateConfig(payload);
    },
    clearIndex: (): Promise<{ success: boolean; error?: string }> => {
      return electronApi.rag.getApi().rebuildIndex();
    },
  },

  workspace: {
    getApi: () => {
      const api = ensureElectronApi().workspace;
      if (!api) throw new Error('Workspace bridge is unavailable');
      return api;
    },
    showContextMenu: (payload: WorkspaceContextMenuPayload): Promise<string | null> => {
      return electronApi.workspace.getApi().showContextMenu(payload);
    },
  },

  editor: {
    getApi: () => {
      const api = ensureElectronApi().editor;
      if (!api) throw new Error('Editor bridge is unavailable');
      return api;
    },
    showContextMenu: (payload: EditorContextMenuPayload): Promise<string | null> => {
      return electronApi.editor.getApi().showContextMenu(payload);
    },
    readClipboard: (): Promise<string> => {
      return electronApi.editor.getApi().readClipboard();
    },
    writeClipboard: (text: string): Promise<void> => {
      return electronApi.editor.getApi().writeClipboard(text);
    },
  },

  vfs: {
    isAvailable: (): boolean => {
      return !!window.electronAPI?.vfs;
    },

    getApi: () => {
      const api = ensureElectronApi().vfs;
      if (!api) throw new Error('VFS bridge is unavailable');
      return api;
    },

    initWorkspace: (rootPath?: string): Promise<WorkspaceRootPayload> => {
      return electronApi.vfs.getApi().initWorkspace(rootPath);
    },

    createFile: (payload: { parentId: string | null; name: string; content?: string }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().createFile(payload);
    },

    createFolder: (payload: { parentId: string | null; name: string }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().createFolder(payload);
    },

    renameNode: (payload: { nodeId: string; name: string }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().renameNode(payload);
    },

    readContent: (contentId: string): Promise<string> => {
      return electronApi.vfs.getApi().readContent(contentId);
    },

    writeContent: (payload: { contentId: string; content: string }): Promise<boolean> => {
      return electronApi.vfs.getApi().writeContent(payload);
    },

    deleteNode: (nodeId: string): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().deleteNode(nodeId);
    },

    showNoteInFolder: (nodeId: string): Promise<boolean> => {
      return electronApi.vfs.getApi().showNoteInFolder(nodeId);
    },

    toggleNodeLock: (payload: { nodeId: string; locked: boolean }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().toggleNodeLock(payload);
    },

    getTrashedNodes: (): Promise<WorkspaceNodePayload[]> => {
      return electronApi.vfs.getApi().getTrashedNodes();
    },

    restoreNode: (nodeId: string): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().restoreNode(nodeId);
    },

    permanentlyDeleteNode: (nodeId: string): Promise<boolean> => {
      return electronApi.vfs.getApi().permanentlyDeleteNode(nodeId);
    },

    emptyTrash: (): Promise<boolean> => {
      return electronApi.vfs.getApi().emptyTrash();
    },

    getHistory: (contentId: string): Promise<HistoryVersion[]> => {
      return electronApi.vfs.getApi().getHistory(contentId);
    },

    getHistoryContent: (payload: { contentId: string; filename: string }): Promise<string> => {
      return electronApi.vfs.getApi().getHistoryContent(payload);
    },

    recoverVersion: (payload: { nodeId: string; filename: string }): Promise<boolean> => {
      return electronApi.vfs.getApi().recoverVersion(payload);
    },
  },

  shortcuts: {
    isAvailable: (): boolean => !!window.electronAPI?.shortcuts,
    getApi: () => {
      const api = ensureElectronApi().shortcuts;
      if (!api) throw new Error('Shortcuts bridge is unavailable');
      return api;
    },
    getCommands: () => electronApi.shortcuts.getApi().getCommands(),
    getCommandsByCategory: (category: string) => electronApi.shortcuts.getApi().getCommandsByCategory(category),
    loadKeybindings: () => electronApi.shortcuts.getApi().loadKeybindings(),
    saveKeybindings: (keybindings: unknown[]) => electronApi.shortcuts.getApi().saveKeybindings(keybindings),
    addKeybinding: (payload: { commandId: string; key: string; when?: string | null }) => electronApi.shortcuts.getApi().addKeybinding(payload),
    removeKeybinding: (payload: { commandId: string; key: string }) => electronApi.shortcuts.getApi().removeKeybinding(payload),
    resetToDefaults: () => electronApi.shortcuts.getApi().resetToDefaults(),
    detectConflicts: (payload: { key: string; excludeCommandId?: string }) => electronApi.shortcuts.getApi().detectConflicts(payload),
    validateKeybinding: (key: string) => electronApi.shortcuts.getApi().validateKeybinding(key),
    normalizeKeybinding: (key: string) => electronApi.shortcuts.getApi().normalizeKeybinding(key),
    getKeybindingsForCommand: (commandId: string) => electronApi.shortcuts.getApi().getKeybindingsForCommand(commandId),
    exportKeybindings: () => electronApi.shortcuts.getApi().exportKeybindings(),
    importKeybindings: (config: unknown) => electronApi.shortcuts.getApi().importKeybindings(config),
  },

  updater: {
    isAvailable: (): boolean => !!window.electronAPI?.updater,
    getApi: () => {
      const api = ensureElectronApi().updater;
      if (!api) throw new Error('Updater bridge is unavailable');
      return api;
    },
    check: (silent = false) => electronApi.updater.getApi().check(silent),
    download: () => electronApi.updater.getApi().download(),
    install: () => electronApi.updater.getApi().install(),
    getVersion: () => electronApi.updater.getApi().getVersion(),
    updateConfig: (config: { autoCheckUpdates: boolean; updateCheckInterval: number }) => electronApi.updater.getApi().updateConfig(config),
    onChecking: (callback: () => void) => electronApi.updater.getApi().onChecking(callback),
    onAvailable: (callback: (data: any) => void) => electronApi.updater.getApi().onAvailable(callback),
    onNotAvailable: (callback: (data: any) => void) => electronApi.updater.getApi().onNotAvailable(callback),
    onDownloadProgress: (callback: (data: any) => void) => electronApi.updater.getApi().onDownloadProgress(callback),
    onDownloaded: (callback: (data: any) => void) => electronApi.updater.getApi().onDownloaded(callback),
    onError: (callback: (data: any) => void) => electronApi.updater.getApi().onError(callback),
  },
};

export async function openMarkdownFile(): Promise<OpenFileResult | null> {
  return electronApi.openFile();
}

export async function saveMarkdownFile(payload: SaveFilePayload): Promise<SaveFileResult | null> {
  return electronApi.saveFile(payload);
}

export function logToMain(payload: LogPayload): void {
  electronApi.logger.log(payload);
}
