/**
 * 应用菜单管理模块
 * 负责创建和管理应用程序菜单
 */

/**
 * 创建菜单管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.Menu - Electron Menu 类
 * @param {Object} deps.BrowserWindow - Electron BrowserWindow 类
 * @param {Object} deps.dialog - Electron dialog 模块
 * @param {Object} deps.shell - Electron shell 模块
 * @param {Object} deps.fs - 文件系统模块
 * @param {Object} deps.path - 路径模块
 * @param {Function} deps.t - 国际化翻译函数
 * @param {Function} deps.getWindow - 获取主窗口函数
 * @param {Function} deps.closeAllWindows - 关闭所有窗口函数
 * @param {Object} deps.importExportManager - 导入导出管理器
 * @param {Function} deps.handleManualUpdateCheck - 手动检查更新函数
 * @param {string} deps.__dirname - 应用根目录
 * @returns {Object} 菜单管理器实例
 */
export function createMenuManager(deps) {
  const {
    Menu, BrowserWindow, dialog, shell, fs, path, app,
    t, getWindow, closeAllWindows,
    importExportManager, handleManualUpdateCheck,
    __dirname
  } = deps;

  /**
   * 构建文件菜单
   * @returns {Object} 文件菜单配置
   */
  function buildFileMenu() {
    return {
      label: t("menu.file"),
      submenu: [
        {
          label: t("menu.file.open"),
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const win = getWindow();
            if (!win) return;

            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              filters: [{ name: "Markdown", extensions: ["md"] }],
              properties: ["openFile"],
            });

            if (!canceled && filePaths.length > 0) {
              const content = fs.readFileSync(filePaths[0], "utf-8");
              win.webContents.send("file-opened", {
                content,
                filePath: filePaths[0],
              });
            }
          },
        },
        {
          label: t("menu.file.save"),
          accelerator: "CmdOrCtrl+S",
          click: () => {
            const win = getWindow();
            if (win) {
              win.webContents.send("save-file");
            }
          },
        },
        { type: "separator" },
        {
          label: t("menu.file.exportNotes"),
          submenu: [
            {
              label: t("menu.file.exportNotes.package"),
              click: async () => {
                const win = getWindow();
                if (!win || !importExportManager) return;

                const result = await importExportManager.exportNotes();
                if (result.success) {
                  let message = t("export.notewizard.success.message").replace('{count}', result.noteCount);
                  if (result.activeNotes > 0 || result.trashedNotes > 0) {
                    message += '\n' + t("export.notewizard.success.breakdown")
                      .replace('{active}', result.activeNotes)
                      .replace('{trashed}', result.trashedNotes);
                  }
                  dialog.showMessageBox(win, {
                    type: 'info',
                    title: t("export.notewizard.success.title"),
                    message: message,
                    detail: t("export.notewizard.success.path").replace('{path}', result.filePath)
                  });
                } else if (!result.cancelled) {
                  dialog.showMessageBox(win, {
                    type: 'error',
                    title: t("export.notewizard.error.title"),
                    message: result.error
                  });
                }
              },
            },
            {
              label: t("menu.file.exportNotes.markdown"),
              click: async () => {
                const win = getWindow();
                if (!win || !importExportManager) return;

                const result = await importExportManager.exportMarkdown();
                if (result.success) {
                  dialog.showMessageBox(win, {
                    type: 'info',
                    title: t("export.markdown.success.title"),
                    message: t("export.markdown.success.message").replace('{count}', result.noteCount),
                    detail: t("export.markdown.success.path").replace('{path}', result.exportPath)
                  });
                } else if (!result.cancelled) {
                  dialog.showMessageBox(win, {
                    type: 'error',
                    title: t("export.markdown.error.title"),
                    message: result.error
                  });
                }
              },
            },
          ],
        },
        {
          label: t("menu.file.importNotes"),
          submenu: [
            {
              label: t("menu.file.importNotes.package"),
              click: async () => {
                const win = getWindow();
                if (!win || !importExportManager) return;

                const result = await importExportManager.importNotes();
                if (result.success) {
                  let message = t("import.notewizard.success.message").replace('{count}', result.noteCount);
                  if (result.activeNotes > 0 || result.trashedNotes > 0) {
                    message += '\n' + t("import.notewizard.success.breakdown")
                      .replace('{active}', result.activeNotes)
                      .replace('{trashed}', result.trashedNotes);
                  }
                  if (result.conflictCount > 0) {
                    message += '\n' + t("import.notewizard.success.conflicts").replace('{count}', result.conflictCount);
                  }
                  if (result.skippedCount > 0) {
                    message += '\n' + t("import.notewizard.success.skipped").replace('{count}', result.skippedCount);
                  }
                  dialog.showMessageBox(win, {
                    type: 'info',
                    title: t("import.notewizard.success.title"),
                    message: message
                  });
                  win.webContents.send("refresh-workspace");
                } else if (!result.cancelled) {
                  dialog.showMessageBox(win, {
                    type: 'error',
                    title: t("import.notewizard.error.title"),
                    message: result.error
                  });
                }
              },
            },
            {
              label: t("menu.file.importNotes.markdown"),
              click: async () => {
                const win = getWindow();
                if (!win || !importExportManager) return;

                const result = await importExportManager.importMarkdown();
                if (result.success) {
                  dialog.showMessageBox(win, {
                    type: 'info',
                    title: t("import.markdown.success.title"),
                    message: t("import.markdown.success.message").replace('{count}', result.noteCount)
                  });
                  win.webContents.send("refresh-workspace");
                } else if (!result.cancelled) {
                  dialog.showMessageBox(win, {
                    type: 'error',
                    title: t("import.markdown.error.title"),
                    message: result.error
                  });
                }
              },
            },
          ],
        },
        { type: "separator" },
        {
          label: t("menu.file.preferences"),
          accelerator: "Ctrl+Shift+P",
          click: () => {
            const win = getWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send("open-preferences");
            }
          },
        },
        {
          label: t("menu.file.quit"),
          click: () => {
            if (closeAllWindows) {
              closeAllWindows();
            } else {
              const windows = BrowserWindow.getAllWindows();
              windows.forEach((win) => {
                win.removeAllListeners("close");
                win.close();
              });
            }
            app.exit(0);
          },
        },
      ],
    };
  }

  /**
   * 构建视图菜单
   * @returns {Object} 视图菜单配置
   */
  function buildViewMenu() {
    return {
      label: t("menu.view"),
      submenu: [
        {
          label: t("menu.view.previewPanel"),
          submenu: [
            {
              id: "preview-open",
              label: t("menu.view.previewPanel.open"),
              accelerator: "Ctrl+Alt+P",
              click: () => {
                const win = getWindow();
                if (win && !win.isDestroyed()) {
                  win.webContents.send("preview-show");
                }
              },
            },
            {
              id: "preview-close",
              label: t("menu.view.previewPanel.close"),
              accelerator: "Ctrl+Alt+Shift+P",
              click: () => {
                const win = getWindow();
                if (win && !win.isDestroyed()) {
                  win.webContents.send("preview-hide");
                }
              },
            },
            {
              id: "preview-toggle",
              label: t("menu.view.previewPanel.toggle"),
              accelerator: "Ctrl+Alt+\\",
              click: () => {
                const win = getWindow();
                if (win && !win.isDestroyed()) {
                  win.webContents.send("preview-toggle");
                }
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * 构建编辑菜单
   * @returns {Object} 编辑菜单配置
   */
  function buildEditMenu() {
    return {
      label: t("menu.edit"),
      submenu: [
        {
          label: t("menu.edit.trash"),
          accelerator: "Ctrl+Shift+T",
          click: () => {
            const win = getWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send("open-trash");
            }
          },
        },
        { type: "separator" },
        { role: "undo", label: t("menu.edit.undo") },
        { role: "redo", label: t("menu.edit.redo") },
        { type: "separator" },
        { role: "cut", label: t("menu.edit.cut") },
        { role: "copy", label: t("menu.edit.copy") },
        { role: "paste", label: t("menu.edit.paste") },
      ],
    };
  }

  /**
   * 构建帮助菜单
   * @param {string} iconPath - 应用图标路径
   * @returns {Object} 帮助菜单配置
   */
  function buildHelpMenu(iconPath) {
    return {
      label: t("menu.help"),
      submenu: [
        {
          label: t("menu.help.devTools"),
          click: () => {
            const win = getWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.toggleDevTools();
            }
          },
        },
        { type: "separator" },
        {
          label: t("menu.help.website"),
          click: () => {
            shell.openExternal("https://github.com/jetyu/NoteWizard");
          },
        },
        {
          label: t("menu.help.tutorial"),
          click: () => {
            shell.openExternal("https://github.com/jetyu/NoteWizard/wiki");
          },
        },
        {
          label: t("menu.help.privacyPolicy"),
          click: () => {
            shell.openExternal("https://github.com/jetyu/NoteWizard/wiki/07_Privacy-Policy");
          },
        },
        {
          label: t("menu.help.termsOfService"),
          click: () => {
            shell.openExternal("https://github.com/jetyu/NoteWizard/wiki/08_Terms-of-Service");
          },
        },
        {
          label: t("menu.help.feedback"),
          click: () => {
            shell.openExternal("https://github.com/jetyu/NoteWizard/issues/new/choose");
          },
        },
        { type: "separator" },
        {
          label: t("menu.help.update"),
          click: async () => {
            if (handleManualUpdateCheck) {
              await handleManualUpdateCheck();
            }
          },
        },
        {
          label: t("menu.help.changelog"),
          click: () => {
            const win = getWindow();
            if (win && !win.isDestroyed()) {
              const aboutWindow = new BrowserWindow({
                width: 500,
                height: 500,
                parent: win,
                modal: true,
                show: false,
                autoHideMenuBar: true,
                minimizable: false,
                maximizable: false,
                resizable: true,
                useContentSize: true,
                icon: iconPath,
                webPreferences: {
                  nodeIntegration: false,
                  contextIsolation: true,
                  sandbox: false,
                  preload: path.join(__dirname, 'preload.js'),
                  webSecurity: true,
                  allowRunningInsecureContent: false,
                  experimentalFeatures: false
                },
              });
              aboutWindow.setMenuBarVisibility(false);
              aboutWindow.loadFile(
                path.join(__dirname, "src", "renderer", "changelog", "changelog.html")
              );
              aboutWindow.once("ready-to-show", () => {
                aboutWindow.show();
                aboutWindow.focus();
              });
            }
          },
        },
        {
          label: t("menu.help.about"),
          click: () => {
            const win = getWindow();
            if (win && !win.isDestroyed()) {
              const aboutWindow = new BrowserWindow({
                width: 500,
                height: 500,
                parent: win,
                modal: true,
                show: false,
                autoHideMenuBar: true,
                minimizable: false,
                maximizable: false,
                resizable: true,
                useContentSize: true,
                icon: iconPath,
                webPreferences: {
                  nodeIntegration: false,
                  contextIsolation: true,
                  sandbox: false,
                  preload: path.join(__dirname, 'preload.js'),
                  webSecurity: true,
                  allowRunningInsecureContent: false,
                  experimentalFeatures: false
                },
              });
              aboutWindow.setMenuBarVisibility(false);
              aboutWindow.loadFile(
                path.join(__dirname, "src", "renderer", "about", "about.html")
              );
              aboutWindow.once("ready-to-show", () => {
                aboutWindow.show();
                aboutWindow.focus();
              });
            }
          },
        },
      ],
    };
  }

  /**
   * 构建完整的菜单模板
   * @param {string} iconPath - 应用图标路径
   * @returns {Array} 菜单模板数组
   */
  function buildMenuTemplate(iconPath) {
    return [
      buildFileMenu(),
      buildViewMenu(),
      buildEditMenu(),
      buildHelpMenu(iconPath)
    ];
  }

  /**
   * 设置菜单初始状态
   */
  function setupMenuState() {
    try {
      const currentMenu = Menu.getApplicationMenu();
      if (!currentMenu) return;

      const openItem = currentMenu.getMenuItemById("preview-open");
      const closeItem = currentMenu.getMenuItemById("preview-close");

      if (openItem && closeItem) {
        openItem.enabled = false;
        closeItem.enabled = true;
      }
    } catch (error) {
      console.error("[Menu] Failed to setup menu state:", error);
    }
  }

  /**
   * 创建应用程序菜单
   * @param {string} iconPath - 应用图标路径（可选）
   */
  function createApplicationMenu(iconPath) {
    // 如果没有提供图标路径，使用默认路径
    if (!iconPath) {
      const iconFileName = process.platform === "win32"
        ? "app-logo.ico"
        : "app-logo-512.png";
      iconPath = path.join(__dirname, "src", "assets", "logo", iconFileName);
    }

    const menuTemplate = buildMenuTemplate(iconPath);
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    setupMenuState();
  }

  return {
    createApplicationMenu,
    buildMenuTemplate
  };
}
