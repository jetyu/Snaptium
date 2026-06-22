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
  context?: JsonValue;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface AiSourceConfig {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  capabilities: string[];
}

export interface AiSourceTestResult {
  success: boolean;
  message?: string;
}

export interface SyncSummary {
  uploaded: number;
  downloaded: number;
  deletedLocal: number;
  deletedRemote: number;
  merged: number;
  conflicts: number;
}

export interface SyncErrorInfo {
  code: string;
  message: string;
  at?: number;
}

export interface SyncTestConnectionResult {
  success: boolean;
  code?: string;
  message?: string;
}

export interface SyncRestoreRemoteKeySlotsResult {
  success: boolean;
  restored?: boolean;
  code?: string;
  message?: string;
}

export interface SyncRunPayload {
  config: JsonObject;
  trigger: 'manual' | 'timer' | 'save';
}

export interface SyncRunSuccessResult {
  success: true;
  syncedAt: number;
  summary: SyncSummary;
  recoveredPendingSession: boolean;
}

export interface SyncRunErrorResult {
  success: false;
  code: string;
  message: string;
}

export type SyncRunResult = SyncRunSuccessResult | SyncRunErrorResult;

export interface SyncStatusResult {
  success: boolean;
  lastSyncedAt: number | null;
  lastSummary: SyncSummary | null;
  lastError: SyncErrorInfo | null;
  recoveredPendingSession: boolean;
}

export interface E2eeErrorResult {
  success: false;
  code: string;
  message: string;
}

export interface LicenseErrorResult {
  success: false;
  code: string;
  message: string;
}

export type LicenseBridgeResult<T> =
  | { success: true; data: T }
  | LicenseErrorResult;

export interface E2eeOperationResult {
  success: true;
}

export type E2eeHasKeySlotsResult =
  | { success: true; hasKeySlots: boolean }
  | E2eeErrorResult;

export type E2eeIsUnlockedResult =
  | { success: true; isUnlocked: boolean }
  | E2eeErrorResult;

export type E2eeSetupPasswordResult =
  | { success: true; recoveryKey: string }
  | E2eeErrorResult;

export type E2eeChangePasswordResult =
  | { success: true; recoveryKey: string }
  | E2eeErrorResult;

export type E2eeExportRecoveryKeyResult =
  | { success: true; canceled: boolean; filePath?: string }
  | E2eeErrorResult;

export interface AccessControlConfig {
  enabled: boolean;
  lockOnStartup: boolean;
  autoLockTimeoutMinutes: number;
}

export type AccessControlGetConfigResult =
  | { success: true; config: AccessControlConfig }
  | E2eeErrorResult;

export type AccessControlIsLockedResult =
  | { success: true; isLocked: boolean }
  | E2eeErrorResult;

