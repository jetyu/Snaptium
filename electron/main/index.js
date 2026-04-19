import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMainWindow } from './windows/mainWindow.js';
import { registerIpcHandlers } from './ipc/index.js';
import { setupAppMenu } from './menu.js';
import { settingsService } from './services/settings.service.js';
import { loggerService } from './services/logger.service.js';
import { previewPolicyService } from './services/preview-policy.service.js';
import { trayService } from './services/tray.service.js';
import { updaterService } from './services/updater.service.js';
import { IPC_CHANNELS } from './constants/ipc.constants.js';
import { vfsService } from './services/vfs.service.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_RESOURCE_SCHEME = 'note-resource';

const isDev = !app.isPackaged;

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

function isPathInsideRoot(rootPath, targetPath) {
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

function registerPreviewSecurityPolicies(session) {
  session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (details.resourceType !== 'image') {
      callback({});
      return;
    }

    callback({
      cancel: !previewPolicyService.isAllowedRemoteImageRequest(details.url, { isDev }),
    });
  });

  session.webRequest.onHeadersReceived((details, callback) => {
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

app.whenReady().then(async () => {
  registerWorkspaceResourceProtocol();
  const preferences = await settingsService.loadConfig();
  registerPreviewSecurityPolicies(session.defaultSession);
  loggerService.updateConfig(preferences);
  const mainWindow = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
  registerIpcHandlers(mainWindow);
  setupAppMenu(mainWindow, preferences.language);
  
  trayService.init(mainWindow);
  
  if (!isDev) {
    await updaterService.initialize(mainWindow);
  }

  mainWindow.on(IPC_CHANNELS.ELECTRON_CLOSE, (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  app.on(IPC_CHANNELS.ELECTRON_ACTIVATE, () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void settingsService.loadConfig().then((nextPreferences) => {
        const window = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
        registerIpcHandlers(window);
        setupAppMenu(window, nextPreferences.language);
        trayService.init(window);
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
    app.isQuitting = true;
    app.quit();
  }
});

app.on(IPC_CHANNELS.ELECTRON_BEFORE_QUIT, () => {
  app.isQuitting = true;
  trayService.destroy();
  updaterService.destroy();
});
