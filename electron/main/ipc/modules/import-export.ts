import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { importExportService } from '../../services/import-export/import-export.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:ImportExport IPC');

export function registerImportExportIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.DATA_EXPORT_SPPX);
  ipcMain.removeHandler(IPC_CHANNELS.DATA_IMPORT_SPPX);
  ipcMain.removeHandler(IPC_CHANNELS.DATA_EXPORT_MARKDOWN);
  ipcMain.removeHandler(IPC_CHANNELS.DATA_IMPORT_MARKDOWN);
  ipcMain.removeHandler(IPC_CHANNELS.DATA_IMPORT_ENEX);
  ipcMain.removeHandler(IPC_CHANNELS.DATA_IMPORT_NWP);

  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_SPPX, async () => {
    return await importExportService.exportSppxPackage();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_SPPX, async () => {
    return await importExportService.importSppxPackage();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_MARKDOWN, async () => {
    return await importExportService.exportMarkdownBatch();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_MARKDOWN, async () => {
    return await importExportService.importMarkdownBatch();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_ENEX, async () => {
    return await importExportService.importEnex();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_NWP, async () => {
    return await importExportService.importNwpPackage();
  });

  logger.debug('Import/export IPC handlers registered');
}
