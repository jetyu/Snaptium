import { BrowserWindow } from 'electron';
import { ACCESS_CONTROL_TIMEOUT_OPTIONS, type AccessControlTimeout } from '../../shared/e2ee.constants.js';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { loggerService } from './logger.service.js';
import { keyManagerService } from './key-manager.service.js';
import { cryptoService } from './crypto.service.js';
import { settingsService, type AccessControlConfig } from './settings.service.js';

const logger = loggerService.createLogger('Electron:AccessControl');

// ─── State ──────────────────────────────────────────────────────────────────

let config: AccessControlConfig = {
  enabled: false,
  lockOnStartup: false,
  autoLockTimeoutMinutes: ACCESS_CONTROL_TIMEOUT_OPTIONS.DISABLED,
};

let locked = false;
let autoLockTimerId: ReturnType<typeof setTimeout> | null = null;

// ─── Internal Helpers ───────────────────────────────────────────────────────

function clearAutoLockTimer(): void {
  if (autoLockTimerId !== null) {
    clearTimeout(autoLockTimerId);
    autoLockTimerId = null;
  }
}

function startAutoLockTimer(): void {
  clearAutoLockTimer();

  if (
    !config.enabled ||
    config.autoLockTimeoutMinutes === ACCESS_CONTROL_TIMEOUT_OPTIONS.DISABLED ||
    locked
  ) {
    return;
  }

  const timeoutMs = config.autoLockTimeoutMinutes * 60 * 1000;
  autoLockTimerId = setTimeout(() => {
    logger.info('Auto-lock triggered after idle timeout');
    accessControlService.lock();
  }, timeoutMs);
}

function notifyRendererLockState(isLocked: boolean): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.ACCESS_CONTROL_STATE_CHANGED, { locked: isLocked });
    }
  }
}

// ─── Exported Service ───────────────────────────────────────────────────────

export const accessControlService = {
  /**
   * Initialize Access Control with the given configuration.
   * Should be called on app startup. Performs a safety check for key slots.
   */
  async initialize(): Promise<void> {
    const preferences = await settingsService.loadConfig();
    const initialConfig = preferences.accessControl;
    
    // SAFETY PRE-CHECK: If keys are missing, we MUST disable access control
    const hasKeys = await keyManagerService.hasKeySlots();
    if (initialConfig.enabled && !hasKeys) {
      logger.warn('Access Control is enabled in settings but key-slots.json is missing. Safety fallback: Disabling.');
      initialConfig.enabled = false;
      await settingsService.saveConfig({ ...preferences, accessControl: initialConfig });
    }

    this.applyConfig(initialConfig);

    if (config.enabled && config.lockOnStartup) {
      locked = true;
      logger.info('Access control locked on startup');
    }
  },

  /**
   * Update the Access Control configuration and persist to settings.
   */
  async updateConfig(newConfig: Partial<AccessControlConfig>): Promise<void> {
    const preferences = await settingsService.loadConfig();
    const mergedConfig = {
      ...preferences.accessControl,
      ...newConfig,
    };

    // Prevent enabling if keys are missing
    if (mergedConfig.enabled) {
      const hasKeys = await keyManagerService.hasKeySlots();
      if (!hasKeys) {
        logger.error('Cannot enable Access Control: key-slots.json is missing.');
        mergedConfig.enabled = false;
      }
    }

    await settingsService.saveConfig({ ...preferences, accessControl: mergedConfig });
    this.applyConfig(mergedConfig);
  },

  /**
   * Internal method to apply configuration to memory state.
   */
  applyConfig(newConfig: Partial<AccessControlConfig>): void {
    config = {
      enabled: typeof newConfig.enabled === 'boolean' ? newConfig.enabled : config.enabled,
      lockOnStartup: typeof newConfig.lockOnStartup === 'boolean' ? newConfig.lockOnStartup : config.lockOnStartup,
      autoLockTimeoutMinutes: normalizeTimeout(newConfig.autoLockTimeoutMinutes),
    };

    if (!config.enabled) {
      clearAutoLockTimer();
      if (locked) {
        locked = false;
        notifyRendererLockState(false);
      }
    }
  },

  /**
   * Lock the application. This is access control only — it does NOT affect E2EE DEK state.
   */
  lock(): void {
    if (!config.enabled) {
      return;
    }

    locked = true;
    clearAutoLockTimer();
    notifyRendererLockState(true);
    logger.info('Access control locked');
  },

  /**
   * Unlock the application with the Master Password.
   * Validates against the stored key slots to verify the password is correct.
   */
  async unlock(password: string): Promise<void> {
    // Verify the password is correct by attempting to unlock the DEK
    if (!keyManagerService.isUnlocked()) {
      await keyManagerService.unlockWithPassword(password);
    } else {
      // DEK already unlocked — still verify the password is correct
      const slots = await keyManagerService.loadKeySlots();
      if (slots) {
        const salt = Buffer.from(slots.passwordSlot.salt, 'base64');
        const kek = await cryptoService.deriveKEK(password, salt);
        // This will throw WRONG_PASSWORD if the password is incorrect
        cryptoService.unwrapDEK(slots.passwordSlot.wrappedDEK, kek);
      }
    }

    locked = false;
    startAutoLockTimer();
    notifyRendererLockState(false);
    logger.info('App unlocked');
  },

  /**
   * Returns whether the app is currently locked.
   */
  isLocked(): boolean {
    return config.enabled && locked;
  },

  /**
   * Returns the current Access Control configuration.
   */
  getConfig(): AccessControlConfig {
    return { ...config };
  },

  /**
   * Reset the auto-lock idle timer. Call this on user activity.
   */
  resetIdleTimer(): void {
    if (config.enabled && !locked) {
      startAutoLockTimer();
    }
  },

  /**
   * Cleanup on app shutdown.
   */
  destroy(): void {
    clearAutoLockTimer();
  },
};

// ─── Normalization ──────────────────────────────────────────────────────────

function normalizeTimeout(value: unknown): AccessControlTimeout {
  const validValues = new Set<number>(Object.values(ACCESS_CONTROL_TIMEOUT_OPTIONS));
  const normalized = Number(value);
  return validValues.has(normalized) ? (normalized as AccessControlTimeout) : config.autoLockTimeoutMinutes;
}

