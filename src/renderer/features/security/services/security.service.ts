import { electronApi, type AccessControlConfig, type AccessControlStatePayload } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';

export interface SecurityError {
  code: string;
  message: string;
}

export interface E2eeStatus {
  hasKeySlots: boolean;
  isUnlocked: boolean;
}

export interface AccessControlStatus {
  config: AccessControlConfig;
  isLocked: boolean;
}

interface BridgeErrorResult {
  success: false;
  code: string;
  message: string;
}

type BridgeResult<T> = ({ success: true } & T) | BridgeErrorResult;

function createSecurityError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

function assertBridgeSuccess<T>(result: BridgeResult<T>): asserts result is { success: true } & T {
  if (!result.success) {
    throw createSecurityError(result.code, result.message);
  }
}

export function normalizeSecurityError(error: unknown): SecurityError {
  const fallbackCode = 'UNKNOWN';
  const fallbackMessage = 'Security operation failed';

  if (error instanceof Error) {
    const code = typeof (error as Error & { code?: string }).code === 'string'
      ? String((error as Error & { code?: string }).code)
      : fallbackCode;
    return {
      code,
      message: error.message || fallbackMessage,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : fallbackCode,
      message: typeof record.message === 'string' ? record.message : getErrorMessage(error, fallbackMessage),
    };
  }

  return {
    code: fallbackCode,
    message: getErrorMessage(error, fallbackMessage),
  };
}

export const securityService = {
  isAvailable(): boolean {
    return electronApi.e2ee.isAvailable();
  },

  isAccessControlAvailable(): boolean {
    return electronApi.accessControl.isAvailable();
  },

  async getStatus(): Promise<E2eeStatus> {
    const hasKeySlotsResult = await electronApi.e2ee.hasKeySlots();
    assertBridgeSuccess(hasKeySlotsResult);

    if (!hasKeySlotsResult.hasKeySlots) {
      return {
        hasKeySlots: false,
        isUnlocked: false,
      };
    }

    const isUnlockedResult = await electronApi.e2ee.isUnlocked();
    assertBridgeSuccess(isUnlockedResult);

    return {
      hasKeySlots: true,
      isUnlocked: isUnlockedResult.isUnlocked,
    };
  },

  async getAccessControlStatus(): Promise<AccessControlStatus> {
    const configResult = await electronApi.accessControl.getConfig();
    assertBridgeSuccess(configResult);

    const isLockedResult = await electronApi.accessControl.isLocked();
    assertBridgeSuccess(isLockedResult);

    return {
      config: configResult.config,
      isLocked: isLockedResult.isLocked,
    };
  },

  async updateAccessControlConfig(config: AccessControlConfig): Promise<void> {
    const result = await electronApi.accessControl.updateConfig(config);
    assertBridgeSuccess(result);
  },

  async lockAccessControl(): Promise<void> {
    const result = await electronApi.accessControl.lock();
    assertBridgeSuccess(result);
  },

  async unlockAccessControl(password: string): Promise<void> {
    const result = await electronApi.accessControl.unlock(password);
    assertBridgeSuccess(result);
  },

  onAccessControlStateChanged(callback: (payload: AccessControlStatePayload) => void): (() => void) | null {
    if (!electronApi.accessControl.isAvailable()) {
      return null;
    }

    return electronApi.accessControl.onStateChanged(callback);
  },

  async exportRecoveryKey(recoveryKey: string): Promise<{ canceled: boolean; filePath?: string }> {
    const result = await electronApi.e2ee.exportRecoveryKey(recoveryKey);
    assertBridgeSuccess(result);
    return {
      canceled: result.canceled,
      filePath: result.filePath,
    };
  },

  async setupPassword(password: string): Promise<string> {
    const result = await electronApi.e2ee.setupPassword(password);
    assertBridgeSuccess(result);
    return result.recoveryKey;
  },

  async unlock(password: string): Promise<void> {
    const result = await electronApi.e2ee.unlock(password);
    assertBridgeSuccess(result);
  },

  async unlockWithRecovery(recoveryKey: string): Promise<void> {
    const result = await electronApi.e2ee.unlockWithRecovery(recoveryKey);
    assertBridgeSuccess(result);
  },

  async lock(): Promise<void> {
    const result = await electronApi.e2ee.lock();
    assertBridgeSuccess(result);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<string> {
    const result = await electronApi.e2ee.changePassword({
      oldPassword,
      newPassword,
    });
    assertBridgeSuccess(result);
    return result.recoveryKey;
  },

  async resetPassword(recoveryKey: string, newPassword: string): Promise<string> {
    const result = await electronApi.e2ee.resetPassword({
      recoveryKey,
      newPassword,
    });
    assertBridgeSuccess(result);
    return result.recoveryKey;
  },
};



