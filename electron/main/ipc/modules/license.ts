import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { licenseService } from '../../services/license.service.js';
import { getErrorCode, getErrorMessage } from '../../services/error.service.js';

const licenseKeySchema = z.string().trim().min(1);
const deviceIdSchema = z.string().trim().min(1);
const forceFlagSchema = z.boolean().optional();

function serializeLicenseError(error: unknown): {
  success: false;
  code: string;
  message: string;
} {
  return {
    success: false,
    code: getErrorCode(error) ?? 'unknown',
    message: getErrorMessage(error, 'License request failed.'),
  };
}

export function registerLicenseIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_GET_STATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_ACTIVATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_VALIDATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_REFRESH_DEVICES);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_DEACTIVATE_DEVICE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_CLEAR);

  ipcMain.handle(IPC_CHANNELS.LICENSE_GET_STATE, () => {
    return {
      success: true,
      data: licenseService.getState(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, async (_event, rawLicenseKey: unknown) => {
    try {
      const licenseKey = licenseKeySchema.parse(rawLicenseKey);
      return {
        success: true,
        data: await licenseService.activate(licenseKey),
      };
    } catch (error) {
      return serializeLicenseError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_VALIDATE, async (_event, rawForce: unknown) => {
    try {
      const force = forceFlagSchema.parse(rawForce);
      return {
        success: true,
        data: await licenseService.validateLicense({ force }),
      };
    } catch (error) {
      return serializeLicenseError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_REFRESH_DEVICES, async (_event, rawForce: unknown) => {
    try {
      const force = forceFlagSchema.parse(rawForce);
      return {
        success: true,
        data: await licenseService.refreshDevices({ force }),
      };
    } catch (error) {
      return serializeLicenseError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_DEACTIVATE_DEVICE, async (_event, rawDeviceId: unknown) => {
    try {
      const deviceId = deviceIdSchema.parse(rawDeviceId);
      return {
        success: true,
        data: await licenseService.deactivateDevice(deviceId),
      };
    } catch (error) {
      return serializeLicenseError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_CLEAR, async () => {
    try {
      return {
        success: true,
        data: await licenseService.clearLicense(),
      };
    } catch (error) {
      return serializeLicenseError(error);
    }
  });
}

