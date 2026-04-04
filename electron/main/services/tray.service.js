import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { $t } from '../utils/i18n.js';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { loggerService } from './logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const logger = loggerService.createLogger('Electron:Tray Service');

class TrayService {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
  }

  init(mainWindow) {
    this.mainWindow = mainWindow;

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
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
    logger.debug('Tray initialized');
  }

  getTrayIconPath() {
    const logoPath = path.resolve(__dirname, '../../assets/logo');

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

  updateContextMenu() {
    if (!this.tray || !this.mainWindow) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: $t('tray.open'),
        click: () => {
          if (!this.mainWindow.isVisible()) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: $t('tray.quit'),
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  updateLanguage() {
    this.updateContextMenu();
  }

  showUpdateNotification(version) {
    if (!this.tray) return;
    this.tray.displayBalloon({
      title: $t('updater.newVersionAvailable'),
      content: $t('updater.newVersionMessage', { version }),
      icon: nativeImage.createFromPath(this.getTrayIconPath())
    });

    logger.debug('Showing update notification');
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    logger.debug('Tray destroyed');
  }
}

export const trayService = new TrayService();
