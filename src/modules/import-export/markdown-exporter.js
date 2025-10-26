import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Markdown 格式导出模块
 * 导出为扁平化的 objects/ 和 images/ 文件夹
 */

/**
 * 创建 Markdown 导出器
 * @param {Object} dependencies - 依赖注入
 * @param {Object} dependencies.dialog - Electron dialog 实例
 * @param {Function} dependencies.getPreference - 获取配置的函数
 * @param {Function} dependencies.t - 国际化翻译函数
 * @returns {Object} Markdown 导出器实例
 */
export function createMarkdownExporter(dependencies) {
  const { dialog, getPreference, t } = dependencies;

  /**
   * 获取数据库目录路径
   * @returns {string|null} 数据库目录路径
   */
  function getDatabaseDir() {
    const workspaceRoot = getPreference('noteSavePath', null);
    if (!workspaceRoot) {
      return null;
    }
    return path.join(workspaceRoot, 'Database');
  }

  /**
   * 统计笔记数量（只统计正常笔记，不包括回收站）
   * @param {string} nodesFilePath - nodes.jsonl 文件路径
   * @returns {number} 笔记数量
   */
  function countActiveNotes(nodesFilePath) {
    if (!fs.existsSync(nodesFilePath)) {
      return 0;
    }
    const content = fs.readFileSync(nodesFilePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    
    let activeCount = 0;
    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        if (node.type === 'file' && !node.trashed) {
          activeCount++;
        }
      } catch (error) {
        // 忽略解析错误的行
      }
    }
    
    return activeCount;
  }

  /**
   * 复制目录
   * @param {string} srcDir - 源目录
   * @param {string} destDir - 目标目录
   */
  function copyDirectory(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) {
      return;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 执行 Markdown 导出操作
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<Object>} 导出结果
   */
  async function exportMarkdown(win) {
    try {
      // 检查数据库目录
      const databaseDir = getDatabaseDir();
      if (!databaseDir) {
        return { 
          success: false, 
          error: t('export.markdown.error.noWorkspace')
        };
      }

      if (!fs.existsSync(databaseDir)) {
        return { 
          success: false, 
          error: t('export.markdown.error.databaseNotExist')
        };
      }

      // 显示选择文件夹对话框
      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: t('export.markdown.dialog.title'),
        properties: ['openDirectory', 'createDirectory']
      });

      if (canceled || filePaths.length === 0) {
        return { 
          success: false, 
          cancelled: true
        };
      }

      const exportDir = filePaths[0];

      // 统计笔记数量
      const nodesFilePath = path.join(databaseDir, 'nodes.jsonl');
      const noteCount = countActiveNotes(nodesFilePath);

      // 复制 objects 目录
      const srcObjectsDir = path.join(databaseDir, 'objects');
      const destObjectsDir = path.join(exportDir, 'objects');
      copyDirectory(srcObjectsDir, destObjectsDir);

      // 复制 images 目录
      const srcImagesDir = path.join(databaseDir, 'images');
      const destImagesDir = path.join(exportDir, 'images');
      copyDirectory(srcImagesDir, destImagesDir);

      console.log(`[MarkdownExporter] Successfully exported ${noteCount} notes to ${exportDir}`);

      return {
        success: true,
        exportPath: exportDir,
        noteCount: noteCount
      };
    } catch (error) {
      console.error('[MarkdownExporter] Export failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  return {
    exportMarkdown
  };
}
