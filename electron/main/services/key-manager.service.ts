import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import {
  E2EE_ERROR_CODES,
  type E2eeErrorCode,
  E2EE_KEY_SLOTS_FILE,
  E2EE_KEY_SLOTS_VERSION,
} from '../../shared/e2ee.constants.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { loggerService } from './logger.service.js';
import { cryptoService, type KeySlots, type WrappedKey } from './crypto.service.js';
import { getErrorCode, getErrorMessage } from '../utils/error.utils.js';

const logger = loggerService.createLogger('Electron:Key Manager');
const E2EE_ERROR_CODE_SET = new Set<E2eeErrorCode>(
  Object.values(E2EE_ERROR_CODES) as E2eeErrorCode[],
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface KeySlotsFile {
  version: number;
  passwordSlot: {
    salt: string;
    wrappedDEK: WrappedKey;
  };
  recoverySlot: {
    wrappedDEK: WrappedKey;
  };
  createdAt: number;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function createE2eeError(code: E2eeErrorCode, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: E2eeErrorCode }).code = code;
  return error;
}

function hasE2eeCode(error: unknown): error is Error & { code: E2eeErrorCode } {
  const code = getErrorCode(error);
  if (!code) {
    return false;
  }

  return E2EE_ERROR_CODE_SET.has(code as E2eeErrorCode);
}

function getKeySlotsPath(): string {
  return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), E2EE_KEY_SLOTS_FILE);
}

function isValidWrappedKey(value: unknown): value is WrappedKey {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.ciphertext === 'string' &&
    typeof record.iv === 'string' &&
    typeof record.authTag === 'string'
  );
}

function isValidKeySlots(value: unknown): value is KeySlotsFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.version !== 'number' ||
    record.version !== E2EE_KEY_SLOTS_VERSION ||
    typeof record.createdAt !== 'number'
  ) {
    return false;
  }

  const passwordSlot = record.passwordSlot as Record<string, unknown> | undefined;
  if (!passwordSlot || typeof passwordSlot.salt !== 'string' || !isValidWrappedKey(passwordSlot.wrappedDEK)) {
    return false;
  }

  const recoverySlot = record.recoverySlot as Record<string, unknown> | undefined;
  if (!recoverySlot || !isValidWrappedKey(recoverySlot.wrappedDEK)) {
    return false;
  }

  return true;
}

function normalizeKeySlots(value: unknown): KeySlots {
  if (!isValidKeySlots(value)) {
    logger.warn('Key slots payload has invalid structure or unsupported version');
    throw createE2eeError(E2EE_ERROR_CODES.KEY_SLOTS_CORRUPTED, 'Invalid key slots payload');
  }

  return {
    version: value.version,
    passwordSlot: {
      salt: value.passwordSlot.salt,
      wrappedDEK: {
        ciphertext: value.passwordSlot.wrappedDEK.ciphertext,
        iv: value.passwordSlot.wrappedDEK.iv,
        authTag: value.passwordSlot.wrappedDEK.authTag,
      },
    },
    recoverySlot: {
      wrappedDEK: {
        ciphertext: value.recoverySlot.wrappedDEK.ciphertext,
        iv: value.recoverySlot.wrappedDEK.iv,
        authTag: value.recoverySlot.wrappedDEK.authTag,
      },
    },
    createdAt: value.createdAt,
  };
}

// ─── State ──────────────────────────────────────────────────────────────────

/**
 * In-memory DEK. Only populated after successful unlock.
 * Cleared on lock. Never persisted to disk.
 */
let activeDEK: Buffer | null = null;

// ─── Exported Service ───────────────────────────────────────────────────────

