import { getErrorMessage } from '@shared/utils/error.utils';
import { createLogger } from '@renderer/features/logger';
import { electronApi } from '@renderer/core/bridge/electronApi';
import type { LicenseState } from '@shared/license.constants';
import { useLicenseStore } from '../store/license.store';

const licenseLogger = createLogger('Renderer:LicenseService');

type LicenseStore = ReturnType<typeof useLicenseStore>;

class LicenseService {
  private removeStateListener: (() => void) | null = null;

  private getStore(): LicenseStore {
    return useLicenseStore();
  }

  async initialize(): Promise<LicenseState> {
    const store = this.getStore();
    if (!electronApi.license.isAvailable()) {
      store.setInitialized(true);
      return store.state;
    }

    this.bindStateListener();
    const state = await electronApi.license.getState();
    store.updateState(state);
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

  async validate(): Promise<LicenseState> {
    try {
      const state = await electronApi.license.validate();
      this.getStore().updateState(state);
      return state;
    } catch (error) {
      const message = getErrorMessage(error, 'License validation failed.');
      licenseLogger.error('validate failed', { message });
      throw error;
    }
  }

  async refreshDevices(): Promise<LicenseState> {
    const state = await electronApi.license.refreshDevices();
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
