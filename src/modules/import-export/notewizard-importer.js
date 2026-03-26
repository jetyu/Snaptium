import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { calculateFileHash } from "../../utils/fileHashUtils.js";

/**
 * 笔记导入模块
 * 负责解析 .nwp 文件并合并到现有数据库
 * 支持内容去重：通过 SHA-256 哈希对比文件内容
 */

/**
 * 创建导入管理器
 * @param {Object} dependencies - 依赖注入
 * @param {Object} dependencies.app - Electron app 实例
 * @param {Object} dependencies.dialog - Electron dialog 实例
 * @param {Function} dependencies.getPreference - 获取配置的函数
 * @param {Function} dependencies.t - 国际化翻译函数
 * @returns {Object} 导入管理器实例
 */
export function createImporter(dependencies) {
  const { app, dialog, getPreference, t, AdmZip, logger } = dependencies;

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
   * 创建临时目录
   * @returns {string} 临时目录路径
   */
  function createTempDir() {
    const tempDir = path.join(os.tmpdir(), `notewizard_import_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  /**
   * 清理临时目录
   * @param {string} tempDir - 临时目录路径
   */
  function cleanupTempDir(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger?.warn('NoteWizard Importer: Failed to clean up temp dir:', error);
    }
  }

  /**
   * 验证导出包格式
   * @param {string} tempDir - 解压后的临时目录
   * @returns {Object} 验证结果
   */
  function validatePackage(tempDir) {
    const manifestPath = path.join(tempDir, 'manifest.json');
    const nodesPath = path.join(tempDir, 'nodes.jsonl');

    if (!fs.existsSync(manifestPath)) {
      return {
        valid: false,
        error: t('import.notewizard.error.invalidPackage')
      };
    }

    if (!fs.existsSync(nodesPath)) {
      return {
        valid: false,
        error: t('import.notewizard.error.noNodes')
      };
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return { valid: true, manifest };
    } catch (error) {
      return {
        valid: false,
        error: t('import.notewizard.error.invalidManifest')
      };
    }
  }

  /**
   * 读取现有的 contentId 集合和哈希映射
   * @param {string} databaseDir - 数据库目录
   * @returns {Object} { contentIds: Set, hashMap: Map }
   */
  function getExistingContentIds(databaseDir) {
    const contentIds = new Set();
    const hashMap = new Map(); // contentId -> hash
    const nodesPath = path.join(databaseDir, 'nodes.jsonl');

    if (!fs.existsSync(nodesPath)) {
      return { contentIds, hashMap };
    }

    const content = fs.readFileSync(nodesPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const objectsDir = path.join(databaseDir, 'objects');

    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        if (node.contentId) {
          contentIds.add(node.contentId);

          // 计算现有文件的哈希值
          const filePath = path.join(objectsDir, `${node.contentId}.md`);
          const hash = calculateFileHash(filePath);
          if (hash) {
            hashMap.set(node.contentId, hash);
          }
        }
      } catch (error) {
        logger?.error('NoteWizard Importer: Failed to parse node 1:', error);
      }
    }

    return { contentIds, hashMap };
  }

  /**
   * 生成唯一的 contentId
   * @param {string} originalId - 原始 contentId
   * @param {Set<string>} existingIds - 已存在的 contentId 集合
   * @returns {string} 新的唯一 contentId
   */
  function generateUniqueContentId(originalId, existingIds) {
    if (!existingIds.has(originalId)) {
      return originalId;
    }

    let counter = 1;
    let newId = `${originalId}_${counter}`;

    while (existingIds.has(newId)) {
      counter++;
      newId = `${originalId}_${counter}`;
    }

    return newId;
  }

  /**
   * 读取现有的节点 ID 集合
   * @param {string} databaseDir - 数据库目录
   * @returns {Set<string>} 节点 ID 集合
   */
  function getExistingNodeIds(databaseDir) {
    const nodeIds = new Set();
    const nodesPath = path.join(databaseDir, 'nodes.jsonl');

    if (!fs.existsSync(nodesPath)) {
      return nodeIds;
    }

    const content = fs.readFileSync(nodesPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        if (node.id) {
          nodeIds.add(node.id);
        }
      } catch (error) {
        logger?.error('NoteWizard Importer: Failed to parse node 2: ', error);
      }
    }

    return nodeIds;
  }

  /**
   * 处理节点数据，解决 contentId 冲突并去重
   * @param {string} tempDir - 临时目录
   * @param {string} databaseDir - 数据库目录
   * @param {Set<string>} existingIds - 已存在的 contentId 集合
   * @param {Map<string, string>} hashMap - 已存在文件的哈希映射
   * @param {Set<string>} existingNodeIds - 已存在的节点 ID 集合
   * @returns {Object} 处理结果
   */
  function processNodes(tempDir, databaseDir, existingIds, hashMap, existingNodeIds) {
    const nodesPath = path.join(tempDir, 'nodes.jsonl');
    const content = fs.readFileSync(nodesPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const tempObjectsDir = path.join(tempDir, 'objects');

    const processedNodes = [];
    const contentIdMap = new Map(); // 原始ID -> 新ID的映射
    const skippedNodes = []; // 跳过的节点（内容重复）
    let conflictCount = 0;
    let skippedCount = 0;
    let skippedNoteCount = 0; // 只统计跳过的笔记
    let activeCount = 0;
    let trashedCount = 0;

    for (const line of lines) {
      try {
        const node = JSON.parse(line);

        // 检查节点 ID 是否已存在（避免重复导入文件夹等）
        if (existingNodeIds.has(node.id)) {
          logger?.info(`NoteWizard Importer: Skipped Node ID:[${node.id}] Note Name:[${node.name}]`);
          skippedCount++;
          // 如果是笔记文件，单独统计
          if (node.type === 'file') {
            skippedNoteCount++;
          }
          continue;
        }

        if (node.contentId) {
          const originalId = node.contentId;

          // 检查 contentId 是否冲突
          if (existingIds.has(originalId)) {
            // 计算导入文件的哈希值
            const importFilePath = path.join(tempObjectsDir, `${originalId}.md`);
            const importHash = calculateFileHash(importFilePath);

            // 获取现有文件的哈希值
            const existingHash = hashMap.get(originalId);

            // 如果哈希值相同，说明内容完全一致，跳过导入
            if (importHash && existingHash && importHash === existingHash) {
              logger?.info(`NoteWizard Importer: Skipped duplicate content: ${originalId} (${node.name})`);
              skippedNodes.push(node);
              skippedCount++;
              skippedNoteCount++;
              continue; // 跳过此节点
            }

            // 内容不同，生成新的 contentId
            const newId = generateUniqueContentId(originalId, existingIds);
            contentIdMap.set(originalId, newId);
            node.contentId = newId;
            conflictCount++;
            existingIds.add(newId);

            // 更新哈希映射
            if (importHash) {
              hashMap.set(newId, importHash);
            }
          } else {
            // 没有冲突，直接添加
            existingIds.add(originalId);

            // 计算并保存哈希值
            const importFilePath = path.join(tempObjectsDir, `${originalId}.md`);
            const importHash = calculateFileHash(importFilePath);
            if (importHash) {
              hashMap.set(originalId, importHash);
            }
          }
        }

        // 统计正常笔记和回收站笔记
        if (node.type === 'file') {
          if (node.trashed) {
            trashedCount++;
          } else {
            activeCount++;
          }
        }
        processedNodes.push(node);
      } catch (error) {
        logger?.error('NoteWizard Importer: Failed to parse node 3:', error);
      }
    }

    return {
      processedNodes,
      contentIdMap,
      conflictCount,
      skippedCount,
      skippedNoteCount,
      skippedNodes,
      activeCount,
      trashedCount
    };
  }

  /**
   * 复制文件并处理重命名
   * @param {string} srcPath - 源文件路径
   * @param {string} destPath - 目标文件路径
   */
  function copyFile(srcPath, destPath) {
    if (!fs.existsSync(srcPath)) {
      return;
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(srcPath, destPath);
  }

  /**
   * 复制目录
   * @param {string} srcDir - 源目录
   * @param {string} destDir - 目标目录
   * @param {Map<string, string>} contentIdMap - contentId 映射表
   */
  function copyDirectory(srcDir, destDir, contentIdMap = null) {
    if (!fs.existsSync(srcDir)) {
      return;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      let destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath, contentIdMap);
      } else {
        // 如果是 objects 目录的文件，检查是否需要重命名
        if (contentIdMap && contentIdMap.size > 0) {
          const baseName = path.basename(entry.name, path.extname(entry.name));
          if (contentIdMap.has(baseName)) {
            const newName = contentIdMap.get(baseName) + path.extname(entry.name);
            destPath = path.join(destDir, newName);
          }
        }
        copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 合并节点数据到现有数据库
   * @param {Array} processedNodes - 处理后的节点数组
   * @param {string} databaseDir - 数据库目录
   */
  function mergeNodes(processedNodes, databaseDir) {
    const nodesPath = path.join(databaseDir, 'nodes.jsonl');
    const newLines = processedNodes.map(node => JSON.stringify(node));

    // 追加到现有文件
    fs.appendFileSync(nodesPath, '\n' + newLines.join('\n'), 'utf-8');
  }

  /**
   * 执行导入操作
   * @param {BrowserWindow} win - 主窗口实例
   * @returns {Promise<Object>} 导入结果
   */
  async function importNotes(win) {
    let tempDir = null;

    try {
      // 检查数据库目录
      const databaseDir = getDatabaseDir();
      if (!databaseDir) {
        return {
          success: false,
          error: t('import.notewizard.error.noWorkspace')
        };
      }

      if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
      }

      // 显示打开对话框
      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: t('import.notewizard.dialog.title'),
        filters: [
          {
            name: t('import.notewizard.dialog.filterName'),
            extensions: ['nwp']
          },
          {
            name: t('import.notewizard.dialog.allFiles'),
            extensions: ['*']
          }
        ],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          cancelled: true
        };
      }

      const importFilePath = filePaths[0];

      // 创建临时目录并解压
      tempDir = createTempDir();
      const zip = new AdmZip(importFilePath);
      zip.extractAllTo(tempDir, true);

      // 验证包格式
      const validation = validatePackage(tempDir);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 获取现有的 contentId 和哈希映射
      const { contentIds: existingIds, hashMap } = getExistingContentIds(databaseDir);

      // 获取现有的节点 ID 集合
      const existingNodeIds = getExistingNodeIds(databaseDir);

      // 处理节点数据（包含去重逻辑）
      const {
        processedNodes,
        contentIdMap,
        conflictCount,
        skippedCount,
        skippedNoteCount,
        skippedNodes,
        activeCount,
        trashedCount
      } = processNodes(tempDir, databaseDir, existingIds, hashMap, existingNodeIds);

      // 复制 objects 目录（跳过重复的文件）
      const srcObjectsDir = path.join(tempDir, 'objects');
      const destObjectsDir = path.join(databaseDir, 'objects');
      copyDirectory(srcObjectsDir, destObjectsDir, contentIdMap);

      // 复制 images 目录
      const srcImagesDir = path.join(tempDir, 'images');
      const destImagesDir = path.join(databaseDir, 'images');
      copyDirectory(srcImagesDir, destImagesDir, contentIdMap);

      // 复制 trash 目录（回收站文件）
      const srcTrashDir = path.join(tempDir, 'trash');
      const destTrashDir = path.join(databaseDir, 'trash');
      copyDirectory(srcTrashDir, destTrashDir, contentIdMap);

      // 合并节点数据
      mergeNodes(processedNodes, databaseDir);

      const totalNotes = activeCount + trashedCount;
      logger?.info(`Successfully imported ${totalNotes} Notewizard Package notes, ${conflictCount} conflicts renamed, ${skippedNoteCount} duplicate notes skipped`);

      return {
        success: true,
        noteCount: totalNotes,
        activeNotes: activeCount,
        trashedNotes: trashedCount,
        conflictCount: conflictCount,
        skippedCount: skippedNoteCount,
        manifest: validation.manifest
      };
    } catch (error) {
      logger?.error('NoteWizard Importer: Import failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      // 清理临时目录
      if (tempDir) {
        cleanupTempDir(tempDir);
      }
    }
  }

  return {
    importNotes
  };
}