export const keyManagerService = {
  // ── Persistence ─────────────────────────────────────────────────────────

  async loadKeySlots(): Promise<KeySlots | null> {
    const filePath = getKeySlotsPath();
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);

      return normalizeKeySlots(parsed);
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null;
      }
      if (hasE2eeCode(error)) {
        throw error;
      }
      logger.error('Failed to load key slots', { error: getErrorMessage(error) });
      throw createE2eeError(E2EE_ERROR_CODES.KEY_SLOTS_CORRUPTED, 'Failed to load key slots');
    }
  },

  async saveKeySlots(slots: KeySlots): Promise<void> {
    const filePath = getKeySlotsPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(slots, null, 2), 'utf8');
    logger.info('Key slots saved successfully');
  },

  async hasKeySlots(): Promise<boolean> {
    const slots = await this.loadKeySlots();
    return slots !== null;
  },

  async restoreKeySlots(rawSlots: unknown): Promise<void> {
    const slots = normalizeKeySlots(rawSlots);
    await this.saveKeySlots(slots);
    this.lock();
    logger.info('Key slots restored successfully');
  },

  // ── First-time Setup ───────────────────────────────────────────────────

  async setupMasterPassword(password: string): Promise<{ recoveryKey: string }> {
    const existingSlots = await this.loadKeySlots();
    if (existingSlots !== null) {
      throw createE2eeError(
        E2EE_ERROR_CODES.ALREADY_SETUP,
        'Master Password is already configured. Use changePassword to update it.',
      );
    }

    try {
      // 1. Generate salt + derive KEK
      const salt = cryptoService.generateSalt();
      const kek = await cryptoService.deriveKEK(password, salt);

      // 2. Generate DEK
      const dek = cryptoService.generateDEK();

      // 3. Wrap DEK with password-derived KEK
      const passwordWrappedDEK = cryptoService.wrapDEK(dek, kek);

      // 4. Generate Recovery Key + wrap DEK with recovery KEK
      const { displayKey, rawKey } = cryptoService.generateRecoveryKey();
      const recoveryKEK = cryptoService.deriveRecoveryKEK(rawKey);
      const recoveryWrappedDEK = cryptoService.wrapDEK(dek, recoveryKEK);

      // 5. Build and persist key slots
      const keySlots: KeySlots = {
        version: E2EE_KEY_SLOTS_VERSION,
        passwordSlot: {
          salt: salt.toString('base64'),
          wrappedDEK: passwordWrappedDEK,
        },
        recoverySlot: {
          wrappedDEK: recoveryWrappedDEK,
        },
        createdAt: Date.now(),
      };
      await this.saveKeySlots(keySlots);

      // 6. Unlock DEK into memory
      activeDEK = dek;

      logger.info('Master Password setup completed successfully');
      return { recoveryKey: displayKey };
    } catch (error: unknown) {
      if (hasE2eeCode(error)) {
        throw error;
      }
      logger.error('Master Password setup failed', { error: getErrorMessage(error) });
      throw createE2eeError(E2EE_ERROR_CODES.SETUP_FAILED, 'Failed to set up Master Password');
    }
  },

  // ── Unlock / Lock ─────────────────────────────────────────────────────

  async unlockWithPassword(password: string): Promise<void> {
    const slots = await this.loadKeySlots();
    if (!slots) {
      throw createE2eeError(
        E2EE_ERROR_CODES.KEY_SLOTS_NOT_FOUND,
        'No key slots found. Set up a Master Password first.',
      );
    }

    const salt = Buffer.from(slots.passwordSlot.salt, 'base64');
    const kek = await cryptoService.deriveKEK(password, salt);
    const dek = cryptoService.unwrapDEK(slots.passwordSlot.wrappedDEK, kek);

    activeDEK = dek;
    logger.info('DEK unlocked successfully with Master Password');
  },

  async unlockWithRecoveryKey(recoveryKeyInput: string): Promise<void> {
    const slots = await this.loadKeySlots();
    if (!slots) {
      throw createE2eeError(
        E2EE_ERROR_CODES.KEY_SLOTS_NOT_FOUND,
        'No key slots found. Set up a Master Password first.',
      );
    }

    try {
      const rawKey = cryptoService.parseRecoveryKeyInput(recoveryKeyInput);
      const recoveryKEK = cryptoService.deriveRecoveryKEK(rawKey);
      const dek = cryptoService.unwrapDEK(slots.recoverySlot.wrappedDEK, recoveryKEK);

      activeDEK = dek;
      logger.info('DEK unlocked successfully with Recovery Key');
    } catch (error: unknown) {
      if (hasE2eeCode(error) && error.code === E2EE_ERROR_CODES.WRONG_PASSWORD) {
        throw createE2eeError(
          E2EE_ERROR_CODES.RECOVERY_KEY_INVALID,
          'Invalid Recovery Key',
        );
      }

      if (hasE2eeCode(error)) {
        throw error;
      }
      throw createE2eeError(
        E2EE_ERROR_CODES.RECOVERY_KEY_INVALID,
        'Invalid Recovery Key',
      );
    }
  },

  lock(): void {
    if (activeDEK) {
      // Overwrite memory before releasing reference
      activeDEK.fill(0);
      activeDEK = null;
    }
    logger.info('DEK locked — cleared from memory');
  },

  isUnlocked(): boolean {
    return activeDEK !== null;
  },

  // ── DEK Access ────────────────────────────────────────────────────────

  getDEK(): Buffer {
    if (!activeDEK) {
      throw createE2eeError(
        E2EE_ERROR_CODES.DEK_NOT_UNLOCKED,
        'DEK is not unlocked. Enter your Master Password first.',
      );
    }
    return activeDEK;
  },

  // ── Password Change & Reset ───────────────────────────────────────────

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<{ recoveryKey: string }> {
    // 1. Verify old password by attempting unlock
    const slots = await this.loadKeySlots();
    if (!slots) {
      throw createE2eeError(
        E2EE_ERROR_CODES.KEY_SLOTS_NOT_FOUND,
        'No key slots found. Set up a Master Password first.',
      );
    }

    const oldSalt = Buffer.from(slots.passwordSlot.salt, 'base64');
    const oldKEK = await cryptoService.deriveKEK(oldPassword, oldSalt);
    const dek = cryptoService.unwrapDEK(slots.passwordSlot.wrappedDEK, oldKEK);

    return this.reWrapDEK(dek, newPassword, slots);
  },

  async resetPasswordWithRecoveryKey(
    recoveryKeyInput: string,
    newPassword: string,
  ): Promise<{ recoveryKey: string }> {
    // 1. Verify recovery key by attempting unlock
    const slots = await this.loadKeySlots();
    if (!slots) {
      throw createE2eeError(
        E2EE_ERROR_CODES.KEY_SLOTS_NOT_FOUND,
        'No key slots found. Set up a Master Password first.',
      );
    }

    const rawKey = cryptoService.parseRecoveryKeyInput(recoveryKeyInput);
    const recoveryKEK = cryptoService.deriveRecoveryKEK(rawKey);
    const dek = cryptoService.unwrapDEK(slots.recoverySlot.wrappedDEK, recoveryKEK);

    return this.reWrapDEK(dek, newPassword, slots);
  },

  async reWrapDEK(
    dek: Buffer,
    newPassword: string,
    existingSlots: KeySlots,
  ): Promise<{ recoveryKey: string }> {
    try {
      // 2. Create new password slot
      const newSalt = cryptoService.generateSalt();
      const newKEK = await cryptoService.deriveKEK(newPassword, newSalt);
      const newPasswordWrappedDEK = cryptoService.wrapDEK(dek, newKEK);

      // 3. Create new recovery slot
      const { displayKey, rawKey } = cryptoService.generateRecoveryKey();
      const recoveryKEK = cryptoService.deriveRecoveryKEK(rawKey);
      const newRecoveryWrappedDEK = cryptoService.wrapDEK(dek, recoveryKEK);

      // 4. Update and persist
      const updatedSlots: KeySlots = {
        ...existingSlots,
        passwordSlot: {
          salt: newSalt.toString('base64'),
          wrappedDEK: newPasswordWrappedDEK,
        },
        recoverySlot: {
          wrappedDEK: newRecoveryWrappedDEK,
        },
      };
      await this.saveKeySlots(updatedSlots);

      // 5. Keep DEK unlocked
      activeDEK = dek;

      logger.info('Master Password re-wrapped successfully');
      return { recoveryKey: displayKey };
    } catch (error: unknown) {
      if (hasE2eeCode(error)) {
        throw error;
      }
      logger.error('Key re-wrapping failed', { error: getErrorMessage(error) });
      throw createE2eeError(
        E2EE_ERROR_CODES.PASSWORD_CHANGE_FAILED,
        'Failed to update Master Password',
      );
    }
  },
};