export interface AccessControlStatePayload {
  locked: boolean;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatGeneratePayload {
  messages: AiChatMessage[];
  // Optional explicit override for advanced callers. Default system prompts are built in main.
  systemPrompt?: string;
  promptPreset?: import('@shared/ai.constants').AiPromptPreset;
}

export interface AiChatGenerateCompletionPayload {
  context: string;
  // Optional explicit override for advanced callers. Default system prompts are built in main.
  systemPrompt?: string;
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

export interface WindowStatePayload {
  isMaximized: boolean;
}

export interface WallpaperRequestPayload {
  nextArchive?: boolean;
  currentArchiveIndex?: number;
}

export interface WallpaperResult {
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

export type AppDistribution = import('@shared/updater.constants').AppDistribution;

export interface UpdaterUpdateInfoPayload {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  files?: JsonObject[];
  silent?: boolean;
}

export interface UpdaterProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterCheckPayload {
  silent: boolean;
}

export interface UpdaterErrorPayload {
  message: string;
  code: string;
  silent?: boolean;
}

export interface UpdaterConfigPayload {
  autoCheckUpdates: boolean;
  updateCheckInterval: number;
  updateChannel: 'stable' | 'beta' | 'dev';
}

export interface WorkspaceContextMenuItemPayload {
  action?: string | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  enabled?: boolean;
  checked?: boolean;
  iconDataUrl?: string;
  submenu?: WorkspaceContextMenuItemPayload[];
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
  order?: number;
  contentId?: string;
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;
  locked?: boolean;
  iconColor?: import('@shared/notebook-icon.constants').NotebookIconColor;
  starred?: boolean;
  starredAt?: number;
  tags?: string[];
}

export interface WorkspaceRootPayload {
  root: string;
  nodes: WorkspaceNodePayload[];
}

export interface SavedImagePayload {
  fileName: string;
  filePath: string;
  markdownPath: string;
}

export interface RagIndexNotePayload {
  noteId: string;
  noteTitle: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface RagAskQuestionPayload {
  query: string;
}

export interface RagRunTaskPayload {
  task: string;
  writeMode?: KnowledgeAgentWriteMode;
}

export interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: RagSearchResult[];
  error?: string;
  usedSearchFallback: boolean;
  insufficientEvidence?: boolean;
}

export interface KnowledgeAgentStep {
  title: string;
  detail: string;
  status: 'completed' | 'failed';
}

export interface KnowledgeAgentTraceEvent {
  id: string;
  type: 'model-response' | 'tool-call' | 'tool-result' | 'tool-error';
  title: string;
  detail: string;
  status: 'completed' | 'failed';
  at: number;
  durationMs?: number;
  toolName?: string;
}

export interface KnowledgeAgentCreateNoteProposal {
  id: string;
  type: 'create-note';
  title: string;
  content: string;
  reason: string;
}

export interface KnowledgeAgentUpdateNoteProposal {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeAgentWriteProposal =
  | KnowledgeAgentCreateNoteProposal
  | KnowledgeAgentUpdateNoteProposal;

export type KnowledgeAgentWriteMode = 'confirm' | 'auto';

export interface KnowledgeAgentExecutedCreateNote {
  id: string;
  type: 'create-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export interface KnowledgeAgentExecutedUpdateNote {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeAgentExecutedWrite =
  | KnowledgeAgentExecutedCreateNote
  | KnowledgeAgentExecutedUpdateNote;

export interface KnowledgeAgentTaskResult {
  success: boolean;
  finalAnswer?: string;
  steps: KnowledgeAgentStep[];
  traceEvents: KnowledgeAgentTraceEvent[];
  sources: RagSearchResult[];
  writeMode: KnowledgeAgentWriteMode;
  pendingWrites: KnowledgeAgentWriteProposal[];
  executedWrites: KnowledgeAgentExecutedWrite[];
  stopReason?:
    | 'completed'
    | 'insufficient-evidence'
    | 'tool-call-limit'
    | 'iteration-limit'
    | 'runtime-limit'
    | 'tool-failure-limit'
    | 'weak-search-limit';
  error?: string;
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

export interface HistoryVersion {
  timestamp: number;
  filename: string;
  size: number;
}

export interface DataTransferBaseResult {
  success: boolean;
  cancelled?: boolean;
}

export interface SppxExportResult extends DataTransferBaseResult {
  filePath?: string;
  exportedAt?: number;
}

export interface SppxImportResult extends DataTransferBaseResult {
  filePath?: string;
  importedAt?: number;
}

export interface MarkdownImportResult extends DataTransferBaseResult {
  directoryPath?: string;
  scannedFiles?: number;
  importedNotes?: number;
  createdNotebooks?: number;
  copiedImages?: number;
  skippedFiles?: number;
  skippedImages?: number;
  failedFiles?: number;
  failedFilePaths?: string[];
}

export interface MarkdownExportResult extends DataTransferBaseResult {
  directoryPath?: string;
  exportedNotes?: number;
  createdDirectories?: number;
  copiedImages?: number;
  skippedImages?: number;
  failedFiles?: number;
  failedFilePaths?: string[];
}

export interface NwpImportResult extends DataTransferBaseResult {
  stats?: {
    imported: number;
    skipped: number;
    failed: number;
  };
}

export interface EnexImportResult extends DataTransferBaseResult {
  directoryPath?: string;
  scannedFiles?: number;
  importedNotes?: number;
  createdNotebooks?: number;
  copiedImages?: number;
  skippedFiles?: number;
  skippedImages?: number;
  failedFiles?: number;
  failedFilePaths?: string[];
}

export interface MessageDialogOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
}

export type RagRebuildMode = 'incremental' | 'full' | 'cancel';

interface ShortcutsKeybindingPayload {
  commandId: string;
  key: string;
  when?: string | null;
}

interface ShortcutsKeybindingsConfigPayload {
  version: string;
  keybindings: ShortcutsKeybindingPayload[];
}

function ensureElectronApi(): Window['electronAPI'] {
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

  menu: {
    isAvailable: (): boolean => !!window.electronAPI?.menu,
    getApi: () => {
      const api = ensureElectronApi().menu;
      if (!api) throw new Error('Menu bridge is unavailable');
      return api;
    },
    onOpenPreferences: (callback: () => void) => electronApi.menu.getApi().onOpenPreferences(callback),
    onOpenFile: (callback: () => void) => electronApi.menu.getApi().onOpenFile(callback),
    onOpenAbout: (callback: () => void) => electronApi.menu.getApi().onOpenAbout(callback),
    onCheckForUpdates: (callback: () => void) => electronApi.menu.getApi().onCheckForUpdates(callback),
    onOpenLicense: (callback: () => void) => electronApi.menu.getApi().onOpenLicense(callback),
    onImportMarkdown: (callback: () => void) => electronApi.menu.getApi().onImportMarkdown(callback),
    onImportEnex: (callback: () => void) => electronApi.menu.getApi().onImportEnex(callback),
    onImportSppx: (callback: () => void) => electronApi.menu.getApi().onImportSppx(callback),
    onImportNwp: (callback: () => void) => electronApi.menu.getApi().onImportNwp(callback),
    onExportMarkdown: (callback: () => void) => electronApi.menu.getApi().onExportMarkdown(callback),
    onExportSppx: (callback: () => void) => electronApi.menu.getApi().onExportSppx(callback),
  },

  app: {
    isAvailable: (): boolean => !!window.electronAPI?.app,
    getApi: () => {
      const api = ensureElectronApi().app;
      if (!api) throw new Error('App bridge is unavailable');
      return api;
    },
    getVersion: () => electronApi.app.getApi().getVersion(),
    getDistribution: () => electronApi.app.getApi().getDistribution(),
    getName: () => electronApi.app.getApi().getName(),
    getEnvVersion: () => electronApi.app.getApi().getEnvVersion(),
    openStorePage: () => electronApi.app.getApi().openStorePage(),
  },

  window: {
    isAvailable: (): boolean => !!window.electronAPI?.window,
    getApi: () => {
      const api = ensureElectronApi().window;
      if (!api) throw new Error('Window bridge is unavailable');
      return api;
    },
    minimize: (): Promise<void> => {
      return electronApi.window.getApi().minimize();
    },
    maximize: (): Promise<void> => {
      return electronApi.window.getApi().maximize();
    },
    unmaximize: (): Promise<void> => {
      return electronApi.window.getApi().unmaximize();
    },
    close: (): Promise<void> => {
      return electronApi.window.getApi().close();
    },
    isMaximized: (): Promise<boolean> => {
      return electronApi.window.getApi().isMaximized();
    },
    reload: (): Promise<void> => {
      return electronApi.window.getApi().reload();
    },
    forceReload: (): Promise<void> => {
      return electronApi.window.getApi().forceReload();
    },
    toggleDevTools: (): Promise<void> => {
      return electronApi.window.getApi().toggleDevTools();
    },
    resetZoom: (): Promise<void> => {
      return electronApi.window.getApi().resetZoom();
    },
    zoomIn: (): Promise<void> => {
      return electronApi.window.getApi().zoomIn();
    },
    zoomOut: (): Promise<void> => {
      return electronApi.window.getApi().zoomOut();
    },
    toggleFullscreen: (): Promise<void> => {
      return electronApi.window.getApi().toggleFullscreen();
    },
    onStateChanged: (callback: (data: WindowStatePayload) => void): (() => void) => {
      return electronApi.window.getApi().onStateChanged(callback);
    },
  },

  settings: {
    isAvailable: (): boolean => !!window.electronAPI?.settings,
    getApi: () => {
      const api = ensureElectronApi().settings;
      if (!api) throw new Error('Settings bridge is unavailable');
      return api;
    },
    getConfig: () => electronApi.settings.getApi().getConfig(),
    saveConfig: (config: JsonObject) => electronApi.settings.getApi().saveConfig(config),
    setStartup: (enabled: boolean) => electronApi.settings.getApi().setStartup(enabled),
    switchLanguage: (locale: string) => electronApi.settings.getApi().switchLanguage(locale),
    pickDirectory: () => electronApi.settings.getApi().pickDirectory(),
    confirmEmbeddingSourceChange: () => electronApi.settings.getApi().confirmEmbeddingSourceChange(),
    confirmRagRebuildMode: (): Promise<RagRebuildMode> => electronApi.settings.getApi().confirmRagRebuildMode(),
    confirmDeleteAiSource: (name: string) => electronApi.settings.getApi().confirmDeleteAiSource(name),
    confirmResetSyncProvider: (name: string) => electronApi.settings.getApi().confirmResetSyncProvider(name),
    showMessage: (options: MessageDialogOptions): Promise<boolean> => {
      return electronApi.settings.getApi().showMessage(options);
    },
    exportConfig: () => electronApi.settings.getApi().exportConfig(),
    importConfig: () => electronApi.settings.getApi().importConfig(),
    resetConfig: () => electronApi.settings.getApi().resetConfig(),
  },

  dataTransfer: {
    isAvailable: (): boolean => !!window.electronAPI?.dataTransfer,
    getApi: () => {
      const api = ensureElectronApi().dataTransfer;
      if (!api) throw new Error('Data transfer bridge is unavailable');
      return api;
    },
    importSppx: (): Promise<SppxImportResult> => {
      return electronApi.dataTransfer.getApi().importSppx();
    },
    exportSppx: (): Promise<SppxExportResult> => {
      return electronApi.dataTransfer.getApi().exportSppx();
    },
    importMarkdown: (): Promise<MarkdownImportResult> => {
      return electronApi.dataTransfer.getApi().importMarkdown();
    },
    exportMarkdown: (): Promise<MarkdownExportResult> => {
      return electronApi.dataTransfer.getApi().exportMarkdown();
    },
    importEnex: (): Promise<EnexImportResult> => {
      return electronApi.dataTransfer.getApi().importEnex();
    },
    importNwp: (): Promise<NwpImportResult> => {
      return electronApi.dataTransfer.getApi().importNwp();
    },

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

  sync: {
    isAvailable: (): boolean => !!window.electronAPI?.sync,
    getApi: () => {
      const api = ensureElectronApi().sync;
      if (!api) throw new Error('Sync bridge is unavailable');
      return api;
    },
    testConnection: (config: JsonObject): Promise<SyncTestConnectionResult> => {
      return electronApi.sync.getApi().testConnection(config);
    },
    run: (payload: SyncRunPayload): Promise<SyncRunResult> => {
      return electronApi.sync.getApi().run(payload);
    },
    getStatus: (): Promise<SyncStatusResult> => {
      return electronApi.sync.getApi().getStatus();
    },
    restoreRemoteKeySlots: (config: JsonObject): Promise<SyncRestoreRemoteKeySlotsResult> => {
      return electronApi.sync.getApi().restoreRemoteKeySlots(config);
    },
  },

  e2ee: {
    isAvailable: (): boolean => !!window.electronAPI?.e2ee,
    getApi: () => {
      const api = ensureElectronApi().e2ee;
      if (!api) throw new Error('E2EE bridge is unavailable');
      return api;
    },
    hasKeySlots: (): Promise<E2eeHasKeySlotsResult> => {
      return electronApi.e2ee.getApi().hasKeySlots();
    },
    setupPassword: (password: string): Promise<E2eeSetupPasswordResult> => {
      return electronApi.e2ee.getApi().setupPassword(password);
    },
    unlock: (password: string): Promise<E2eeOperationResult | E2eeErrorResult> => {
      return electronApi.e2ee.getApi().unlock(password);
    },
    unlockWithRecovery: (recoveryKey: string): Promise<E2eeOperationResult | E2eeErrorResult> => {
      return electronApi.e2ee.getApi().unlockWithRecovery(recoveryKey);
    },
    lock: (): Promise<E2eeOperationResult> => {
      return electronApi.e2ee.getApi().lock();
    },
    isUnlocked: (): Promise<E2eeIsUnlockedResult> => {
      return electronApi.e2ee.getApi().isUnlocked();
    },
    changePassword: (payload: { oldPassword: string; newPassword: string }): Promise<E2eeChangePasswordResult> => {
      return electronApi.e2ee.getApi().changePassword(payload);
    },
    resetPassword: (payload: { recoveryKey: string; newPassword: string }): Promise<E2eeChangePasswordResult> => {
      return electronApi.e2ee.getApi().resetPassword(payload);
    },
    exportRecoveryKey: (recoveryKey: string): Promise<E2eeExportRecoveryKeyResult> => {
      return electronApi.e2ee.getApi().exportRecoveryKey(recoveryKey);
    },
  },

  accessControl: {
    isAvailable: (): boolean => !!window.electronAPI?.accessControl,
    getApi: () => {
      const api = ensureElectronApi().accessControl;
      if (!api) throw new Error('Access Control bridge is unavailable');
      return api;
    },
    getConfig: (): Promise<AccessControlGetConfigResult> => {
      return electronApi.accessControl.getApi().getConfig();
    },
    updateConfig: (lockConfig: AccessControlConfig): Promise<E2eeOperationResult | E2eeErrorResult> => {
      return electronApi.accessControl.getApi().updateConfig(lockConfig);
    },
    lock: (): Promise<E2eeOperationResult> => {
      return electronApi.accessControl.getApi().lock();
    },
    unlock: (password: string): Promise<E2eeOperationResult | E2eeErrorResult> => {
      return electronApi.accessControl.getApi().unlock(password);
    },
    isLocked: (): Promise<AccessControlIsLockedResult> => {
      return electronApi.accessControl.getApi().isLocked();
    },
    onStateChanged: (callback: (data: AccessControlStatePayload) => void): (() => void) => {
      return electronApi.accessControl.getApi().onStateChanged(callback);
    },
  },

  license: {
    isAvailable: (): boolean => !!window.electronAPI?.license,
    getApi: () => {
      const api = ensureElectronApi().license;
      if (!api) throw new Error('License bridge is unavailable');
      return api;
    },
    getState: (): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().getState();
    },
    activate: (licenseKey: string): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().activate(licenseKey);
    },
    validate: (force?: boolean): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().validate(force);
    },
    refreshDevices: (force?: boolean): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().refreshDevices(force);
    },
    deactivateDevice: (deviceId: string): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().deactivateDevice(deviceId);
    },
    clear: (): Promise<LicenseBridgeResult<import('@shared/license.constants').LicenseState>> => {
      return electronApi.license.getApi().clear();
    },
    onStateChanged: (callback: (state: import('@shared/license.constants').LicenseState) => void): (() => void) => {
      return electronApi.license.getApi().onStateChanged(callback);
    },
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
    generateCompletion: (payload: AiChatGenerateCompletionPayload) => {
      return electronApi.aiChat.getApi().generateCompletion(payload);
    },
  },

