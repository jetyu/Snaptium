import fs from 'node:fs/promises';
import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { ACCESS_CONTROL_TIMEOUT_OPTIONS, type AccessControlTimeout } from '../../../shared/e2ee.constants.js';
import { keyManagerService } from '../../services/key-manager.service.js';
import { accessControlService } from '../../services/access-control.service.js';
import { getErrorCode, getErrorMessage } from '../../services/error.service.js';

function serializeE2eeError(error: unknown): {
  success: false;
  code: string;
  message: string;
} {
  const code = getErrorCode(error);
  return {
    success: false,
    code: code ?? 'UNKNOWN',
    message: getErrorMessage(error, 'E2EE operation failed.'),
  };
}

const passwordSchema = z.string().min(1);
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
const recoveryKeySchema = z.string().min(1);
const resetPasswordSchema = z.object({
  recoveryKey: z.string().min(1),
  newPassword: z.string().min(1),
});
const AccessControlTimeoutSchema = z.union([
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.DISABLED),
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.ONE_MINUTE),
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.FIVE_MINUTES),
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.FIFTEEN_MINUTES),
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.THIRTY_MINUTES),
  z.literal(ACCESS_CONTROL_TIMEOUT_OPTIONS.ONE_HOUR),
]).transform((value): AccessControlTimeout => value);

const AccessControlConfigSchema = z.object({
  enabled: z.boolean(),
  lockOnStartup: z.boolean(),
  autoLockTimeoutMinutes: AccessControlTimeoutSchema,
});

export function registerE2eeHandlers(): void {
  // ── Cleanup existing handlers ───────────────────────────────────────────
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_HAS_KEY_SLOTS);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_SETUP_PASSWORD);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_UNLOCK);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_UNLOCK_RECOVERY);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_LOCK);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_IS_UNLOCKED);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_CHANGE_PASSWORD);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_EXPORT_RECOVERY_KEY);
  ipcMain.removeHandler(IPC_CHANNELS.E2EE_RESET_PASSWORD);
  ipcMain.removeHandler(IPC_CHANNELS.ACCESS_CONTROL_GET_CONFIG);
  ipcMain.removeHandler(IPC_CHANNELS.ACCESS_CONTROL_UPDATE_CONFIG);
  ipcMain.removeHandler(IPC_CHANNELS.ACCESS_CONTROL_LOCK);
  ipcMain.removeHandler(IPC_CHANNELS.ACCESS_CONTROL_UNLOCK);
  ipcMain.removeHandler(IPC_CHANNELS.ACCESS_CONTROL_IS_LOCKED);

  // ── E2EE: Key Slots Check ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_HAS_KEY_SLOTS, async () => {
    try {
      const hasSlots = await keyManagerService.hasKeySlots();
      return { success: true, hasKeySlots: hasSlots };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── E2EE: Setup Master Password ────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_SETUP_PASSWORD, async (_event, rawPassword: unknown) => {
    try {
      const password = passwordSchema.parse(rawPassword);
      const result = await keyManagerService.setupMasterPassword(password);
      return { success: true, recoveryKey: result.recoveryKey };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── E2EE: Unlock with Password ────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_UNLOCK, async (_event, rawPassword: unknown) => {
    try {
      const password = passwordSchema.parse(rawPassword);
      await keyManagerService.unlockWithPassword(password);
      return { success: true };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── E2EE: Unlock with Recovery Key ────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_UNLOCK_RECOVERY, async (_event, rawKey: unknown) => {
    try {
      const key = recoveryKeySchema.parse(rawKey);
      await keyManagerService.unlockWithRecoveryKey(key);
      return { success: true };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── E2EE: Lock ────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_LOCK, async () => {
    keyManagerService.lock();
    await keyManagerService.clearAutoUnlockSession();
    return { success: true };
  });

  // ── E2EE: Check Unlock Status ─────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_IS_UNLOCKED, () => {
    return { success: true, isUnlocked: keyManagerService.isUnlocked() };
  });

  // ── E2EE: Change Password ────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.E2EE_CHANGE_PASSWORD, async (_event, rawPayload: unknown) => {
    try {
      const payload = changePasswordSchema.parse(rawPayload);
      const result = await keyManagerService.changePassword(payload.oldPassword, payload.newPassword);
      return { success: true, recoveryKey: result.recoveryKey };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.E2EE_RESET_PASSWORD, async (_event, rawPayload: unknown) => {
    try {
      const payload = resetPasswordSchema.parse(rawPayload);
      const result = await keyManagerService.resetPasswordWithRecoveryKey(payload.recoveryKey, payload.newPassword);
      return { success: true, recoveryKey: result.recoveryKey };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.E2EE_EXPORT_RECOVERY_KEY, async (_event, rawRecoveryKey: unknown) => {
    try {
      const recoveryKey = recoveryKeySchema.parse(rawRecoveryKey);
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: 'snaptium-recovery-key.txt',
        filters: [{ name: 'Text File', extensions: ['txt'] }],
      });

      if (canceled || !filePath) {
        return { success: true, canceled: true };
      }

      await fs.writeFile(filePath, `${recoveryKey}\n`, 'utf8');
      return { success: true, canceled: false, filePath };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── Access Control: Get Config ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCESS_CONTROL_GET_CONFIG, () => {
    return { success: true, config: accessControlService.getConfig() };
  });

  // ── Access Control: Update Config ───────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCESS_CONTROL_UPDATE_CONFIG, async (_event, rawConfig: unknown) => {
    try {
      const parsedConfig = AccessControlConfigSchema.parse(rawConfig);
      await accessControlService.updateConfig(parsedConfig);
      return { success: true };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── Access Control: Lock ────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCESS_CONTROL_LOCK, () => {
    accessControlService.lock();
    return { success: true };
  });

  // ── Access Control: Unlock ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCESS_CONTROL_UNLOCK, async (_event, rawPassword: unknown) => {
    try {
      const password = passwordSchema.parse(rawPassword);
      await accessControlService.unlock(password);
      return { success: true };
    } catch (error: unknown) {
      return serializeE2eeError(error);
    }
  });

  // ── Access Control: Check Lock Status ───────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCESS_CONTROL_IS_LOCKED, () => {
    return { success: true, isLocked: accessControlService.isLocked() };
  });
}

