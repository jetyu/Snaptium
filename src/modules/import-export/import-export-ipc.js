import { createExporter } from './notewizard-exporter.js';
import { createImporter } from './notewizard-importer.js';
import { createMarkdownExporter } from './markdown-exporter.js';
import { createMarkdownImporter } from './markdown-importer.js';

/**
 * 创建导入导出管理器
 * @param {Object} dependencies - 依赖注入
 * @param {Object} dependencies.app - Electron app 实例
 * @param {Object} dependencies.dialog - Electron dialog 实例
 * @param {Object} dependencies.ipcMain - IPC 主进程模块
 * @param {Function} dependencies.getPreference - 获取配置的函数
 * @param {Function} dependencies.t - 国际化翻译函数
 * @param {Function} dependencies.getWindow - 获取主窗口的函数
 * @param {Object} dependencies.AdmZip - AdmZip 类
 * @returns {Object} 导入导出管理器实例
 */
export function createImportExportManager(dependencies) {
  const { ipcMain, logger } = dependencies;
  const noteWizardExporter = createExporter(dependencies);
  const noteWizardImporter = createImporter(dependencies);
  const markdownExporter = createMarkdownExporter(dependencies);
  const markdownImporter = createMarkdownImporter(dependencies);

  /**
   * 导出 NoteWizard 格式笔记
   * @returns {Promise<Object>} 导出结果
   */
  async function exportNotes() {
    const win = dependencies.getWindow();
    if (!win) {
      return { 
        success: false, 
        error: dependencies.t('error.noWindow')
      };
    }
    return await noteWizardExporter.exportNotes(win);
  }

  /**
   * 导入 NoteWizard 格式笔记
   * @returns {Promise<Object>} 导入结果
   */
  async function importNotes() {
    const win = dependencies.getWindow();
    if (!win) {
      return { 
        success: false, 
        error: dependencies.t('error.noWindow')
      };
    }
    return await noteWizardImporter.importNotes(win);
  }

  /**
   * 导出 Markdown 格式笔记
   * @returns {Promise<Object>} 导出结果
   */
  async function exportMarkdown() {
    const win = dependencies.getWindow();
    if (!win) {
      return { 
        success: false, 
        error: dependencies.t('error.noWindow')
      };
    }
    return await markdownExporter.exportMarkdown(win);
  }

  /**
   * 导入 Markdown 格式笔记
   * @returns {Promise<Object>} 导入结果
   */
  async function importMarkdown() {
    const win = dependencies.getWindow();
    if (!win) {
      return { 
        success: false, 
        error: dependencies.t('error.noWindow')
      };
    }
    return await markdownImporter.importMarkdown(win);
  }

  /**
   * 注册 IPC 处理器
   */
  function registerIpcHandlers() {
    // 导出笔记
    ipcMain.handle("notes:export", async () => {
      return await exportNotes();
    });

    // 导入笔记
    ipcMain.handle("notes:import", async () => {
      return await importNotes();
    });
  }

  // 自动注册 IPC 处理器
  if (ipcMain) {
    registerIpcHandlers();
  }

  return {
    exportNotes,
    importNotes,
    exportMarkdown,
    importMarkdown
  };
}