  rag: {
    isAvailable: (): boolean => !!window.electronAPI?.rag,
    getApi: () => {
      const api = ensureElectronApi().rag;
      if (!api) throw new Error('RAG bridge is unavailable');
      return api;
    },
    initialize: () => {
      return electronApi.rag.getApi().initialize();
    },
    indexNote: (payload: RagIndexNotePayload) => {
      return electronApi.rag.getApi().indexNote(payload);
    },
    answerQuestion: (payload: RagAskQuestionPayload): Promise<KnowledgeAnswerResult> => {
      return electronApi.rag.getApi().answerQuestion(payload);
    },
    runTask: (payload: RagRunTaskPayload): Promise<KnowledgeAgentTaskResult> => {
      return electronApi.rag.getApi().runTask(payload);
    },
    deleteNoteIndex: (noteId: string) => {
      return electronApi.rag.getApi().deleteNoteIndex(noteId);
    },
    getStatus: (): Promise<RagStatusResult> => {
      return electronApi.rag.getApi().getStatus();
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
    getDailyWallpaper: (payload: WallpaperRequestPayload = {}): Promise<WallpaperResult> => {
      return electronApi.workspace.getApi().getDailyWallpaper(payload);
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

    saveImage: (payload: { contentId: string; fileName?: string; mimeType: string; dataBase64: string }): Promise<SavedImagePayload> => {
      return electronApi.vfs.getApi().saveImage(payload);
    },

    deleteNodes: (nodeIds: string[]): Promise<WorkspaceNodePayload[]> => {
      return electronApi.vfs.getApi().deleteNodes(nodeIds);
    },

    moveNode: (payload: { nodeId: string; parentId: string | null; index: number }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().moveNode(payload);
    },

    showNoteInFolder: (nodeId: string): Promise<boolean> => {
      return electronApi.vfs.getApi().showNoteInFolder(nodeId);
    },

    toggleNodeLock: (payload: { nodeId: string; locked: boolean }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().toggleNodeLock(payload);
    },

    updateNotebookIconColor: (payload: { nodeId: string; iconColor: import('@shared/notebook-icon.constants').NotebookIconColor | null }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().updateNotebookIconColor(payload);
    },

    updateNodeTags: (payload: { nodeId: string; tags: string[] }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().updateNodeTags(payload);
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

    confirmPermanentDeleteNode: (): Promise<boolean> => {
      return electronApi.vfs.getApi().confirmPermanentDeleteNode();
    },

    confirmEmptyTrash: (): Promise<boolean> => {
      return electronApi.vfs.getApi().confirmEmptyTrash();
    },

    confirmDeleteNode: (name: string): Promise<boolean> => {
      return electronApi.vfs.getApi().confirmDeleteNode(name);
    },

    confirmRecoverVersion: (): Promise<boolean> => {
      return electronApi.vfs.getApi().confirmRecoverVersion();
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

    toggleNodeStar: (payload: { nodeId: string; starred: boolean }): Promise<WorkspaceNodePayload> => {
      return electronApi.vfs.getApi().toggleNodeStar(payload);
    },

    getStarredNodes: (): Promise<WorkspaceNodePayload[]> => {
      return electronApi.vfs.getApi().getStarredNodes();
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
    saveKeybindings: (keybindings: ShortcutsKeybindingPayload[]) => electronApi.shortcuts.getApi().saveKeybindings(keybindings),
    addKeybinding: (payload: { commandId: string; key: string; when?: string | null }) => electronApi.shortcuts.getApi().addKeybinding(payload),
    removeKeybinding: (payload: { commandId: string; key: string }) => electronApi.shortcuts.getApi().removeKeybinding(payload),
    resetToDefaults: () => electronApi.shortcuts.getApi().resetToDefaults(),
    confirmResetToDefaults: () => electronApi.shortcuts.getApi().confirmResetToDefaults(),
    detectConflicts: (payload: { key: string; excludeCommandId?: string }) => electronApi.shortcuts.getApi().detectConflicts(payload),
    validateKeybinding: (key: string) => electronApi.shortcuts.getApi().validateKeybinding(key),
    normalizeKeybinding: (key: string) => electronApi.shortcuts.getApi().normalizeKeybinding(key),
    getKeybindingsForCommand: (commandId: string) => electronApi.shortcuts.getApi().getKeybindingsForCommand(commandId),
    exportKeybindings: () => electronApi.shortcuts.getApi().exportKeybindings(),
    importKeybindings: (config: ShortcutsKeybindingsConfigPayload) => electronApi.shortcuts.getApi().importKeybindings(config),
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
    cancelDownload: () => electronApi.updater.getApi().cancelDownload(),
    install: () => electronApi.updater.getApi().install(),
    getVersion: () => electronApi.updater.getApi().getVersion(),
    updateConfig: (config: UpdaterConfigPayload) => electronApi.updater.getApi().updateConfig(config),
    onChecking: (callback: (data: UpdaterCheckPayload) => void) => electronApi.updater.getApi().onChecking(callback),
    onAvailable: (callback: (data: UpdaterUpdateInfoPayload) => void) => electronApi.updater.getApi().onAvailable(callback),
    onCancelled: (callback: (data: UpdaterUpdateInfoPayload) => void) => electronApi.updater.getApi().onCancelled(callback),
    onNotAvailable: (callback: (data: UpdaterUpdateInfoPayload) => void) => electronApi.updater.getApi().onNotAvailable(callback),
    onDownloadStarted: (callback: (data: UpdaterCheckPayload) => void) => electronApi.updater.getApi().onDownloadStarted(callback),
    onDownloadProgress: (callback: (data: UpdaterProgressPayload) => void) => electronApi.updater.getApi().onDownloadProgress(callback),
    onDownloaded: (callback: (data: UpdaterUpdateInfoPayload) => void) => electronApi.updater.getApi().onDownloaded(callback),
    onError: (callback: (data: UpdaterErrorPayload) => void) => electronApi.updater.getApi().onError(callback),
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


