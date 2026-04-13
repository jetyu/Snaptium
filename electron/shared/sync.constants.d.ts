export declare const SYNC_PROVIDERS: {
  readonly WEBDAV: 'webdav';
  readonly OSS_S3: 'oss-s3';
};

export type SyncProvider = (typeof SYNC_PROVIDERS)[keyof typeof SYNC_PROVIDERS];

export declare const SYNC_INTERVALS: {
  readonly MANUAL: 0;
  readonly FIVE_MINUTES: 5;
  readonly TEN_MINUTES: 10;
  readonly FIFTEEN_MINUTES: 15;
};

export type SyncIntervalMinutes = (typeof SYNC_INTERVALS)[keyof typeof SYNC_INTERVALS];

export declare const SYNC_STATUS: {
  readonly IDLE: 'idle';
  readonly SYNCING: 'syncing';
  readonly ERROR: 'error';
};

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export declare const SYNC_TRIGGERS: {
  readonly MANUAL: 'manual';
  readonly TIMER: 'timer';
  readonly SAVE: 'save';
};

export type SyncTrigger = (typeof SYNC_TRIGGERS)[keyof typeof SYNC_TRIGGERS];

export declare const SYNC_ERROR_CODES: {
  readonly CANCELLED: 'CANCELLED';
  readonly MANIFEST_INVALID: 'MANIFEST_INVALID';
  readonly NOT_CONFIGURED: 'NOT_CONFIGURED';
  readonly PROVIDER_CONNECTION_FAILED: 'PROVIDER_CONNECTION_FAILED';
  readonly REMOTE_LOCKED: 'REMOTE_LOCKED';
  readonly SYNC_FAILED: 'SYNC_FAILED';
  readonly UNKNOWN: 'UNKNOWN';
  readonly UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER';
  readonly WORKSPACE_UNAVAILABLE: 'WORKSPACE_UNAVAILABLE';
};

export type SyncErrorCode = (typeof SYNC_ERROR_CODES)[keyof typeof SYNC_ERROR_CODES];

export declare const SYNC_REMOTE_METADATA: {
  readonly DIRECTORY: '.pilotrix-sync';
  readonly LOCK_FILE: 'lock.json';
  readonly MANIFEST_FILE: 'manifest.json';
};

export declare const SYNC_RUNTIME: {
  readonly LOCK_TTL_MS: number;
  readonly SESSION_STALE_MS: number;
};

export declare const SYNC_MANIFEST_VERSION: 1;

export declare const DEFAULT_SYNC_SETTINGS: {
  readonly enabled: false;
  readonly provider: typeof SYNC_PROVIDERS.WEBDAV;
  readonly intervalMinutes: typeof SYNC_INTERVALS.MANUAL;
  readonly autoSyncOnSave: false;
  readonly remotePath: '/Pilotrix';
  readonly webdav: {
    readonly url: '';
    readonly username: '';
    readonly password: '';
  };
  readonly ossS3: {
    readonly endpoint: '';
    readonly region: '';
    readonly bucket: '';
    readonly accessKeyId: '';
    readonly secretAccessKey: '';
    readonly forcePathStyle: true;
  };
  readonly lastSyncedAt: null;
};