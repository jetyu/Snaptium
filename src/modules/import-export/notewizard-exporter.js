import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { verifyRecoveryKeyHash, decryptContent } from "../encryption/encryption-ipc.js";

/**
 * 笔记导出模块
 * 负责将笔记数据打包为 .nwp 格式
 */

/**
 * 创建导出管理器
 * @param {Object} dependencies - 依赖注入
 * @param {Object} dependencies.app - Electron app 实例
 * @param {Object} dependencies.dialog - Electron dialog 实例
 * @param {Function} dependencies.getPreference - 获取配置的函数
 * @param {Function} dependencies.t - 国际化翻译函数
 * @returns {Object} 导出管理器实例
 */
export function createExporter(dependencies) {
  const { app, dialog, getPreference, t, AdmZip, ipcMain, logger } = dependencies;

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
   * 统计笔记数量（只统计文件类型，不包括文件夹）
   * @param {string} nodesFilePath - nodes.jsonl 文件路径
   * @returns {Object} 笔记统计 { total, active, trashed }
   */
  function countNotes(nodesFilePath) {
    if (!fs.existsSync(nodesFilePath)) {
      return { total: 0, active: 0, trashed: 0 };
    }
    const content = fs.readFileSync(nodesFilePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);

    let activeCount = 0;
    let trashedCount = 0;

    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        if (node.type === 'file') {
          if (node.trashed) {
            trashedCount++;
          } else {
            activeCount++;
          }
        }
      } catch (error) {
        // 忽略解析错误的行
      }
    }

    return {
      total: activeCount + trashedCount,
      active: activeCount,
      trashed: trashedCount
    };
  }

  /**
   * 生成导出清单
   * @param {Object} noteStats - 笔记统计 { total, active, trashed }
   * @returns {Object} 清单对象
   */
  function generateManifest(noteStats) {
    return {
      version: '1.0',
      appVersion: app.getVersion(),
      exportDate: new Date().toISOString(),
      noteCount: noteStats.total,
      activeNotes: noteStats.active,
      trashedNotes: noteStats.trashed,
      description: t('export.notewizard.manifest.description')
    };
  }

  /**
   * 添加文件到 ZIP
   * @param {AdmZip} zip - ZIP 实例
   * @param {string} filePath - 文件路径
   * @param {string} zipPath - ZIP 内路径
   */
  function addFileToZip(zip, filePath, zipPath) {
    if (fs.existsSync(filePath)) {
      const fileName = path.basename(zipPath);
      const dirName = path.dirname(zipPath);
      zip.addLocalFile(filePath, dirName === '.' ? '' : dirName, fileName);
    }
  }

  /**
   * 添加目录到 ZIP
   * @param {AdmZip} zip - ZIP 实例
   * @param {string} dirPath - 目录路径
   * @param {string} zipPath - ZIP 内路径
   */
  function addFolderToZip(zip, dirPath, zipPath) {
    if (fs.existsSync(dirPath)) {
      zip.addLocalFolder(dirPath, zipPath);
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

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.startsWith('ENCRYPTED:')) {
          return true;
        }
      } catch (error) {
        // 忽略单个文件读取错误
        continue;
      }
    }

    return false;
  }

  /**
   * 显示输入恢复密钥对话框
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<string|null>} 恢复密钥或 null（用户取消）
   */
  async function promptRecoveryKey(win) {
    // 直接显示输入对话框
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
   * 验证恢复密钥（使用加密模块的公共函数）
   * @param {string} recoveryKey - 恢复密钥
   * @returns {Promise<boolean>} 是否有效
   */
  async function verifyRecoveryKey(recoveryKey) {
    try {
      const config = await getPreference('encryption');

      if (!config || !config.enabled) {
        return false;
      }

      // 使用公共函数验证
      return verifyRecoveryKeyHash(recoveryKey, config.recoveryKeyHash);
    } catch (error) {
      logger?.error('Failed to verify recovery key:', error);
      return false;
    }
  }

  /**
   * 解密目录中的所有加密文件到临时目录（使用加密模块的公共函数）
   * @param {string} sourceDir - 源目录
   * @param {string} tempDir - 临时目录
   * @param {string} recoveryKey - 恢复密钥
   * @returns {Object} 解密结果
   */
  function decryptFilesToTemp(sourceDir, tempDir, recoveryKey) {
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
    let decrypted = 0;
    let copied = 0;
    let failed = 0;

    for (const file of files) {
      logger?.debug(`Decryption check / process for export: ${file}`);
      const sourceFile = path.join(sourceDir, file);
      const targetFile = path.join(tempDir, file);

      try {
        const content = fs.readFileSync(sourceFile, 'utf-8');

        // 检查是否为加密内容
        if (content.startsWith('ENCRYPTED:')) {
          // 使用公共函数解密
          const decryptedContent = decryptContent(content, recoveryKey);
          fs.writeFileSync(targetFile, decryptedContent, 'utf-8');
          decrypted++;
          logger?.info(`NoteWizard Exporter: Successfully decrypted file: ${targetFile}`);
        } else {
          // 非加密文件，直接复制
          fs.copyFileSync(sourceFile, targetFile);
          copied++;
          logger?.info(`NoteWizard Exporter: Successfully copied file: ${targetFile}`);
        }
      } catch (error) {
        logger?.error(`NoteWizard Exporter: Failed to process file ${file}:`, error);
        failed++;
      }
    }

    return { decrypted, copied, failed };
  }

  /**
   * 执行导出操作
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<Object>} 导出结果
   */
  async function exportNotes(win) {
    let tempDir = null;

    try {
      // 检查数据库目录
      const databaseDir = getDatabaseDir();
      if (!databaseDir) {
        return {
          success: false,
          error: t('export.notewizard.error.noWorkspace')
        };
      }

      if (!fs.existsSync(databaseDir)) {
        return {
          success: false,
          error: t('export.notewizard.error.databaseNotExist')
        };
      }

      // 检查是否有加密文件
      const objectsDir = path.join(databaseDir, 'objects');
      const trashDir = path.join(databaseDir, 'trash');
      const hasEncrypted = hasEncryptedFiles(objectsDir) || hasEncryptedFiles(trashDir);

      let recoveryKey = null;
      if (hasEncrypted) {
        // 提示用户输入恢复密钥
        recoveryKey = await promptRecoveryKey(win);

        if (!recoveryKey) {
          // 用户取消
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
            title: t('export.notewizard.error.title'),
            message: t('export.notewizard.encrypted.keyIncorrect')
          });
          return {
            success: false,
            error: t('export.notewizard.encrypted.keyIncorrect')
          };
        }
      }

      // 显示保存对话框
      // 生成时间戳格式：YYMMDD_HHmm
      const now = new Date();
      const year = String(now.getFullYear()).slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${hour}${minute}`;

      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: t('export.notewizard.dialog.title'),
        defaultPath: `NoteWizard_Package_${timestamp}.nwp`,
        filters: [
          {
            name: t('export.notewizard.dialog.filterName'),
            extensions: ['nwp']
          },
          {
            name: t('export.notewizard.dialog.allFiles'),
            extensions: ['*']
          }
        ]
      });

      if (canceled || !filePath) {
        return {
          success: false,
          cancelled: true
        };
      }

      // 如果有加密文件，创建临时目录并解密
      if (hasEncrypted && recoveryKey) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notewizard-export-'));

        // 处理 objects 目录
        const tempObjectsDir = path.join(tempDir, 'objects');
        fs.mkdirSync(tempObjectsDir, { recursive: true });
        const objectsDecryptResult = decryptFilesToTemp(objectsDir, tempObjectsDir, recoveryKey);

        // 处理 trash 目录
        const tempTrashDir = path.join(tempDir, 'trash');
        if (fs.existsSync(trashDir)) {
          fs.mkdirSync(tempTrashDir, { recursive: true });
          const trashDecryptResult = decryptFilesToTemp(trashDir, tempTrashDir, recoveryKey);

          logger?.info(`NoteWizard Exporter: Decryption result: Objects(${objectsDecryptResult.decrypted}) Trash(${trashDecryptResult.decrypted})`);

          if (objectsDecryptResult.failed > 0 || trashDecryptResult.failed > 0) {
            logger?.warn(`NoteWizard Exporter: Some files failed to decrypt: Objects(${objectsDecryptResult.failed}) Trash(${trashDecryptResult.failed})`);
          }
        } else {
          logger?.info(`NoteWizard Exporter: Decryption result: Objects(${objectsDecryptResult.decrypted})`);
          if (objectsDecryptResult.failed > 0) {
            logger?.warn(`NoteWizard Exporter: Some files failed to decrypt: Objects(${objectsDecryptResult.failed})`);
          }
        }
      }

      // 创建 ZIP 文件
      const zip = new AdmZip();

      // 统计笔记数量
      const nodesFilePath = path.join(databaseDir, 'nodes.jsonl');
      const noteStats = countNotes(nodesFilePath);

      // 生成并添加 manifest.json
      const manifest = generateManifest(noteStats);
      zip.addFile(
        'manifest.json',
        Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8')
      );

      // 添加核心文件
      addFileToZip(zip, nodesFilePath, 'nodes.jsonl');
      addFileToZip(zip, path.join(databaseDir, 'meta.json'), 'meta.json');

      // 添加目录（如果有临时目录，使用临时目录的 objects，否则使用原目录）
      if (tempDir) {
        addFolderToZip(zip, path.join(tempDir, 'objects'), 'objects');
        // 检查临时回收站是否存在
        const tempTrashPath = path.join(tempDir, 'trash');
        if (fs.existsSync(tempTrashPath)) {
          addFolderToZip(zip, tempTrashPath, 'trash');
        } else {
          addFolderToZip(zip, trashDir, 'trash');
        }
      } else {
        addFolderToZip(zip, path.join(databaseDir, 'objects'), 'objects');
        addFolderToZip(zip, trashDir, 'trash');
      }

      addFolderToZip(zip, path.join(databaseDir, 'images'), 'images');

      // 写入 ZIP 文件
      zip.writeZip(filePath);

      logger?.info(`Successfully exported  ${filePath} with ${noteStats.total} NoteWizard Package notes`);

      return {
        success: true,
        filePath: filePath,
        noteCount: noteStats.total,
        activeNotes: noteStats.active,
        trashedNotes: noteStats.trashed
      };
    } catch (error) {
      logger?.error('NoteWizard Exporter: Export failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      // 清理临时目录
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          logger?.info('NoteWizard Exporter: Temporary directory cleaned up');
        } catch (error) {
          logger?.error('NoteWizard Exporter: Failed to clean up temporary directory:', error);
        }
      }
    }
  }

  return {
    exportNotes
  };
}
