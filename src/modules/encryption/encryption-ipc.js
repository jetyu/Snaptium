/**
 * 加密功能 IPC 通信模块（恢复密钥方案）
 * 负责渲染进程和主进程之间的加密相关通信
 */

import crypto from 'crypto';
import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * 辅助方法：使用临时文件进行安全的原子化写入
 * @param {string} filePath - 目标文件路径
 * @param {string} data - 要写入的数据
 * @param {Object|string} options - 写入选项
 */
function safeWriteFileSync(filePath, data, options = 'utf-8') {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, data, options);
  fs.renameSync(tempPath, filePath);
}

/**
 * 生成恢复密钥（12个单词）
 * @returns {string} 恢复密钥
 */
export function generateRecoveryKey() {
  // 生成24个随机字节（192位）
  const randomBytes = crypto.randomBytes(24);
  // 转换为base64并格式化为易读的格式
  const base64 = randomBytes.toString('base64');
  // 移除特殊字符并分组
  const cleaned = base64.replace(/[+/=]/g, '');
  // 每4个字符一组，用连字符分隔
  const groups = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    groups.push(cleaned.substring(i, i + 4));
  }
  return groups.join('-');
}

/**
 * 从恢复密钥派生加密密钥
 * @param {string} recoveryKey - 恢复密钥
 * @param {Buffer} salt - 盐值
 * @returns {Buffer} 派生的密钥
 */
export function deriveKeyFromRecovery(recoveryKey, salt) {
  return crypto.pbkdf2Sync(
    recoveryKey,
    salt,
    100000, // 迭代次数
    32, // 密钥长度（256位）
    'sha256'
  );
}

/**
 * 验证恢复密钥是否正确
 * @param {string} recoveryKey - 要验证的恢复密钥
 * @param {string} storedHash - 存储的密钥哈希值
 * @returns {boolean} 是否匹配
 */
export function verifyRecoveryKeyHash(recoveryKey, storedHash) {
  const inputHash = crypto.createHash('sha256').update(recoveryKey).digest('hex');
  return inputHash === storedHash;
}

/**
 * 解密单个加密内容
 * @param {string} encryptedContent - 加密的内容（格式：ENCRYPTED:v1:salt:iv:authTag:data）
 * @param {string} recoveryKey - 恢复密钥
 * @returns {string} 解密后的内容
 * @throws {Error} 如果解密失败
 */
