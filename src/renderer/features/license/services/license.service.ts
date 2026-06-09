import { getErrorCode, getErrorMessage } from '@shared/utils/error.utils';
import { createLogger } from '@renderer/features/logger';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { i18n } from '@renderer/features/i18n';
import { LICENSE_ERROR_CODES, type LicenseState } from '@shared/license.constants';
import { useLicenseStore } from '../store/license.store';

const licenseLogger = createLogger('Renderer:LicenseService');

type LicenseStore = ReturnType<typeof useLicenseStore>;

export interface LicenseErrorInfo {
  code: string;
  message: string;
}

function resolveLicenseErrorMessage(code: string): string {
  const t = i18n.global.t.bind(i18n.global);
  const fallbackMessages: Record<string, string> = {
    [LICENSE_ERROR_CODES.LICENSE_INVALID]: t('license.error.invalid'),
    [LICENSE_ERROR_CODES.LICENSE_EXPIRED]: t('license.error.expired'),
    [LICENSE_ERROR_CODES.LICENSE_INACTIVE]: t('license.error.inactive'),
    [LICENSE_ERROR_CODES.MAX_DEVICES_REACHED]: t('license.error.maxDevicesReached'),
    [LICENSE_ERROR_CODES.DEVICE_NOT_FOUND]: t('license.error.deviceNotFound'),
    [LICENSE_ERROR_CODES.CANNOT_DEACTIVATE_CURRENT_DEVICE]: t('license.error.cannotDeactivateCurrentDevice'),
    [LICENSE_ERROR_CODES.TOO_MANY_REQUESTS]: t('license.error.tooManyRequests'),
    [LICENSE_ERROR_CODES.NETWORK_TIMEOUT]: t('license.error.networkTimeout'),
    [LICENSE_ERROR_CODES.NETWORK_ERROR]: t('license.error.network'),
    [LICENSE_ERROR_CODES.UNKNOWN]: t('license.error.unknown'),
  };

  return fallbackMessages[code] ?? t('license.error.unknown');
}

export function normalizeLicenseError(error: unknown): LicenseErrorInfo {
  const code = getErrorCode(error) ?? LICENSE_ERROR_CODES.UNKNOWN;

  return {
    code,
    message: resolveLicenseErrorMessage(code),
  };
}

export function normalizeLicenseErrorMessage(error: unknown): string {
  return normalizeLicenseError(error).message;
}

export function normalizeLicenseStateError(code: string | null, message: string | null): string | null {
  if (!code && !message) {
    return null;
  }

  if (code) {
    return resolveLicenseErrorMessage(code);
  }

  return getErrorMessage(message, resolveLicenseErrorMessage(LICENSE_ERROR_CODES.UNKNOWN));
}

class LicenseService {
  private removeStateListener: (() => void) | null = null;

  private getStore(): LicenseStore {
    return useLicenseStore();
  }

  async initialize(): Promise<LicenseState> {
    if (!electronApi.license.isAvailable()) {
      return this.getStore().state;
    }

    this.bindStateListener();
    const state = await electronApi.license.getState();
    this.getStore().updateState(state);
    return state;
  }

  dispose(): void {
    if (this.removeStateListener) {
      this.removeStateListener();
      this.removeStateListener = null;
    }
  }

  bindStateListener(): void {
    if (this.removeStateListener || !electronApi.license.isAvailable()) {
      return;
    }

    this.removeStateListener = electronApi.license.onStateChanged((state) => {
      this.getStore().updateState(state);
    });
  }

  async activate(licenseKey: string): Promise<LicenseState> {
    try {
      const state = await electronApi.license.activate(licenseKey);
      this.getStore().updateState(state);
      return state;
    } catch (error) {
      const message = getErrorMessage(error, 'License activation failed.');
      licenseLogger.error('activate failed', { message });
      throw error;
    }
  }

  async validate(force?: boolean): Promise<LicenseState> {
    try {
      const state = await electronApi.license.validate(force);
      this.getStore().updateState(state);
      return state;
    } catch (error) {
      const message = getErrorMessage(error, 'License validation failed.');
      licenseLogger.error('validate failed', { message });
      throw error;
    }
  }

  async refreshDevices(force?: boolean): Promise<LicenseState> {
    const state = await electronApi.license.refreshDevices(force);
    this.getStore().updateState(state);
    return state;
  }

  async deactivateDevice(deviceId: string): Promise<LicenseState> {
    const state = await electronApi.license.deactivateDevice(deviceId);
    this.getStore().updateState(state);
    return state;
  }

  async clear(): Promise<LicenseState> {
    const state = await electronApi.license.clear();
    this.getStore().updateState(state);
    return state;
  }
}

export const licenseService = new LicenseService();
