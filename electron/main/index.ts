import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMainWindow } from './windows/mainWindow.js';
import { registerIpcHandlers } from './ipc/index.js';
import { setupAppMenu } from './services/menu.service.js';
import { settingsService } from './services/settings.service.js';
import { loggerService } from './services/logger.service.js';
import { previewPolicyService } from './services/preview-policy.service.js';
import { trayService } from './services/tray.service.js';
import { updaterService } from './services/updater.service.js';
import { IPC_CHANNELS } from './constants/ipc.constants.js';
import { vfsService } from './services/vfs.service.js';
import { accessControlService } from './services/access-control.service.js';
import { errorService } from './services/error.service.js';
import { licenseService } from './services/license.service.js';
import { keyManagerService } from './services/key-manager.service.js';
import packageJson from '../../package.json' with { type: 'json' };

const WORKSPACE_RESOURCE_SCHEME = 'note-resource';
const FALLBACK_APP_DISPLAY_NAME = 'Snaptium';

const isDev = !app.isPackaged;
let isQuitting = false;

function getAppDisplayName(): string {
  const productName = (packageJson as { build?: { productName?: unknown } }).build?.productName;
  return typeof productName === 'string' && productName.trim().length > 0
    ? productName.trim()
    : FALLBACK_APP_DISPLAY_NAME;
}

app.setName(getAppDisplayName());

protocol.registerSchemesAsPrivileged([
  {
    scheme: WORKSPACE_RESOURCE_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(targetPath);
  const relativePath = path.relative(normalizedRoot, normalizedTarget);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function registerWorkspaceResourceProtocol() {
  protocol.handle(WORKSPACE_RESOURCE_SCHEME, async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const targetPath = requestUrl.searchParams.get('path');
      const workspaceRoot = vfsService.getCurrentRoot();

      if (!targetPath || !workspaceRoot) {
        return new Response('Not found', { status: 404 });
      }

      const resolvedPath = path.resolve(targetPath);
      if (!isPathInsideRoot(workspaceRoot, resolvedPath)) {
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(resolvedPath).toString());
    } catch {
      return new Response('Bad request', { status: 400 });
    }
  });
}

function registerPreviewSecurityPolicies(electronSession: Electron.Session): void {
  electronSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (details.resourceType !== 'image') {
      callback({});
      return;
    }

    callback({
      cancel: !previewPolicyService.isAllowedRemoteImageRequest(details.url, { isDev }),
    });
  });

  electronSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame') {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [previewPolicyService.buildContentSecurityPolicy({ isDev })],
    };

    callback({ responseHeaders });
  });
}

function broadcastLicenseState(): void {
  const state = licenseService.getState();
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.LICENSE_STATE_CHANGED, state);
    }
  }
}

errorService.registerGlobalErrorHandlers();

app.whenReady().then(async () => {
  registerWorkspaceResourceProtocol();
  const preferences = await settingsService.loadConfig();
  await accessControlService.initialize();
  if (!accessControlService.isLocked()) {
    await keyManagerService.restoreAutoUnlockSession();
  }
  licenseService.addStateChangeListener(() => {
    broadcastLicenseState();
  });
  void licenseService.initialize().catch((error) => {
    loggerService.error('MainBootstrap', 'License initialization failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
  registerPreviewSecurityPolicies(session.defaultSession);
  loggerService.updateConfig(preferences);
  const appRootPath = app.getAppPath();
  const mainWindow = createMainWindow({ isDev, appPath: appRootPath });
  registerIpcHandlers(mainWindow);
  setupAppMenu(mainWindow, preferences.language);
  mainWindow.webContents.once('did-finish-load', () => {
    broadcastLicenseState();
  });
  
  trayService.init(mainWindow);
  
  if (!isDev) {
    await updaterService.initialize(mainWindow);
  }

  mainWindow.on(IPC_CHANNELS.ELECTRON_CLOSE, (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  app.on(IPC_CHANNELS.ELECTRON_ACTIVATE, () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void settingsService.loadConfig().then((nextPreferences) => {
        const window = createMainWindow({ isDev, appPath: appRootPath });
        registerIpcHandlers(window);
        setupAppMenu(window, nextPreferences.language);
        trayService.init(window);
        window.webContents.once('did-finish-load', () => {
          broadcastLicenseState();
        });
      });
    }
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_SWITCH_LANGUAGE, (_event, locale) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      setupAppMenu(windows[0], locale);
      trayService.updateLanguage();
    }
  });
});

app.on(IPC_CHANNELS.ELECTRON_WIN_ALL_CLOSED, () => {
  if (process.platform !== IPC_CHANNELS.PLATFORM_DARWIN_KERNEL) {
    isQuitting = true;
    app.quit();
  }
});

app.on(IPC_CHANNELS.ELECTRON_BEFORE_QUIT, () => {
  isQuitting = true;
  trayService.destroy();
  updaterService.destroy();
  licenseService.destroy();
});