export function decryptContent(encryptedContent, recoveryKey) {
  if (!encryptedContent.startsWith('ENCRYPTED:')) {
    // 非加密内容格式，返回
    return encryptedContent;
  }

  // 解析加密格式: ENCRYPTED:v1:salt:iv:authTag:data
  const parts = encryptedContent.split(':');
  if (parts.length < 6) {
    throw new Error('加密格式无效');
  }

  const [prefix, version, saltB64, ivB64, authTagB64, ...encryptedParts] = parts;
  const encryptedData = encryptedParts.join(':'); // 处理内容中可能包含冒号的情况

  if (prefix !== 'ENCRYPTED' || version !== 'v1') {
    throw new Error('不支持的加密版本');
  }

  // 解码 Base64
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  // 从恢复密钥派生加密密钥
  const key = deriveKeyFromRecovery(recoveryKey, salt);

  // AES-256-GCM 解密
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 创建加密管理器并注册 IPC 处理器
 * @param {Object} deps - 依赖项
 * @param {Object} deps.ipcMain - Electron ipcMain
 * @param {Object} deps.preferencesManager - 配置管理器
 * @param {Function} deps.getWindow - 获取主窗口的函数
 * @returns {Object} 加密管理器实例
 */
export function createEncryptionManager(deps) {
  const { ipcMain, preferencesManager, getWindow, app, logger } = deps;

  // 加密状态管理
  let encryptionEnabled = false;
  let currentRecoveryKey = null;
  let currentSalt = null;

  //获取当前数据库目录
  const getDatabaseDir = () => {
    const noteSavePath = preferencesManager.getPreference('noteSavePath');
    if (noteSavePath) {
      return path.join(noteSavePath, 'Database');
    }
    // 回退到默认文档路径
    return path.join(app.getPath('documents'), 'NoteWizard', 'Database');
  };

  /**
   * 检查当前数据库目录是否已经存在加密数据。
   * 优先读取 meta.json 的 encrypted 标记；若无标记，再扫描对象文件前缀。
   * @returns {boolean}
   */
  const hasEncryptedDataInDatabase = () => {
    try {
      const databaseDir = getDatabaseDir();

      const metaPath = path.join(databaseDir, 'meta.json');
      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        if (meta?.encrypted === true) {
          return true;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger?.error('Failed to parse meta.json while checking encryption state: ' + error.message);
        }
      }

      const dirsToScan = [
        path.join(databaseDir, 'objects'),
        path.join(databaseDir, 'trash')
      ];

      for (const dirPath of dirsToScan) {
        let files;
        try {
          files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
        } catch (error) {
          if (error.code === 'ENOENT') {
            continue;
          }
          throw error;
        }
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.startsWith('ENCRYPTED:')) {
              return true;
            }
          } catch (error) {
            // 单文件读取失败不影响整体判断
            continue;
          }
        }
      }
    } catch (error) {
      logger?.error('Failed to detect encrypted files from database: ' + error.message);
    }

    return false;
  };


  /**
   * 更新 meta.json
   * @param {string} databaseDir - 数据库目录
   * @param {(meta: Record<string, any>) => void} updater - 对 meta 的更新函数
   * @param {Object} options - 选项
   * @param {string} options.errorMessage - 错误日志前缀
   * @returns {boolean} 是否更新成功
   */
  const updateMetaJson = (databaseDir, updater, options = {}) => {
    const { errorMessage = 'Failed to update meta.json:' } = options;

    try {
      const metaPath = path.join(databaseDir, 'meta.json');

      let metaContent;
      try {
        metaContent = fs.readFileSync(metaPath, 'utf-8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }

      const meta = JSON.parse(metaContent);
      updater(meta);
      safeWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      return true;
    } catch (error) {
      logger?.error(errorMessage + ' ' + error.message);
      return false;
    }
  };

  // 应用启动时尝试自动解锁
  const initEncryption = async () => {
    try {
      const config = await preferencesManager.getPreference('encryption');
      if (config?.enabled && config?.encryptedRecoveryKey) {
        // 检查 safeStorage 是否可用
        if (safeStorage.isEncryptionAvailable()) {
          try {
            // 解密恢复密钥
            const encryptedBuffer = Buffer.from(config.encryptedRecoveryKey, 'base64');
            currentRecoveryKey = safeStorage.decryptString(encryptedBuffer);
            currentSalt = config.salt;
            encryptionEnabled = true;
            logger?.info('Decryption successfully');
          } catch (error) {
            logger?.error('Failed to Decryption: ' + error.message);
          }
        } else {
          logger?.warn('Electron SafeStorage is not available on this system');
        }
      } else {
        // 尝试从 meta.json 读取临时恢复密钥进行紧急恢复
        await tryRecoverFromMetaJson();
      }
    } catch (error) {
      logger?.error('Failed to initialize encryption: ' + error.message);
    }
  };

  /**
   * 读取临时恢复密钥进行紧急恢复
   */
  const tryRecoverFromMetaJson = async () => {
    try {
      const databaseDir = getDatabaseDir();
      const metaPath = path.join(databaseDir, 'meta.json');

      let metaContent;
      try {
        metaContent = fs.readFileSync(metaPath, 'utf-8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          return;
        }
        throw error;
      }
      const meta = JSON.parse(metaContent);

      // 检查是否有临时恢复密钥
      if (!meta.tempRecoveryKey) {
        return;
      }

      logger?.info('Detected TempRecoveryKey from meta.json, emergency recovery.');

      // 如果 meta.json 中保存了数据库路径，恢复 noteSavePath 配置
      if (meta.databasePath) {
        const savedPath = meta.databasePath;
        const currentNoteSavePath = preferencesManager.getPreference('noteSavePath');

        // 如果当前配置的路径与 meta.json 中的路径不一致，恢复配置
        if (!currentNoteSavePath || currentNoteSavePath !== savedPath) {
          await preferencesManager.setPreference('noteSavePath', savedPath);
          logger?.info(`Restored Note Storage Path from meta.json: ${savedPath}`);
        }
      }

      const recoveryKey = meta.tempRecoveryKey;

      // 验证密钥格式
      if (typeof recoveryKey !== 'string' || recoveryKey.length < 10) {
        logger?.info('Invalid recovery key format from meta.json');
        safeWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        return;
      }

      // 尝试使用密钥解密一个文件来验证
      const objectsDir = path.join(databaseDir, 'objects');
      let files = null;
      try {
        files = fs.readdirSync(objectsDir).filter(f => f.endsWith('.md'));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger?.error('Failed to read objects directory: ' + error.message);
          throw error;
        }
      }

      if (files !== null) {
        let verified = false;
        for (const file of files) {
          const filePath = path.join(objectsDir, file);
          let content;
          try {
            content = fs.readFileSync(filePath, 'utf-8');
          } catch (error) {
            if (error.code === 'ENOENT') continue;
            logger?.error('Failed to Loop read file: ' + error.message);
            throw error;
          }

          if (content.startsWith('ENCRYPTED:')) {
            // 尝试解密验证
            try {
              const parts = content.split(':');
              if (parts.length >= 6) {
                const [, , saltB64, ivB64, authTagB64, ...encryptedParts] = parts;
                const encryptedData = encryptedParts.join(':');

                const salt = Buffer.from(saltB64, 'base64');
                const iv = Buffer.from(ivB64, 'base64');
                const authTag = Buffer.from(authTagB64, 'base64');

                const key = deriveKeyFromRecovery(recoveryKey, salt);

                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(authTag);
                decipher.update(encryptedData, 'base64', 'utf8');
                decipher.final('utf8');

                verified = true;
                logger?.info('Recovery key verified successfully');
                break;
              }
            } catch (error) {
              safeWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
              return;
            }
          }
        }

        if (!verified && meta.encrypted) {
          // 数据库标记为加密但没有找到加密文件
          logger?.info('No encrypted files found to verify, proceeding with recovery');
          verified = true;
        }

        if (verified || !meta.encrypted) {
          // 密钥验证成功，保存到 safeStorage
          if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(recoveryKey);
            const encryptedRecoveryKey = encrypted.toString('base64');

            // 生成新的盐值
            const salt = crypto.randomBytes(32).toString('hex');

            // 保存加密配置
            await preferencesManager.setPreference('encryption', {
              enabled: true,
              salt: salt,
              recoveryKeyHash: crypto.createHash('sha256').update(recoveryKey).digest('hex'),
              encryptedRecoveryKey: encryptedRecoveryKey,
              setupTime: Date.now(),
              recoveredAt: Date.now() // 标记为恢复的配置
            });

            encryptionEnabled = true;
            currentRecoveryKey = recoveryKey;
            currentSalt = salt;

            logger?.info('Emergency recovery successful, encryption enabled');
          }

          // 清除 meta.json 中的临时密钥
          delete meta.tempRecoveryKey;
          safeWriteFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
          logger?.info('Recovery successful, TempRecoveryKey was removed from meta.json');
        }
      }
    } catch (error) {
      logger?.error('Emergency recovery failed: ' + error.message);
    }
  };

  // 应用启动时初始化
  app.whenReady().then(initEncryption);

  // 应用关闭时清除内存
  app.on('before-quit', () => {
    if (currentRecoveryKey) {
      currentRecoveryKey = null;
    }
    currentSalt = null;
    logger?.debug('Encryption memory cleared');
  });

  // ==================== 状态查询 ====================

  /**
   * 检查是否启用加密
   */
  ipcMain.handle('encryption:is-enabled', async () => {
    try {
      // 仅根据数据库真实加密状态判断，避免配置丢失/残留导致误判
      encryptionEnabled = hasEncryptedDataInDatabase();

      return { success: true, enabled: encryptionEnabled };
    } catch (error) {
      logger?.error('Failed to check encryption status: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 检查是否已解锁
   */
  ipcMain.handle('encryption:is-unlocked', async () => {
    try {
      return { success: true, unlocked: encryptionEnabled };
    } catch (error) {
      logger?.error('Failed to check unlock status: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  // ==================== 恢复密钥管理 ====================

  /**
   * 生成新的恢复密钥
   */
  ipcMain.handle('encryption:generate-recovery-key', async () => {
    logger?.debug('IPC received: encryption:generate-recovery-key');
    try {
      const recoveryKey = generateRecoveryKey();
      logger?.info('Generated new recovery key');

      return {
        success: true,
        recoveryKey
      };
    } catch (error) {
      logger?.error('Failed to generate recovery key: ' + error.message);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * 设置加密（使用恢复密钥）
   */
  ipcMain.handle('encryption:setup', async (event, { recoveryKey }) => {
    logger?.debug('IPC received: encryption:setup');
    try {
      logger?.info('Setup encryption with recovery key');

      // 验证恢复密钥
      if (!recoveryKey || recoveryKey.length < 20) {
        return {
          success: false,
          error: '无效的恢复密钥'
        };
      }

      // 生成盐值
      const salt = crypto.randomBytes(32).toString('hex');

      // 使用 safeStorage 加密恢复密钥
      let encryptedRecoveryKey = null;
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(recoveryKey);
        encryptedRecoveryKey = encrypted.toString('base64');
        logger?.info('safeStorage encrypted recovery key');
      }

      // 保存加密配置
      await preferencesManager.setPreference('encryption', {
        enabled: true,
        salt: salt,
        // 存储恢复密钥的哈希值用于验证
        recoveryKeyHash: crypto.createHash('sha256').update(recoveryKey).digest('hex'),
        // 使用系统密钥加密后的恢复密钥
        encryptedRecoveryKey: encryptedRecoveryKey,
        setupTime: Date.now()
      });

      // 将临时恢复密钥和数据库路径保存到 meta.json 用于紧急恢复
      const databaseDir = getDatabaseDir();
      const setupMetaUpdated = updateMetaJson(
        databaseDir,
        (meta) => {
          // 保存临时恢复密钥和数据库路径，并标记数据库为加密状态
          meta.databasePath = path.dirname(databaseDir); // 保存工作区根路径
          meta.encrypted = true;
        },
        { errorMessage: 'Failed to save tempRecoveryKey to meta.json:' }
      );
      if (setupMetaUpdated) {
        logger?.info('meta.json updated (encrypted = true)');
      }

      encryptionEnabled = true;
      currentRecoveryKey = recoveryKey;
      currentSalt = salt;

      // 通知渲染进程状态变化
      const win = getWindow();
      if (win) {
        win.webContents.send('encryption:status-changed', { enabled: true });
      }

      logger?.info('Encryption setup successful');
      return { success: true };
    } catch (error) {
      logger?.error('Failed to setup encryption: ' + error.message);
      return {
        success: false,
        error: '设置加密失败: ' + error.message
      };
    }
  });

  /**
   * 验证恢复密钥
   */
  ipcMain.handle('encryption:verify-key', async (event, { recoveryKey }) => {
    try {
      const config = await preferencesManager.getPreference('encryption');

      if (!config) {
        return {
          success: false,
          error: '读取配置文件失败，无法验证密钥！请使用 Temporary Emergency Recovery 方式进行验证！'
        };
      }

      // 验证恢复密钥
      if (!recoveryKey) {
        return {
          success: false,
          error: '请输入恢复密钥'
        };
      }

      // 对比哈希值
      const inputHash = crypto.createHash('sha256').update(recoveryKey).digest('hex');
      const storedHash = config.recoveryKeyHash;

      if (inputHash === storedHash) {
        return {
          success: true,
          valid: true
        };
      } else {
        return {
          success: true,
          valid: false,
          error: '恢复密钥不正确'
        };
      }
    } catch (error) {
      logger?.error('Failed to verify key: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 禁用加密
   */
  ipcMain.handle('encryption:disable', async () => {
    logger?.debug('IPC received: encryption:disable');
    try {
      // 清除加密配置
      await preferencesManager.setPreference('encryption', {
        enabled: false
      });

      // 同步更新 meta.json 的加密状态，保证状态判断来源一致
      const disableMetaUpdated = updateMetaJson(
        getDatabaseDir(),
        (meta) => {
          meta.encrypted = false;
        },
        { errorMessage: 'Failed to update meta.json while disabling encryption:' }
      );
      if (disableMetaUpdated) {
        logger?.info('meta.json updated (encrypted = false)');
      }

      encryptionEnabled = false;
      currentRecoveryKey = null;
      currentSalt = null;

      // 通知渲染进程状态变化
      const win = getWindow();
      if (win) {
        win.webContents.send('encryption:status-changed', { enabled: false });
      }

      logger?.info('Encryption disabled');
      return { success: true };
    } catch (error) {
      logger?.error('Failed to disable encryption: ' + error.message);
      return {
        success: false,
        error: '禁用加密失败: ' + error.message
      };
    }
  });

  // ==================== 检测加密文件 ====================

  /**
   * 检测指定目录中是否有加密文件
   */
  ipcMain.handle('encryption:check-encrypted-files', async (event, { dirPath }) => {
    try {
      let files;
      try {
        files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
      } catch (error) {
        if (error.code === 'ENOENT') {
          return { success: true, hasEncrypted: false };
        }
        logger?.error('Check encrypted files error: ' + error.message);
        throw error;
      }

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.startsWith('ENCRYPTED:')) {
            return { success: true, hasEncrypted: true };
          }
        } catch (error) {
          // 忽略单个文件读取错误
          logger?.error('Ignore single file read error: ' + error.message);
          continue;
        }
      }

      return { success: true, hasEncrypted: false };
    } catch (error) {
      logger?.error('Failed to check encrypted files: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 解密指定目录中的所有加密文件（用于导出）
   * @param {string} sourceDir - 源目录
   * @param {string} targetDir - 目标目录
   * @param {string} recoveryKey - 恢复密钥
   */
  ipcMain.handle('encryption:decrypt-for-export', async (event, { sourceDir, targetDir, recoveryKey }) => {
    try {
      // 验证恢复密钥
      const config = await preferencesManager.getPreference('encryption');
      if (config && config.enabled) {
        const inputHash = crypto.createHash('sha256').update(recoveryKey).digest('hex');
        const storedHash = config.recoveryKeyHash;

        if (inputHash !== storedHash) {
          logger?.info('Recovery key not mapping');
          return { success: false, error: '恢复密钥不正确' };
        }
      }

      // 创建目标目录
      fs.mkdirSync(targetDir, { recursive: true });

      let files;
      try {
        files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
      } catch (error) {
        if (error.code === 'ENOENT') {
          logger?.info('Source directory not found');
          return { success: false, error: '源目录不存在' };
        }
        throw error;
      }

      let decrypted = 0;
      let copied = 0;
      let failed = 0;

      for (const file of files) {
        const sourceFile = path.join(sourceDir, file);
        const targetFile = path.join(targetDir, file);

        try {
          let content = fs.readFileSync(sourceFile, 'utf-8');

          // 检查是否为加密内容
          if (content.startsWith('ENCRYPTED:')) {
            // 解密内容
            const parts = content.split(':');
            if (parts.length < 6) {
              logger?.error(`Invalid encrypted format (file=${file})`);
              failed++;
              continue;
            }

            const [prefix, version, saltB64, ivB64, authTagB64, ...encryptedParts] = parts;
            const encryptedData = encryptedParts.join(':');

            if (prefix !== 'ENCRYPTED' || version !== 'v1') {
              logger?.error(`Unsupported encryption version (file=${file})`);
              failed++;
              continue;
            }

            // 解码 Base64
            const salt = Buffer.from(saltB64, 'base64');
            const iv = Buffer.from(ivB64, 'base64');
            const authTag = Buffer.from(authTagB64, 'base64');

            // 从恢复密钥派生加密密钥
            const key = deriveKeyFromRecovery(recoveryKey, salt);

            // AES-256-GCM 解密
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            let decryptedContent = decipher.update(encryptedData, 'base64', 'utf8');
            decryptedContent += decipher.final('utf8');

            // 写入解密后的内容
            safeWriteFileSync(targetFile, decryptedContent, 'utf-8');
            decrypted++;
          } else {
            // 非加密文件，直接复制
            fs.copyFileSync(sourceFile, targetFile);
            copied++;
          }
        } catch (error) {
          logger?.error(`Failed to process file (file=${file})` + error.message);
          failed++;
        }
      }

      return {
        success: true,
        decrypted,
        copied,
        failed
      };
    } catch (error) {
      logger?.error('Failed to decrypt for export: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  // ==================== 批量操作 ====================

  /**
   * 批量加密所有笔记
   */
  ipcMain.handle('encryption:encrypt-all', async () => {
    try {
      if (!encryptionEnabled || !currentRecoveryKey) {
        throw new Error('加密功能未启用');
      }

      logger?.info('Batch encryption all notes start');

      // 获取笔记目录和回收站目录
      const databaseDir = getDatabaseDir();
      const notesDir = path.join(databaseDir, 'objects');
      const trashDir = path.join(databaseDir, 'trash');

      // 收集所有需要加密的文件
      const filesToEncrypt = [];

      // 收集 objects 目录中的文件
      try {
        const objectFiles = fs.readdirSync(notesDir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ file: f, dir: notesDir, dirName: 'objects' }));
        filesToEncrypt.push(...objectFiles);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      // 收集 trash 目录中的文件
      try {
        const trashFiles = fs.readdirSync(trashDir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ file: f, dir: trashDir, dirName: 'trash' }));
        filesToEncrypt.push(...trashFiles);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      if (filesToEncrypt.length === 0) {
        return { success: true, encrypted: 0, failed: 0, skipped: 0 };
      }

      const total = filesToEncrypt.length;
      let encrypted = 0;
      let failed = 0;
      let skipped = 0;

      const win = getWindow();

      for (let i = 0; i < filesToEncrypt.length; i++) {
        const { file, dir, dirName } = filesToEncrypt[i];
        logger?.debug(`Encrypting file: ${file} in ${dirName}`);
        const filePath = path.join(dir, file);

        try {
          // 读取文件内容
          let content = fs.readFileSync(filePath, 'utf-8');

          // 检查是否已加密
          if (content.startsWith('ENCRYPTED:')) {
            skipped++;
            continue;
          }

          // 加密内容
          const salt = crypto.randomBytes(32);
          const iv = crypto.randomBytes(16);
          const key = deriveKeyFromRecovery(currentRecoveryKey, salt);

          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          let encryptedContent = cipher.update(content, 'utf8', 'base64');
          encryptedContent += cipher.final('base64');
          const authTag = cipher.getAuthTag();

          const result = [
            'ENCRYPTED',
            'v1',
            salt.toString('base64'),
            iv.toString('base64'),
            authTag.toString('base64'),
            encryptedContent
          ].join(':');

          // 写回文件
          safeWriteFileSync(filePath, result, 'utf-8');
          encrypted++;

          logger?.info(`Encrypted file in ${dirName}: ${file}`);

          // 发送进度
          if (win) {
            win.webContents.send('encryption:progress', {
              operation: 'encrypt',
              current: i + 1,
              total: total,
              percentage: Math.round(((i + 1) / total) * 100)
            });
          }
        } catch (error) {
          logger?.error(`Failed to encrypt file ${file} in ${dirName}: ` + error.message);
          failed++;
        }
      }

      logger?.info(`Batch encryption completed: ${encrypted} encrypted, ${skipped} skipped, ${failed} failed`);

      // 更新 meta.json 的加密状态
      const encryptAllMetaUpdated = updateMetaJson(
        databaseDir,
        (meta) => {
          meta.encrypted = true;
        }
      );
      if (encryptAllMetaUpdated) {
        logger?.info('meta.json updated (encrypted = true)');
      }

      return {
        success: true,
        encrypted,
        failed,
        skipped
      };
    } catch (error) {
      logger?.error('Failed to encrypt all notes: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 批量解密所有笔记
   */
  ipcMain.handle('encryption:decrypt-all', async () => {
    try {
      logger?.info('Batch decryption all notes start');
      // 获取笔记目录和回收站目录
      const databaseDir = getDatabaseDir();
      const notesDir = path.join(databaseDir, 'objects');
      const trashDir = path.join(databaseDir, 'trash');

      // 收集所有需要解密的文件
      const filesToDecrypt = [];

      // 收集 objects 目录中的文件
      try {
        const objectFiles = fs.readdirSync(notesDir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ file: f, dir: notesDir, dirName: 'objects' }));
        filesToDecrypt.push(...objectFiles);
      } catch (error) {
        logger?.error('Failed to read objects directory: ' + error.message);
        if (error.code !== 'ENOENT') throw error;
      }

      // 收集 trash 目录中的文件
      try {
        const trashFiles = fs.readdirSync(trashDir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ file: f, dir: trashDir, dirName: 'trash' }));
        filesToDecrypt.push(...trashFiles);
      } catch (error) {
        logger?.error('Failed to read trash directory: ' + error.message);
        if (error.code !== 'ENOENT') throw error;
      }

      if (filesToDecrypt.length === 0) {
        return { success: true, decrypted: 0, failed: 0, skipped: 0 };
      }

      const total = filesToDecrypt.length;
      let decrypted = 0;
      let failed = 0;
      let skipped = 0;

      const win = getWindow();

      for (let i = 0; i < filesToDecrypt.length; i++) {
        const { file, dir, dirName } = filesToDecrypt[i];
        const filePath = path.join(dir, file);

        try {
          // 读取文件内容
          let content = fs.readFileSync(filePath, 'utf-8');

          // 检查是否为加密内容
          if (!content.startsWith('ENCRYPTED:')) {
            skipped++;
            continue;
          }

          // 解密内容
          const parts = content.split(':');
          if (parts.length < 6) {
            logger?.error(`Invalid encrypted format in file ${file} in ${dirName}`);
            failed++;
            continue;
          }

          const [prefix, version, saltB64, ivB64, authTagB64, ...encryptedParts] = parts;
          const encryptedData = encryptedParts.join(':');

          if (prefix !== 'ENCRYPTED' || version !== 'v1') {
            logger?.error(`Unsupported encryption version in file ${file} in ${dirName}`);
            failed++;
            continue;
          }

          // 解码 Base64
          const salt = Buffer.from(saltB64, 'base64');
          const iv = Buffer.from(ivB64, 'base64');
          const authTag = Buffer.from(authTagB64, 'base64');

          // 从恢复密钥派生加密密钥
          const key = deriveKeyFromRecovery(currentRecoveryKey, salt);

          // AES-256-GCM 解密
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);

          let decryptedContent = decipher.update(encryptedData, 'base64', 'utf8');
          decryptedContent += decipher.final('utf8');

          // 写回文件（明文）
          safeWriteFileSync(filePath, decryptedContent, 'utf-8');
          decrypted++;

          logger?.info(`Decrypted file in ${dirName}: ${file}`);

          // 发送进度
          if (win) {
            win.webContents.send('encryption:progress', {
              operation: 'decrypt',
              current: i + 1,
              total: total,
              percentage: Math.round(((i + 1) / total) * 100)
            });
          }
        } catch (error) {
          logger?.error(`Failed to decrypt file ${file} in ${dirName}: ` + error.message);
          failed++;
        }
      }

      logger?.info(`Batch decryption completed: ${decrypted} decrypted, ${skipped} skipped, ${failed} failed`);

      // 更新 meta.json 的加密状态
      const decryptAllMetaUpdated = updateMetaJson(
        databaseDir,
        (meta) => {
          meta.encrypted = false;
        }
      );
      if (decryptAllMetaUpdated) {
        logger?.info('meta.json updated (encrypted = false)');
      }

      return {
        success: true,
        decrypted,
        failed,
        skipped
      };
    } catch (error) {
      logger?.error('Failed to decrypt all notes: ' + error.message);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * 加密单个笔记内容
   */
  ipcMain.handle('encryption:encrypt-note', async (event, { content }) => {
    try {
      if (!encryptionEnabled || !currentRecoveryKey) {
        // 未启用加密，返回原内容
        return { success: true, encrypted: content };
      }

      // 生成独立的盐值和IV
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      // 从恢复密钥派生加密密钥
      const key = deriveKeyFromRecovery(currentRecoveryKey, salt);

      // AES-256-GCM 加密
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(content, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      // 格式化为: ENCRYPTED:v1:salt:iv:authTag:data
      const result = [
        'ENCRYPTED',
        'v1',
        salt.toString('base64'),
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted
      ].join(':');

      return { success: true, encrypted: result };
    } catch (error) {
      logger?.error('Failed to encrypt single note: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 解密单个笔记内容
   */
  ipcMain.handle('encryption:decrypt-note', async (event, { content }) => {
    try {
      // 检查是否为加密内容
      if (!content.startsWith('ENCRYPTED:')) {
        // 不是加密内容，直接返回
        return { success: true, decrypted: content };
      }

      if (!encryptionEnabled || !currentRecoveryKey) {
        throw new Error('加密功能未启用或未解锁');
      }

      // 解析加密格式: ENCRYPTED:v1:salt:iv:authTag:data
      const parts = content.split(':');
      if (parts.length < 6) {
        throw new Error('加密格式无效');
      }

      const [prefix, version, saltB64, ivB64, authTagB64, ...encryptedParts] = parts;
      const encryptedData = encryptedParts.join(':'); // 处理内容中可能包含冒号的情况

      if (prefix !== 'ENCRYPTED' || version !== 'v1') {
        throw new Error('不支持的加密版本');
      }

      // 解码 Base64
      const salt = Buffer.from(saltB64, 'base64');
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');

      // 从恢复密钥派生加密密钥
      const key = deriveKeyFromRecovery(currentRecoveryKey, salt);

      // AES-256-GCM 解密
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return { success: true, decrypted };
    } catch (error) {
      logger?.error('Failed to decrypt single note: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  // 返回加密管理器实例
  return {
    isEnabled: () => encryptionEnabled,
    isUnlocked: () => encryptionEnabled, // 恢复密钥方案无锁定
    getRecoveryKey: () => currentRecoveryKey
  };
}

export default createEncryptionManager;
