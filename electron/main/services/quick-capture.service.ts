import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Quick Capture Service');

export class QuickCaptureService {
  private mainWindow: BrowserWindow | null = null;
  private rendererReady = false;
  private pendingRequest = false;
  private isListening = false;

  private readonly handleRendererReady = (event: IpcMainEvent): void => {
    const mainWindow = this.mainWindow;
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      logger.warn('Ignored quick capture readiness from an unknown renderer');
      return;
    }

    this.rendererReady = true;
    this.deliverPendingRequest();
  };

  initialize(mainWindow: BrowserWindow): void {
    if (!this.isListening) {
      ipcMain.on(IPC_CHANNELS.QUICK_CAPTURE_READY, this.handleRendererReady);
      this.isListening = true;
    }

    this.attachWindow(mainWindow);
  }

  attachWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.rendererReady = false;

    mainWindow.webContents.on('did-start-loading', () => {
      if (this.mainWindow === mainWindow) {
        this.rendererReady = false;
      }
    });

    mainWindow.once('closed', () => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null;
        this.rendererReady = false;
      }
    });
  }

  request(): void {
    this.pendingRequest = true;
    this.showAndFocusWindow();
    this.deliverPendingRequest();
  }

  showAndFocusWindow(): void {
    const mainWindow = this.mainWindow;
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  }

  destroy(): void {
    if (this.isListening) {
      ipcMain.removeListener(IPC_CHANNELS.QUICK_CAPTURE_READY, this.handleRendererReady);
      this.isListening = false;
    }
    this.mainWindow = null;
    this.rendererReady = false;
    this.pendingRequest = false;
  }

  private deliverPendingRequest(): void {
    const mainWindow = this.mainWindow;
    if (
      !this.pendingRequest
      || !this.rendererReady
      || !mainWindow
      || mainWindow.isDestroyed()
      || mainWindow.webContents.isDestroyed()
    ) {
      return;
    }

    this.pendingRequest = false;
    mainWindow.webContents.send(IPC_CHANNELS.QUICK_CAPTURE_REQUESTED);
  }
}

export const quickCaptureService = new QuickCaptureService();
