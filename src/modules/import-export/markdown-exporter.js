import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { verifyRecoveryKeyHash, decryptContent } from "../encryption/encryption-ipc.js";

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
 * @param {Object} dependencies.ipcMain - IPC 主进程模块
 * @returns {Object} Markdown 导出器实例
 */
export function createMarkdownExporter(dependencies) {
  const { dialog, getPreference, t, ipcMain } = dependencies;

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
   * 检测目录中是否有加密文件
   * @param {string} dirPath - 目录路径
   * @returns {boolean} 是否有加密文件
   */
  function hasEncryptedFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (hasEncryptedFiles(fullPath)) {
            return true;
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.startsWith('ENCRYPTED:')) {
              return true;
            }
          } catch (error) {
            // 忽略单个文件读取错误
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error scanning for encrypted files:', error);
    }

    return false;
  }

  /**
   * 显示输入恢复密钥对话框
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<string|null>} 恢复密钥或 null（用户取消）
   */
  async function promptRecoveryKey(win) {
    return new Promise((resolve) => {
      const handleResponse = (event, recoveryKey) => {
        ipcMain.removeListener('export:recovery-key-response', handleResponse);
        resolve(recoveryKey);
      };

      ipcMain.once('export:recovery-key-response', handleResponse);
      win.webContents.send('export:request-recovery-key', {
        title: t('export.notewizard.encrypted.inputTitle'),
        message: t('export.notewizard.encrypted.inputMessage')
      });
    });
  }

  /**
   * 验证恢复密钥
   * @param {string} recoveryKey - 恢复密钥
   * @returns {Promise<boolean>} 是否有效
   */
  async function verifyRecoveryKey(recoveryKey) {
    try {
      const config = await getPreference('encryption');

      if (!config || !config.enabled) {
        // 如未启用加密配置但文件被加密，理论上不应发生，但也需处理
        return false;
      }

      return verifyRecoveryKeyHash(recoveryKey, config.recoveryKeyHash);
    } catch (error) {
      console.error('Failed to verify recovery key:', error);
      return false;
    }
  }

  /**
   * 处理并复制笔记（支持解密）
   * @param {string} srcDir - 源目录
   * @param {string} destDir - 目标目录
   * @param {string|null} recoveryKey - 恢复密钥（如果有）
   */
  function processAndCopyNotes(srcDir, destDir, recoveryKey) {
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
        processAndCopyNotes(srcPath, destPath, recoveryKey);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.md') && recoveryKey) {
          // 尝试读取并解密
          try {
            const content = fs.readFileSync(srcPath, 'utf-8');
            if (content.startsWith('ENCRYPTED:')) {
              const decryptedContent = decryptContent(content, recoveryKey);
              fs.writeFileSync(destPath, decryptedContent, 'utf-8');
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          } catch (error) {
            console.error(`Failed to process note ${entry.name}:`, error);
            // 失败时复制原文件作为兜底，或跳过
            fs.copyFileSync(srcPath, destPath);
          }
        } else {
          // 普通复制
          fs.copyFileSync(srcPath, destPath);
        }
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

      // 检查加密情况
      const objectsDir = path.join(databaseDir, 'objects');
      const hasEncrypted = hasEncryptedFiles(objectsDir);
      let recoveryKey = null;

      if (hasEncrypted) {
        // 提示用户输入恢复密钥
        recoveryKey = await promptRecoveryKey(win);

        if (!recoveryKey) {
          return {
            success: false,
            cancelled: true
          };
        }

        // 验证恢复密钥
        const isValid = await verifyRecoveryKey(recoveryKey);
        if (!isValid) {
          await dialog.showMessageBox(win, {
            type: 'error',
            title: t('export.markdown.error.title'),
            message: t('export.notewizard.encrypted.keyIncorrect')
          });
          return {
            success: false,
            error: t('export.notewizard.encrypted.keyIncorrect')
          };
        }
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

      // 复制/解密 objects 目录
      const destObjectsDir = path.join(exportDir, 'objects');
      processAndCopyNotes(objectsDir, destObjectsDir, recoveryKey);

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
