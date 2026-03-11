/**
 * 图片处理模块
 * 负责图片的保存、处理和管理
 */

/**
 * 创建图片管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.fs - 文件系统模块
 * @param {Object} deps.path - 路径模块
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @returns {Object} 图片管理器实例
 */
export function createImagesManager(deps) {
  const { fs, path, ipcMain, logger } = deps;

  /**
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   * @returns {boolean} 是否成功
   */
  function ensureDirSync(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      logger?.error(`Failed to create directory: ${dirPath} - ` + error.message);
      return false;
    }
  }

  /**
   * 清理文件名片段，移除非法字符
   * @param {string} segment - 文件名片段
   * @param {string} fallback - 默认值
   * @returns {string} 清理后的文件名
   */
  function sanitizeNameSegment(segment, fallback = 'image') {
    if (!segment || typeof segment !== 'string') {
      return fallback;
    }
    const normalized = segment.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = normalized.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
    return cleaned || fallback;
  }

  /**
   * 保存粘贴的图片
   * @param {Object} payload - 图片数据
   * @param {Array} payload.bytes - 图片字节数组
   * @param {string} payload.originalName - 原始文件名
   * @param {string} payload.mimeType - MIME 类型
   * @param {string} payload.workspaceRoot - 工作区根路径
   * @param {string} payload.contentId - 笔记内容 ID
   * @param {string} payload.noteName - 笔记名称
   * @returns {Promise<Object>} 保存结果
   */
  async function saveImageFromPaste(payload = {}) {
    try {
      const {
        bytes,
        originalName = '',
        mimeType = 'image/png',
        workspaceRoot,
        contentId,
        noteName = '',
      } = payload;

      // 验证必需参数
      if (!workspaceRoot) {
        return { success: false, error: '未提供工作区路径' };
      }
      if (!contentId) {
        return { success: false, error: '未提供笔记标识 contentId' };
      }
      if (!Array.isArray(bytes) || !bytes.length) {
        return { success: false, error: '未接收到图片数据' };
      }

      // 转换字节数组为 Buffer
      const buffer = Buffer.from(bytes);

      // 根据 MIME 类型确定文件扩展名
      const safeExt = mimeType === 'image/png'
        ? '.png'
        : mimeType === 'image/jpeg'
          ? '.jpg'
          : mimeType === 'image/gif'
            ? '.gif'
            : mimeType === 'image/webp'
              ? '.webp'
              : path.extname(originalName) || '.png';

      // 生成安全的文件名
      const sanitizedNote = sanitizeNameSegment(noteName, 'note');
      const fileNameBase = sanitizeNameSegment(path.parse(originalName).name || '', sanitizedNote);
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const fileName = `${fileNameBase}-${timestamp}-${randomSuffix}${safeExt}`;

      // 构建保存路径
      const databaseDir = path.join(workspaceRoot, 'Database');
      const imagesDir = path.join(databaseDir, 'images', sanitizeNameSegment(contentId, 'note'));
      
      if (!ensureDirSync(imagesDir)) {
        return { success: false, error: '无法创建图片目录' };
      }

      const filePath = path.join(imagesDir, fileName);
      await fs.promises.writeFile(filePath, buffer);

      // 计算相对于 objects 目录的路径（用于 Markdown）
      const objectsDir = path.join(databaseDir, 'objects');
      const relativeFromObjects = path.relative(objectsDir, filePath).replace(/\\/g, '/');
      const markdownPath = relativeFromObjects.startsWith('.') ? relativeFromObjects : `./${relativeFromObjects}`;

      return {
        success: true,
        filePath,
        markdownPath,
      };
    } catch (error) {
      logger?.error('Failed to save pasted image: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 注册 IPC 处理器
   */
  function registerIpcHandlers() {
    // 保存粘贴的图片
    ipcMain.handle('images:save-paste', async (_event, payload) => {
      return await saveImageFromPaste(payload);
    });
  }

  // 自动注册 IPC 处理器
  if (ipcMain) {
    registerIpcHandlers();
  }

  return {
    saveImageFromPaste,
    ensureDirSync,
    sanitizeNameSegment
  };
}
