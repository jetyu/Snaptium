import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../main/constants/ipc.constants.js';

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  logger: Object.freeze({
    log: (payload) => ipcRenderer.send(IPC_CHANNELS.LOGGER_LOG, payload),
    openDir: () => ipcRenderer.invoke(IPC_CHANNELS.LOGGER_OPEN_DIR),
  }),
  app: Object.freeze({
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getEnvVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_ENV_VERSION),
    getName: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_NAME),
  }),
  vfs: Object.freeze({
    initWorkspace: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    createFolder: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FOLDER, payload),
    renameNode: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RENAME_NODE, payload),
    readContent: (contentId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload),
    saveImage: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_SAVE_IMAGE, payload),
    showNoteInFolder: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, nodeId),
    deleteNode: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_DELETE_NODE, nodeId),
    moveNode: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_MOVE_NODE, payload),
    toggleNodeLock: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, payload),
    getTrashedNodes: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_TRASHED_NODES),
    restoreNode: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RESTORE_NODE, nodeId),
    permanentlyDeleteNode: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_PERMANENTLY_DELETE_NODE, nodeId),
    emptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_EMPTY_TRASH),
    confirmPermanentDeleteNode: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_PERMANENT_DELETE_NODE),
    confirmEmptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_EMPTY_TRASH),
    confirmDeleteNode: (name) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_DELETE_NODE, name),
    confirmRecoverVersion: () => ipcRenderer.invoke(IPC_CHANNELS.VFS_CONFIRM_RECOVER_VERSION),
    getHistory: (contentId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_HISTORY, contentId),
    getHistoryContent: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_GET_HISTORY_CONTENT, payload),
    recoverVersion: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RECOVER_VERSION, payload),
  }),
  search: Object.freeze({
    searchNotes: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_NOTES, query),
  }),
  workspace: Object.freeze({
    showContextMenu: (payload) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, payload),
  }),
  editor: Object.freeze({
    showContextMenu: (payload) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_SHOW_CONTEXT_MENU, payload),
    readClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_READ_CLIPBOARD),
    writeClipboard: (text) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_WRITE_CLIPBOARD, text),
  }),
  menu: Object.freeze({
    onOpenPreferences: (callback) => {
      const subscription = (_event) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
    },
    onOpenAbout: (callback) => {
      const subscription = (_event) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_ABOUT, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_ABOUT, subscription);
    },
    onCheckForUpdates: (callback) => {
      const subscription = (_event) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_CHECK_FOR_UPDATES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_CHECK_FOR_UPDATES, subscription);
    }
  }),
  settings: Object.freeze({
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
    saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, config),
    setStartup: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_STARTUP, enabled),
    pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY),
    confirmEmbeddingSourceChange: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_EMBEDDING_SOURCE_CHANGE),
    confirmDeleteAiSource: (name) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_DELETE_AI_SOURCE, name),
    confirmResetSyncProvider: (name) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONFIRM_RESET_SYNC_PROVIDER, name),
    switchLanguage: (locale) => ipcRenderer.send(IPC_CHANNELS.SETTINGS_SWITCH_LANGUAGE, locale),
    exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_EXPORT),
    importConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IMPORT),
    resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  }),
  aiSource: Object.freeze({
    testConnection: (config) => ipcRenderer.invoke(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, config),
  }),
  sync: Object.freeze({
    testConnection: (config) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_TEST_CONNECTION, config),
    run: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RUN, payload),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),
  }),
  shortcuts: Object.freeze({
    getCommands: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS),
    getCommandsByCategory: (category) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS_BY_CATEGORY, category),
    loadKeybindings: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_LOAD_KEYBINDINGS),
    saveKeybindings: (keybindings) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_SAVE_KEYBINDINGS, keybindings),
    addKeybinding: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_ADD_KEYBINDING, payload),
    removeKeybinding: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_REMOVE_KEYBINDING, payload),
    resetToDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_RESET_TO_DEFAULTS),
    confirmResetToDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_CONFIRM_RESET_TO_DEFAULTS),
    detectConflicts: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_DETECT_CONFLICTS, payload),
    validateKeybinding: (key) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_VALIDATE_KEYBINDING, key),
    normalizeKeybinding: (key) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_NORMALIZE_KEYBINDING, key),
    getKeybindingsForCommand: (commandId) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET_KEYBINDINGS_FOR_COMMAND, commandId),
    exportKeybindings: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_EXPORT_KEYBINDINGS),
    importKeybindings: (config) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_IMPORT_KEYBINDINGS, config),
  }),
  rag: Object.freeze({
    initialize: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_INITIALIZE),
    indexNote: (request) => ipcRenderer.invoke(IPC_CHANNELS.RAG_INDEX_NOTE, request),
    rebuildIndex: (request) => ipcRenderer.invoke(IPC_CHANNELS.RAG_REBUILD_INDEX, request),
    searchText: (request) => ipcRenderer.invoke(IPC_CHANNELS.RAG_SEARCH_TEXT, request),
    askQuestion: (payload) => ipcRenderer.invoke(IPC_CHANNELS.RAG_ASK_QUESTION, payload),
    deleteNoteIndex: (noteId) => ipcRenderer.invoke(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, noteId),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.RAG_GET_STATUS),
  }),
  aiChat: Object.freeze({
    generate: (payload) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE, payload),
    generateCompletion: (payload) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_GENERATE_COMPLETION, payload),
  }),
  updater: Object.freeze({
    check: (silent) => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK, silent),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_GET_VERSION),
    updateConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_UPDATE_CONFIG, config),
    onChecking: (callback) => {
      const subscription = () => callback();
      ipcRenderer.on(IPC_CHANNELS.UPDATER_CHECKING, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_CHECKING, subscription);
    },
    onAvailable: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_AVAILABLE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_AVAILABLE, subscription);
    },
    onNotAvailable: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_NOT_AVAILABLE, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_NOT_AVAILABLE, subscription);
    },
    onDownloadProgress: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_DOWNLOAD_PROGRESS, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_DOWNLOAD_PROGRESS, subscription);
    },
    onDownloaded: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_DOWNLOADED, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_DOWNLOADED, subscription);
    },
    onError: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_ERROR, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_ERROR, subscription);
    },
  }),
});

contextBridge.exposeInMainWorld(IPC_CHANNELS.ELECTRON_API, electronAPI);
