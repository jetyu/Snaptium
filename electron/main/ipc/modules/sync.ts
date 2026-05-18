import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { syncService } from '../../services/sync/sync.service.js';
import { SYNC_INTERVALS, SYNC_PROVIDERS, SYNC_TRIGGERS } from '../../../shared/sync.constants.js';
import { getErrorCode, getErrorMessage } from '../../services/error.service.js';

const providerSchema = z.enum([SYNC_PROVIDERS.WEBDAV, SYNC_PROVIDERS.OSS_S3]);
const intervalSchema = z.union([
  z.literal(SYNC_INTERVALS.MANUAL),
  z.literal(SYNC_INTERVALS.FIVE_MINUTES),
  z.literal(SYNC_INTERVALS.TEN_MINUTES),
  z.literal(SYNC_INTERVALS.FIFTEEN_MINUTES),
]);
const triggerSchema = z.enum([SYNC_TRIGGERS.MANUAL, SYNC_TRIGGERS.TIMER, SYNC_TRIGGERS.SAVE]);

const syncConfigSchema = z.object({
  enabled: z.boolean(),
  provider: providerSchema,
  intervalMinutes: intervalSchema,
  autoSyncOnSave: z.boolean(),
  remotePath: z.string(),
  webdav: z.object({
    url: z.string(),
    username: z.string(),
    password: z.string(),
  }),
  ossS3: z.object({
    endpoint: z.string(),
    region: z.string(),
    bucket: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    forcePathStyle: z.boolean().optional().default(true),
  }),
  lastSyncedAt: z.number().nullable().optional(),
});

function serializeSyncError(error: unknown): {
  success: false;
  code: string;
  message: string;
} {
  const code = getErrorCode(error);
  return {
    success: false,
    code: code ?? 'UNKNOWN',
    message: getErrorMessage(error, 'Sync request failed.'),
  };
}

export function registerSyncHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.SYNC_TEST_CONNECTION);
  ipcMain.removeHandler(IPC_CHANNELS.SYNC_RUN);
  ipcMain.removeHandler(IPC_CHANNELS.SYNC_GET_STATUS);
  ipcMain.removeHandler(IPC_CHANNELS.SYNC_RESTORE_REMOTE_KEY_SLOTS);

  ipcMain.handle(IPC_CHANNELS.SYNC_TEST_CONNECTION, async (_event, config = {}) => {
    try {
      return await syncService.testConnection(syncConfigSchema.parse(config));
    } catch (error) {
      return serializeSyncError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_RUN, async (_event, payload = {}) => {
    try {
      const schema = z.object({
        config: syncConfigSchema,
        trigger: triggerSchema.default(SYNC_TRIGGERS.MANUAL),
      });
      const data = schema.parse(payload);
      return await syncService.runSync(data.config, { trigger: data.trigger });
    } catch (error) {
      return serializeSyncError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, async () => {
    return await syncService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_RESTORE_REMOTE_KEY_SLOTS, async (_event, config = {}) => {
    try {
      return await syncService.restoreRemoteKeySlots(syncConfigSchema.parse(config));
    } catch (error) {
      return serializeSyncError(error);
    }
  });
}
