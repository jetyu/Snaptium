export const SYNC_PROVIDERS = Object.freeze({
  WEBDAV: 'webdav',
  OSS_S3: 'oss-s3',
} as const);

export type SyncProvider = (typeof SYNC_PROVIDERS)[keyof typeof SYNC_PROVIDERS];

export const SYNC_INTERVALS = Object.freeze({
  MANUAL: 0,
  FIVE_MINUTES: 5,
  TEN_MINUTES: 10,
  FIFTEEN_MINUTES: 15,
} as const);

export type SyncIntervalMinutes = (typeof SYNC_INTERVALS)[keyof typeof SYNC_INTERVALS];

export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error',
} as const);

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export const SYNC_TRIGGERS = Object.freeze({
  MANUAL: 'manual',
  TIMER: 'timer',
  SAVE: 'save',
} as const);

export type SyncTrigger = (typeof SYNC_TRIGGERS)[keyof typeof SYNC_TRIGGERS];

export const SYNC_ERROR_CODES = Object.freeze({
  CANCELLED: 'CANCELLED',
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  PROVIDER_CONNECTION_FAILED: 'PROVIDER_CONNECTION_FAILED',
  REMOTE_LOCKED: 'REMOTE_LOCKED',
  SYNC_FAILED: 'SYNC_FAILED',
  UNKNOWN: 'UNKNOWN',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  WORKSPACE_UNAVAILABLE: 'WORKSPACE_UNAVAILABLE',
  E2EE_NOT_UNLOCKED: 'E2EE_NOT_UNLOCKED',
  MASTER_PASSWORD_REQUIRED: 'MASTER_PASSWORD_REQUIRED',
} as const);

export type SyncErrorCode = (typeof SYNC_ERROR_CODES)[keyof typeof SYNC_ERROR_CODES];

export const SYNC_REMOTE_METADATA = Object.freeze({
  DIRECTORY: '.snaptive-sync',
  LOCK_FILE: 'lock.json',
  MANIFEST_FILE: 'manifest.json',
} as const);

export const SYNC_RUNTIME = Object.freeze({
  LOCK_TTL_MS: 2 * 60 * 1000,
  SESSION_STALE_MS: 3 * 60 * 1000,
} as const);

export const SYNC_MANIFEST_VERSION = 1;

export const DEFAULT_SYNC_SETTINGS = Object.freeze({
  enabled: false,
  provider: SYNC_PROVIDERS.WEBDAV,
  intervalMinutes: SYNC_INTERVALS.MANUAL,
  autoSyncOnSave: false,
  remotePath: '/snaptive',
  webdav: Object.freeze({
    url: '',
    username: '',
    password: '',
  }),
  ossS3: Object.freeze({
    endpoint: '',
    region: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    forcePathStyle: true,
  }),
  lastSyncedAt: null,
});
