/**
 * 创建带分类(scope)的 logger
 * @param {Object} baseLogger - electron-log 实例
 * @param {string} category - 日志分类
 * @returns {Object}
 */
export function createLogger(baseLogger, category = "Logs") {
  const paddedCategory = `[${category}]`.padEnd(1, ' ');

  return {
    debug: (...args) => baseLogger.debug(paddedCategory, ...args),
    info: (...args) => baseLogger.info(paddedCategory, ...args),
    warn: (...args) => baseLogger.warn(paddedCategory, ...args),
    error: (...args) => baseLogger.error(paddedCategory, ...args),
  };
}
