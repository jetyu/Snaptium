import * as fs from "node:fs";
import * as crypto from "node:crypto";

/**
 * 导入导出工具函数模块
 * 提供通用的文件处理和哈希计算功能
 */

/**
 * 计算文件的 SHA-256 哈希值
 * @param {string} filePath - 文件路径
 * @param {string} algorithm - 哈希算法，默认 'sha256'
 * @returns {string|null} 哈希值（十六进制字符串），失败返回 null
 */
export function calculateFileHash(filePath, algorithm = 'sha256') {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  } catch (error) {
    console.warn(`[Utils] Failed to calculate file hash (${filePath}):`, error);
    return null;
  }
}

/**
 * 计算字符串的哈希值
 * @param {string} content - 字符串内容
 * @param {string} algorithm - 哈希算法，默认 'sha256'
 * @returns {string} 哈希值（十六进制字符串）
 */
export function calculateStringHash(content, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(content).digest('hex');
}

/**
 * 批量计算多个文件的哈希值
 * @param {string[]} filePaths - 文件路径数组
 * @param {string} algorithm - 哈希算法，默认 'sha256'
 * @returns {Map<string, string>} 文件路径到哈希值的映射
 */
export function calculateBatchFileHash(filePaths, algorithm = 'sha256') {
  const hashMap = new Map();
  for (const filePath of filePaths) {
    const hash = calculateFileHash(filePath, algorithm);
    if (hash) {
      hashMap.set(filePath, hash);
    }
  }
  return hashMap;
}

/**
 * 比较两个文件内容是否相同（通过哈希值）
 * @param {string} filePath1 - 第一个文件路径
 * @param {string} filePath2 - 第二个文件路径
 * @param {string} algorithm - 哈希算法，默认 'sha256'
 * @returns {boolean} 内容是否相同
 */
export function compareFileContent(filePath1, filePath2, algorithm = 'sha256') {
  const hash1 = calculateFileHash(filePath1, algorithm);
  const hash2 = calculateFileHash(filePath2, algorithm);
  
  if (!hash1 || !hash2) {
    return false;
  }
  
  return hash1 === hash2;
}
