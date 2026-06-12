import { getErrorCode, getErrorMessage } from '@shared/utils/error.utils';
import { createLogger } from '@renderer/features/logger';
import { electronApi, type LicenseBridgeResult } from '@renderer/core/bridge/electronApi';
import { i18n } from '@renderer/features/i18n';
import { LICENSE_ERROR_CODES, type LicenseState } from '@shared/license.constants';
import { useLicenseStore } from '../store/license.store';

const licenseLogger = createLogger('Renderer:LicenseService');

type LicenseStore = ReturnType<typeof useLicenseStore>;

export interface LicenseErrorInfo {
  code: string;
  message: string;
}

function createLicenseBridgeError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

function assertLicenseBridgeSuccess(result: LicenseBridgeResult<LicenseState>, fallbackMessage: string): asserts result is { success: true; data: LicenseState } {
  if (!result.success) {
    throw createLicenseBridgeError(result.code, result.message);
  }

  if (!result.data) {
    throw createLicenseBridgeError(LICENSE_ERROR_CODES.UNKNOWN, fallbackMessage);
  }
}

function inferLicenseErrorCode(message: string): string | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes('license key is invalid')
    || normalized.includes('license is not valid')
    || normalized.includes('license_invalid')
    || normalized.includes('invalid license')
  ) {
    return LICENSE_ERROR_CODES.LICENSE_INVALID;
  }

  if (normalized.includes('license expired') || normalized.includes('license_expired')) {
    return LICENSE_ERROR_CODES.LICENSE_EXPIRED;
  }

  if (normalized.includes('license inactive') || normalized.includes('license_inactive')) {
    return LICENSE_ERROR_CODES.LICENSE_INACTIVE;
  }

  if (normalized.includes('max devices') || normalized.includes('max_devices_reached')) {
    return LICENSE_ERROR_CODES.MAX_DEVICES_REACHED;
  }

  if (normalized.includes('device not found') || normalized.includes('device_not_found')) {
    return LICENSE_ERROR_CODES.DEVICE_NOT_FOUND;
  }

  if (normalized.includes('cannot deactivate current device') || normalized.includes('cannot_deactivate_current_device')) {
    return LICENSE_ERROR_CODES.CANNOT_DEACTIVATE_CURRENT_DEVICE;
  }

  if (normalized.includes('too many requests') || normalized.includes('too_many_requests')) {
    return LICENSE_ERROR_CODES.TOO_MANY_REQUESTS;
  }

  if (normalized.includes('timed out') || normalized.includes('network_timeout')) {
    return LICENSE_ERROR_CODES.NETWORK_TIMEOUT;
  }

  if (normalized.includes('fetch') || normalized.includes('network error') || normalized.includes('network_error')) {
    return LICENSE_ERROR_CODES.NETWORK_ERROR;
  }

  return null;
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
  const message = getErrorMessage(error, '');
  const code = getErrorCode(error) ?? inferLicenseErrorCode(message) ?? LICENSE_ERROR_CODES.UNKNOWN;

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

  const resolvedCode = code ?? inferLicenseErrorCode(message ?? '');
  if (resolvedCode) {
    return resolveLicenseErrorMessage(resolvedCode);
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
    const result = await electronApi.license.getState();
    assertLicenseBridgeSuccess(result, 'Failed to get license state.');
    this.getStore().updateState(result.data);
    return result.data;
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
      const result = await electronApi.license.activate(licenseKey);
      assertLicenseBridgeSuccess(result, 'License activation failed.');
      this.getStore().updateState(result.data);
      return result.data;
    } catch (error) {
      const message = getErrorMessage(error, 'License activation failed.');
      licenseLogger.error('activate failed', { message });
      throw error;
    }
  }

  async validate(force?: boolean): Promise<LicenseState> {
    try {
      const result = await electronApi.license.validate(force);
      assertLicenseBridgeSuccess(result, 'License validation failed.');
      this.getStore().updateState(result.data);
      return result.data;
    } catch (error) {
      const message = getErrorMessage(error, 'License validation failed.');
      licenseLogger.error('validate failed', { message });
      throw error;
    }
  }

  async refreshDevices(force?: boolean): Promise<LicenseState> {
    const result = await electronApi.license.refreshDevices(force);
    assertLicenseBridgeSuccess(result, 'Refresh devices failed.');
    this.getStore().updateState(result.data);
    return result.data;
  }

  async deactivateDevice(deviceId: string): Promise<LicenseState> {
    const result = await electronApi.license.deactivateDevice(deviceId);
    assertLicenseBridgeSuccess(result, 'Deactivate device failed.');
    this.getStore().updateState(result.data);
    return result.data;
  }

  async clear(): Promise<LicenseState> {
    const result = await electronApi.license.clear();
    assertLicenseBridgeSuccess(result, 'Clear license failed.');
    this.getStore().updateState(result.data);
    return result.data;
  }
}

export const licenseService = new LicenseService();
