import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { licenseService } from '../../services/license.service.js';

const licenseKeySchema = z.string().trim().min(1);
const deviceIdSchema = z.string().trim().min(1);
const forceFlagSchema = z.boolean().optional();

export function registerLicenseIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_GET_STATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_ACTIVATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_VALIDATE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_REFRESH_DEVICES);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_DEACTIVATE_DEVICE);
  ipcMain.removeHandler(IPC_CHANNELS.LICENSE_CLEAR);

  ipcMain.handle(IPC_CHANNELS.LICENSE_GET_STATE, () => {
    return licenseService.getState();
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, async (_event, rawLicenseKey: unknown) => {
    const licenseKey = licenseKeySchema.parse(rawLicenseKey);
    return await licenseService.activate(licenseKey);
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_VALIDATE, async (_event, rawForce: unknown) => {
    const force = forceFlagSchema.parse(rawForce);
    return await licenseService.validateLicense({ force });
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_REFRESH_DEVICES, async (_event, rawForce: unknown) => {
    const force = forceFlagSchema.parse(rawForce);
    return await licenseService.refreshDevices({ force });
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_DEACTIVATE_DEVICE, async (_event, rawDeviceId: unknown) => {
    const deviceId = deviceIdSchema.parse(rawDeviceId);
    return await licenseService.deactivateDevice(deviceId);
  });

  ipcMain.handle(IPC_CHANNELS.LICENSE_CLEAR, async () => {
    return await licenseService.clearLicense();
  });
}

