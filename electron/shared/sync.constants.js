export const SYNC_PROVIDERS = Object.freeze({
  WEBDAV: 'webdav',
  OSS_S3: 'oss-s3',
});

export const SYNC_INTERVALS = Object.freeze({
  MANUAL: 0,
  FIVE_MINUTES: 5,
  TEN_MINUTES: 10,
  FIFTEEN_MINUTES: 15,
});

export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error',
});

export const SYNC_TRIGGERS = Object.freeze({
  MANUAL: 'manual',
  TIMER: 'timer',
  SAVE: 'save',
});

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
});

export const SYNC_REMOTE_METADATA = Object.freeze({
  DIRECTORY: '.pilotrix-sync',
  LOCK_FILE: 'lock.json',
  MANIFEST_FILE: 'manifest.json',
});

export const SYNC_RUNTIME = Object.freeze({
  LOCK_TTL_MS: 2 * 60 * 1000,
  SESSION_STALE_MS: 3 * 60 * 1000,
});

export const SYNC_MANIFEST_VERSION = 1;

export const DEFAULT_SYNC_SETTINGS = Object.freeze({
  enabled: false,
  provider: SYNC_PROVIDERS.WEBDAV,
  intervalMinutes: SYNC_INTERVALS.MANUAL,
  autoSyncOnSave: false,
  remotePath: '/Pilotrix',
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