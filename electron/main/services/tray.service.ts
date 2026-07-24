import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';

import { $t } from '../utils/i18n.js';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Tray Service');

class TrayService {
  private tray: Tray | null;
  private mainWindow: BrowserWindow | null;
  private onQuickCapture: (() => void) | null;
  private lastUpdateNotificationVersion: string | null;

  constructor() {
    this.tray = null;
    this.mainWindow = null;
    this.onQuickCapture = null;
    this.lastUpdateNotificationVersion = null;
  }

  init(mainWindow: BrowserWindow, onQuickCapture: () => void): void {
    this.mainWindow = mainWindow;
    this.onQuickCapture = onQuickCapture;

    if (this.tray) {
      this.updateContextMenu();
      return;
    }

    const iconPath = this.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    if (process.platform === IPC_CHANNELS.PLATFORM_WIN32_KERNEL) {
      this.tray = new Tray(icon);
    } else if (process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL) {
      this.tray = new Tray(icon.resize({ width: 32, height: 32 }));
      this.tray.setPressedImage(icon.resize({ width: 32, height: 32 }));
    } else {
      this.tray = new Tray(icon);
    }

    this.tray.setToolTip($t('common.appName'));

    this.updateContextMenu();

    this.tray.on(IPC_CHANNELS.ELECTRON_CLICK, () => {
      const mainWindow = this.mainWindow;
      if (!mainWindow) {
        return;
      }

      this.showAndFocusMainWindow();
    });
    logger.debug('Tray initialized');
  }

  getTrayIconPath(): string {
    const logoPath = path.resolve(app.getAppPath(), 'electron/assets/logo');

    if (process.platform === IPC_CHANNELS.PLATFORM_WIN32_KERNEL) {
      const iconPath = path.join(logoPath, 'app-logo.ico');
      logger.debug(`Win32 Tray icon path: ${iconPath}`);
      return iconPath;
    } else {
      const iconPath = path.join(logoPath, 'app-logo-32.png');
      logger.debug(`Tray icon path: ${iconPath}`);
      return iconPath;
    }
  }

  updateContextMenu(): void {
    if (!this.tray || !this.mainWindow) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: $t('tray.quickCapture'),
        click: () => {
          this.onQuickCapture?.();
        }
      },
      {
        label: $t('tray.open'),
        click: () => {
          this.showAndFocusMainWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: $t('tray.quit'),
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  updateLanguage(): void {
    this.updateContextMenu();
  }

  private showAndFocusMainWindow(): void {
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

  showUpdateNotification(version: string): void {
    if (!this.tray) return;

    const normalizedVersion = version.trim();
    if (!normalizedVersion || normalizedVersion === this.lastUpdateNotificationVersion) {
      return;
    }
    this.mainWindow = null;
    this.onQuickCapture = null;

    this.lastUpdateNotificationVersion = normalizedVersion;
    this.tray.displayBalloon({
      title: $t('updater.newVersionAvailable'),
      content: $t('updater.newVersionMessage').replace('{version}', normalizedVersion),
      icon: nativeImage.createFromPath(this.getTrayIconPath())
    });

    logger.debug('Showing update notification');
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    this.lastUpdateNotificationVersion = null;
    logger.debug('Tray destroyed');
  }
}

export const trayService = new TrayService();
