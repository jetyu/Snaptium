import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../main/constants/ipc.constants.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type VoidCallback = () => void;
type DataCallback<T = unknown> = (data: T) => void;

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  logger: Object.freeze({
    log: (payload: { level: string; source: string; message: string; context?: JsonValue }) =>
      ipcRenderer.send(IPC_CHANNELS.LOGGER_LOG, payload),
    openDir: () => ipcRenderer.invoke(IPC_CHANNELS.LOGGER_OPEN_DIR),
  }),
  app: Object.freeze({
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getEnvVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_ENV_VERSION),
    getName: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_NAME),
  }),
  vfs: Object.freeze({
    initWorkspace: (rootPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload: { parentId: string | null; name: string; content?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    createFolder: (payload: { parentId: string | null; name: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FOLDER, payload),
    renameNode: (payload: { nodeId: string; name: string }) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RENAME_NODE, payload),
    readContent: (contentId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload: { contentId: string; content: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload),
    saveImage: (payload: { contentId: string; fileName?: string; mimeType: string; dataBase64: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_SAVE_IMAGE, payload),
    showNoteInFolder: (nodeId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, nodeId),
    deleteNode: (nodeId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_DELETE_NODE, nodeId),
    moveNode: (payload: { nodeId: string; parentId: string | null; index: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_MOVE_NODE, payload),
    toggleNodeLock: (payload: { nodeId: string; locked: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, payload),
    getTrashedNodes: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_TRASHED_NODES),
    restoreNode: (nodeId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RESTORE_NODE, nodeId),
    permanentlyDeleteNode: (nodeId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_PERMANENTLY_DELETE_NODE, nodeId),
    emptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_EMPTY_TRASH),
    confirmPermanentDeleteNode: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_PERMANENT_DELETE_NODE),
    confirmEmptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_EMPTY_TRASH),
    confirmDeleteNode: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_DELETE_NODE, name),
    confirmRecoverVersion: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_RECOVER_VERSION),
    getHistory: (contentId: string) => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_HISTORY, contentId),
    getHistoryContent: (payload: { contentId: string; filename: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_HISTORY_CONTENT, payload),
    recoverVersion: (payload: { nodeId: string; filename: string }) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RECOVER_VERSION, payload),
    toggleNodeStar: (payload: { nodeId: string; starred: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_TOGGLE_NODE_STAR, payload),
    getStarredNodes: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_STARRED_NODES),
  }),
  search: Object.freeze({
    searchNotes: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_NOTES, query),
  }),
  workspace: Object.freeze({
    showContextMenu: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, payload),
  }),
  editor: Object.freeze({
    showContextMenu: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_SHOW_CONTEXT_MENU, payload),
    readClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_READ_CLIPBOARD),
    writeClipboard: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_WRITE_CLIPBOARD, text),
  }),
  menu: Object.freeze({
    onOpenPreferences: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
    },
    onOpenAbout: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_ABOUT, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_ABOUT, subscription);
    },
    onCheckForUpdates: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_CHECK_FOR_UPDATES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_CHECK_FOR_UPDATES, subscription);
    },
  }),
  settings: Object.freeze({
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
    saveConfig: (config: JsonObject) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, config),
    setStartup: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_STARTUP, enabled),
    pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY),
    confirmEmbeddingSourceChange: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_EMBEDDING_SOURCE_CHANGE),
    confirmDeleteAiSource: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_DELETE_AI_SOURCE, name),
    confirmResetSyncProvider: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_RESET_SYNC_PROVIDER, name),
    showMessage: (options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      title?: string;
      message: string;
      detail?: string;
    }) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SHOW_MESSAGE, options),
    switchLanguage: (locale: string) => ipcRenderer.send(IPC_CHANNELS.SETTINGS_SWITCH_LANGUAGE, locale),
    exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_EXPORT),
    importConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IMPORT),
    resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  }),
  dataTransfer: Object.freeze({
    exportSppx: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT_SPPX),
    importSppx: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_SPPX),
    exportMarkdown: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT_MARKDOWN),
    importMarkdown: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_MARKDOWN),
  }),
  aiSource: Object.freeze({
    testConnection: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, config),
  }),
  sync: Object.freeze({
    testConnection: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_TEST_CONNECTION, config),
    run: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RUN, payload),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),
  }),
  shortcuts: Object.freeze({
    getCommands: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS),
    getCommandsByCategory: (category: string) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS_BY_CATEGORY, category),
    loadKeybindings: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_LOAD_KEYBINDINGS),
    saveKeybindings: (keybindings: Array<Record<string, unknown>>) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_SAVE_KEYBINDINGS, keybindings),
    addKeybinding: (payload: { commandId: string; key: string; when?: string | null }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_ADD_KEYBINDING, payload),
    removeKeybinding: (payload: { commandId: string; key: string }) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_REMOVE_KEYBINDING, payload),
    resetToDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_RESET_TO_DEFAULTS),
    confirmResetToDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_CONFIRM_RESET_TO_DEFAULTS),
    detectConflicts: (payload: { key: string; excludeCommandId?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_DETECT_CONFLICTS, payload),
    validateKeybinding: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_VALIDATE_KEYBINDING, key),
    normalizeKeybinding: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_NORMALIZE_KEYBINDING, key),
    getKeybindingsForCommand: (commandId: string) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_KEYBINDINGS_FOR_COMMAND, commandId),
    exportKeybindings: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_EXPORT_KEYBINDINGS),
    importKeybindings: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_IMPORT_KEYBINDINGS, config),
  }),
  rag: Object.freeze({
    initialize: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_INITIALIZE),
    indexNote: (request: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.RAG_INDEX_NOTE, request),
    rebuildIndex: (request: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.RAG_REBUILD_INDEX, request),
    searchText: (request: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.RAG_SEARCH_TEXT, request),
    askQuestion: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.RAG_ASK_QUESTION, payload),
    deleteNoteIndex: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, noteId),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_GET_STATUS),
  }),
  aiChat: Object.freeze({
    generate: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE, payload),
    generateCompletion: (payload: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE_COMPLETION, payload),
  }),
  updater: Object.freeze({
    check: (silent: boolean) => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK, silent),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_GET_VERSION),
    updateConfig: (config: { autoCheckUpdates: boolean; updateCheckInterval: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATER_UPDATE_CONFIG, config),
    onChecking: (callback: VoidCallback) => {
      const subscription = () => callback();
      ipcRenderer.on(IPC_CHANNELS.UPDATER_CHECKING, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_CHECKING, subscription);
    },
    onAvailable: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_AVAILABLE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_AVAILABLE, subscription);
    },
    onNotAvailable: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_NOT_AVAILABLE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_NOT_AVAILABLE, subscription);
    },
    onDownloadProgress: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_DOWNLOAD_PROGRESS, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_DOWNLOAD_PROGRESS, subscription);
    },
    onDownloaded: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_DOWNLOADED, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_DOWNLOADED, subscription);
    },
    onError: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_ERROR, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_ERROR, subscription);
    },
  }),
  e2ee: Object.freeze({
    hasKeySlots: () => ipcRenderer.invoke(IPC_CHANNELS.E2EE_HAS_KEY_SLOTS),
    setupPassword: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.E2EE_SETUP_PASSWORD, password),
    unlock: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.E2EE_UNLOCK, password),
    unlockWithRecovery: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.E2EE_UNLOCK_RECOVERY, key),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.E2EE_LOCK),
    isUnlocked: () => ipcRenderer.invoke(IPC_CHANNELS.E2EE_IS_UNLOCKED),
    changePassword: (payload: { oldPassword: string; newPassword: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.E2EE_CHANGE_PASSWORD, payload),
    resetPassword: (payload: { recoveryKey: string; newPassword: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.E2EE_RESET_PASSWORD, payload),
    exportRecoveryKey: (recoveryKey: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.E2EE_EXPORT_RECOVERY_KEY, recoveryKey),
  }),
  accessControl: Object.freeze({
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.ACCESS_CONTROL_GET_CONFIG),
    updateConfig: (lockConfig: { enabled: boolean; lockOnStartup: boolean; autoLockTimeoutMinutes: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCESS_CONTROL_UPDATE_CONFIG, lockConfig),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.ACCESS_CONTROL_LOCK),
    unlock: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.ACCESS_CONTROL_UNLOCK, password),
    isLocked: () => ipcRenderer.invoke(IPC_CHANNELS.ACCESS_CONTROL_IS_LOCKED),
    onStateChanged: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.ACCESS_CONTROL_STATE_CHANGED, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.ACCESS_CONTROL_STATE_CHANGED, subscription);
    },
  }),
});

contextBridge.exposeInMainWorld(IPC_CHANNELS.ELECTRON_API, electronAPI);


