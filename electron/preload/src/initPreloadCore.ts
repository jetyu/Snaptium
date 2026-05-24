import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../main/constants/ipc.constants.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type VoidCallback = () => void;
type DataCallback<T = unknown> = (data: T) => void;

interface SaveFilePayload { filePath: string | null; content: string; }
interface WorkspaceContextMenuItemPayload {
  action?: string | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  enabled?: boolean;
  checked?: boolean;
  iconDataUrl?: string;
  submenu?: WorkspaceContextMenuItemPayload[];
}
interface WorkspaceContextMenuPayload { nodeId: string; nodeType?: string; isRoot?: boolean; items?: WorkspaceContextMenuItemPayload[]; }
interface EditorContextMenuPayload { selectedText?: string; hasSelection?: boolean; canPaste?: boolean; }
interface AiSourceTestConnectionPayload { aiEndpoint: string; aiApiKey: string; aiModel: string; }
type SyncProviderConfigPayload = JsonObject & { provider: string };
interface SyncRunPayload { config: JsonObject; trigger: 'manual' | 'timer' | 'save'; }
interface ShortcutKeybindingPayload { commandId: string; key: string; when?: string | null; }
type RagQueryPayload = JsonObject;
type AiChatPayload = JsonObject;

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload: SaveFilePayload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
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
  window: Object.freeze({
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    unmaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_UNMAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
    reload: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RELOAD),
    forceReload: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FORCE_RELOAD),
    toggleDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_DEVTOOLS),
    resetZoom: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_RESET_ZOOM),
    zoomIn: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_ZOOM_IN),
    zoomOut: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_ZOOM_OUT),
    toggleFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN),
    onStateChanged: (callback: DataCallback<{ isMaximized: boolean }>) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { isMaximized: boolean }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, subscription);
    },
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
    deleteNodes: (nodeIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.VFS_DELETE_NODES, nodeIds),
    moveNode: (payload: { nodeId: string; parentId: string | null; index: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_MOVE_NODE, payload),
    toggleNodeLock: (payload: { nodeId: string; locked: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, payload),
    updateNotebookIconColor: (payload: { nodeId: string; iconColor: string | null }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_COLOR, payload),
    updateNotebookIconEmoji: (payload: { nodeId: string; iconEmoji: string | null }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_EMOJI, payload),
    updateNodeTags: (payload: { nodeId: string; tags: string[] }) =>
      ipcRenderer.invoke(IPC_CHANNELS.VFS_UPDATE_NODE_TAGS, payload),
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
    showContextMenu: (payload: WorkspaceContextMenuPayload) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, payload),
    getDailyWallpaper: (payload?: { nextArchive?: boolean; currentArchiveIndex?: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_WALLPAPER, payload),
  }),
  editor: Object.freeze({
    showContextMenu: (payload: EditorContextMenuPayload) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_SHOW_CONTEXT_MENU, payload),
    readClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_READ_CLIPBOARD),
    writeClipboard: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_WRITE_CLIPBOARD, text),
  }),
  menu: Object.freeze({
    onOpenPreferences: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
    },
    onOpenFile: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_FILE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_FILE, subscription);
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
    onOpenLicense: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_LICENSE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_LICENSE, subscription);
    },
    onImportMarkdown: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_IMPORT_MARKDOWN, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_IMPORT_MARKDOWN, subscription);
    },
    onImportEnex: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_IMPORT_ENEX, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_IMPORT_ENEX, subscription);
    },
    onImportSppx: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_IMPORT_SPPX, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_IMPORT_SPPX, subscription);
    },
    onImportNwp: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_IMPORT_NWP, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_IMPORT_NWP, subscription);
    },
    onExportMarkdown: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_EXPORT_MARKDOWN, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_EXPORT_MARKDOWN, subscription);
    },
    onExportSppx: (callback: VoidCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_EXPORT_SPPX, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_EXPORT_SPPX, subscription);
    },
  }),
  settings: Object.freeze({
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
    saveConfig: (config: JsonObject) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, config),
    setStartup: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_STARTUP, enabled),
    pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY),
    confirmEmbeddingSourceChange: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_EMBEDDING_SOURCE_CHANGE),
    confirmRagRebuildMode: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_RAG_REBUILD_MODE),
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
    importSppx: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_SPPX),
    exportSppx: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT_SPPX),
    importMarkdown: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_MARKDOWN),
    exportMarkdown: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT_MARKDOWN),
    importNwp: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_NWP),
    importEnex: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT_ENEX),
  }),
  aiSource: Object.freeze({
    testConnection: (config: AiSourceTestConnectionPayload) => ipcRenderer.invoke(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, config),
  }),
  sync: Object.freeze({
    testConnection: (config: SyncProviderConfigPayload) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_TEST_CONNECTION, config),
    run: (payload: SyncRunPayload) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RUN, payload),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),
    restoreRemoteKeySlots: (config: SyncProviderConfigPayload) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESTORE_REMOTE_KEY_SLOTS, config),
  }),
  shortcuts: Object.freeze({
    getCommands: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS),
    getCommandsByCategory: (category: string) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS_BY_CATEGORY, category),
    loadKeybindings: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_LOAD_KEYBINDINGS),
    saveKeybindings: (keybindings: ShortcutKeybindingPayload[]) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_SAVE_KEYBINDINGS, keybindings),
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
    importKeybindings: (config: JsonObject) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_IMPORT_KEYBINDINGS, config),
  }),
  rag: Object.freeze({
    initialize: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_INITIALIZE),
    indexNote: (request: RagQueryPayload) => ipcRenderer.invoke(IPC_CHANNELS.RAG_INDEX_NOTE, request),
    rebuildIndex: (request: RagQueryPayload) => ipcRenderer.invoke(IPC_CHANNELS.RAG_REBUILD_INDEX, request),
    searchText: (request: RagQueryPayload) => ipcRenderer.invoke(IPC_CHANNELS.RAG_SEARCH_TEXT, request),
    askQuestion: (payload: RagQueryPayload) => ipcRenderer.invoke(IPC_CHANNELS.RAG_ASK_QUESTION, payload),
    deleteNoteIndex: (noteId: string) => ipcRenderer.invoke(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, noteId),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_GET_STATUS),
  }),
  aiChat: Object.freeze({
    generate: (payload: AiChatPayload) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE, payload),
    generateCompletion: (payload: AiChatPayload) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE_COMPLETION, payload),
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
  license: Object.freeze({
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_GET_STATE),
    activate: (licenseKey: string) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, licenseKey),
    validate: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_VALIDATE),
    refreshDevices: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_REFRESH_DEVICES),
    deactivateDevice: (deviceId: string) => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_DEACTIVATE_DEVICE, deviceId),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.LICENSE_CLEAR),
    onStateChanged: (callback: DataCallback) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.LICENSE_STATE_CHANGED, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LICENSE_STATE_CHANGED, subscription);
    },
  }),
});

contextBridge.exposeInMainWorld(IPC_CHANNELS.ELECTRON_API, electronAPI);


