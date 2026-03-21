import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Markdown 文件夹导入模块
 * 从 objects/ 和 images/ 文件夹导入笔记
 */

/**
 * 创建 Markdown 导入器
 * @param {Object} dependencies - 依赖注入
 * @param {Object} dependencies.dialog - Electron dialog 实例
 * @param {Function} dependencies.getPreference - 获取配置的函数
 * @param {Function} dependencies.t - 国际化翻译函数
 * @returns {Object} Markdown 导入器实例
 */
export function createMarkdownImporter(dependencies) {
  const { dialog, getPreference, t, logger } = dependencies;

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
   * 从 Markdown 内容中提取标题
   * @param {string} content - Markdown 内容
   * @returns {string|null} 提取的标题
   */
  function extractTitle(content) {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim();
      }
    }
    return null;
  }

  /**
   * 生成唯一的 ID
   * @returns {string} UUID
   */
  function randomId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
   * 读取现有的 contentId 集合
   * @param {string} databaseDir - 数据库目录
   * @returns {Set<string>} contentId 集合
   */
  function getExistingContentIds(databaseDir) {
    const contentIds = new Set();
    const nodesPath = path.join(databaseDir, 'nodes.jsonl');

    if (!fs.existsSync(nodesPath)) {
      return contentIds;
    }

    const content = fs.readFileSync(nodesPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        if (node.contentId) {
          contentIds.add(node.contentId);
        }
      } catch (error) {
        logger?.error('Markdown Importer: Failed to parse node:', error);
      }
    }

    return contentIds;
  }

  /**
   * 执行 Markdown 导入操作
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<Object>} 导入结果
   */
  async function importMarkdown(win) {
    try {
      // 检查数据库目录
      const databaseDir = getDatabaseDir();
      if (!databaseDir) {
        return {
          success: false,
          error: t('import.markdown.error.noWorkspace')
        };
      }

      if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
      }

      // 显示选择文件对话框（支持多选）
      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: t('import.markdown.dialog.title'),
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: t('import.notewizard.dialog.allFiles'), extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
      });

      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          cancelled: true
        };
      }

      // 获取现有的 contentId
      const existingContentIds = getExistingContentIds(databaseDir);

      let importedCount = 0;
      let skippedCount = 0;
      const nodesPath = path.join(databaseDir, 'nodes.jsonl');
      const destObjectsDir = path.join(databaseDir, 'objects');

      // 确保目标目录存在
      if (!fs.existsSync(destObjectsDir)) {
        fs.mkdirSync(destObjectsDir, { recursive: true });
      }

      for (const filePath of filePaths) {
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf-8');

        // 提取标题
        const fileName = path.basename(filePath, '.md');
        const title = extractTitle(content) || fileName;

        // 生成新的 contentId
        const contentId = randomId();

        // 复制文件到 objects 目录
        const destFileName = `${contentId}.md`;
        const destFilePath = path.join(destObjectsDir, destFileName);
        fs.writeFileSync(destFilePath, content, 'utf-8');

        // 创建节点
        const node = {
          id: randomId(),
          type: 'file',
          name: title,
          fileName: destFileName,
          parentId: null,
          order: Date.now() + importedCount,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          contentId: contentId,
          trashed: false,
        };

        fs.appendFileSync(nodesPath, JSON.stringify(node) + '\n', 'utf-8');
        importedCount++;

        logger?.info(`Successfully imported Markdown file: ${filePath}`);
      }

      logger?.info(`Successfully imported ${importedCount} Markdown files`);

      return {
        success: true,
        noteCount: importedCount,
        skippedCount: 0
      };
    } catch (error) {
      logger?.error('Markdown Importer: Import failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  return {
    importMarkdown
  };
}
