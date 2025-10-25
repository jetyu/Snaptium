/**
 * 配置管理模块
 * 负责应用配置的读写和导入导出
 */

/**
 * 创建配置管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.app - Electron app 实例
 * @param {Object} deps.fs - 文件系统模块
 * @param {Object} deps.path - 路径模块
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @param {Object} deps.dialog - Electron dialog 模块
 * @returns {Object} 配置管理器实例
 */
export function createPreferencesManager(deps) {
  const { app, fs, path, ipcMain, dialog } = deps;

  /**
   * 获取配置文件路径
   * @returns {string} 配置文件完整路径
   */
  function getPreferencesPath() {
    return path.join(app.getPath("userData"), "preferences.json");
  }

  /**
   * 读取所有配置
   * @returns {Object} 配置对象
   */
  function loadPreferences() {
    try {
      const prefsPath = getPreferencesPath();
      if (fs.existsSync(prefsPath)) {
        const data = fs.readFileSync(prefsPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("[Preferences] Failed to load preferences:", error);
    }
    return {};
  }

  /**
   * 保存所有配置
   * @param {Object} prefs - 配置对象
   * @returns {boolean} 是否保存成功
   */
  function savePreferences(prefs) {
    try {
      const prefsPath = getPreferencesPath();
      fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), "utf8");
      return true;
    } catch (error) {
      console.error("[Preferences] Failed to save preferences:", error);
      return false;
    }
  }

  /**
   * 获取单个配置项
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   * @returns {*} 配置值
   */
  function getPreference(key, defaultValue = null) {
    const prefs = loadPreferences();
    return prefs[key] !== undefined ? prefs[key] : defaultValue;
  }

  /**
   * 设置单个配置项
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   * @returns {boolean} 是否设置成功
   */
  function setPreference(key, value) {
    const prefs = loadPreferences();
    prefs[key] = value;
    return savePreferences(prefs);
  }

  /**
   * 导出首选项到文件
   * @param {Object} preferences - 要导出的配置
   * @returns {Promise<Object>} 导出结果
   */
  async function exportPreferences(preferences) {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: "导出首选项",
        defaultPath: `NoteWizard_Pref_Export_${new Date()
          .toISOString()
          .split("T")[0]
          .replace(/-/g, "")}.json`,
        filters: [
          { name: "JSON 文件", extensions: ["json"] },
          { name: "所有文件", extensions: ["*"] },
        ],
      });

      if (filePath) {
        // 转换格式以匹配导入的预期结构
        const exportData = {
          language: preferences.language || "en-US",
          theme: preferences.themeMode || "system",
          editor: {
            fontSize: preferences.editorFontSize || "16",
            fontFamily: preferences.editorFontFamily || "'Arial', sans-serif",
          },
          preview: {
            fontSize: preferences.previewFontSize || "16",
            fontFamily: preferences.previewFontFamily || "'Arial', sans-serif",
          },
          aiSettings: {
            enabled: preferences.aiSettings?.enabled || false,
            model: preferences.aiSettings?.model || "",
            apiKey: preferences.aiSettings?.apiKey || "",
            endpoint: preferences.aiSettings?.endpoint || "",
            systemPrompt: preferences.aiSettings?.systemPrompt || "",
            typingDelay: preferences.aiSettings?.typingDelay || 2000,
            minInputLength: preferences.aiSettings?.minInputLength || 10,
          },
          noteSavePath: preferences.noteSavePath || "",
          startupOnLogin: !!preferences.startupOnLogin,
        };

        const data = {
          version: "1.0",
          exportDate: new Date().toISOString(),
          settings: exportData,
        };

        await fs.promises.writeFile(
          filePath,
          JSON.stringify(data, null, 2),
          "utf8"
        );
        return { success: true, filePath };
      }
      return { success: false, error: "用户取消导出" };
    } catch (error) {
      return { success: false, error: `导出失败: ${error.message}` };
    }
  }

  /**
   * 从文件导入首选项
   * @returns {Promise<Object>} 导入结果
   */
  async function importPreferences() {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: "导入首选项",
        filters: [
          { name: "JSON 文件", extensions: ["json"] },
          { name: "所有文件", extensions: ["*"] },
        ],
        properties: ["openFile"],
      });

      if (canceled || filePaths.length === 0) {
        return { success: false, error: "用户取消导入" };
      }

      const filePath = filePaths[0];
      const data = await fs.promises.readFile(filePath, "utf8");
      const preferences = JSON.parse(data);

      // 验证导入的数据结构
      if (!preferences.settings) {
        throw new Error("无效的首选项文件格式");
      }

      // 创建备份
      const backupPath = path.join(
        app.getPath("userData"),
        "preferences_backup.json"
      );
      const currentSettings = {};

      // 备份当前设置
      try {
        const settingsPath = path.join(
          app.getPath("userData"),
          "preferences.json"
        );
        if (fs.existsSync(settingsPath)) {
          const currentData = await fs.promises.readFile(settingsPath, "utf8");
          currentSettings.settings = JSON.parse(currentData);
          currentSettings.backupDate = new Date().toISOString();
          await fs.promises.writeFile(
            backupPath,
            JSON.stringify(currentSettings, null, 2),
            "utf8"
          );
        }

        // 保存新设置
        await fs.promises.writeFile(
          path.join(app.getPath("userData"), "preferences.json"),
          JSON.stringify(preferences.settings, null, 2),
          "utf8"
        );

        return {
          success: true,
          preferences: preferences.settings,
          backupCreated: true,
          backupPath: backupPath,
        };
      } catch (error) {
        // 如果导入失败，尝试恢复备份
        if (Object.keys(currentSettings).length > 0) {
          try {
            await fs.promises.writeFile(
              path.join(app.getPath("userData"), "preferences.json"),
              JSON.stringify(currentSettings.settings, null, 2),
              "utf8"
            );
          } catch (restoreError) {
            console.error("[Preferences] Failed to restore backup:", restoreError);
          }
        }
        throw error;
      }
    } catch (error) {
      return { success: false, error: `导入失败: ${error.message}` };
    }
  }

  /**
   * 注册 IPC 处理器
   */
  function registerIpcHandlers() {
    // 获取所有配置
    ipcMain.handle("preferences:getAll", () => {
      return loadPreferences();
    });

    // 获取单个配置
    ipcMain.handle("preferences:get", (event, key, defaultValue) => {
      return getPreference(key, defaultValue);
    });

    // 设置单个配置
    ipcMain.handle("preferences:set", (event, key, value) => {
      return setPreference(key, value);
    });

    // 保存所有配置
    ipcMain.handle("preferences:saveAll", (event, prefs) => {
      return savePreferences(prefs);
    });

    // 导出首选项
    ipcMain.handle("export-preferences", async (event, preferences) => {
      return await exportPreferences(preferences);
    });

    // 导入首选项
    ipcMain.handle("import-preferences", async () => {
      return await importPreferences();
    });
  }

  // 自动注册 IPC 处理器
  if (ipcMain) {
    registerIpcHandlers();
  }

  return {
    getPreferencesPath,
    loadPreferences,
    savePreferences,
    getPreference,
    setPreference,
    exportPreferences,
    importPreferences
  };
}
