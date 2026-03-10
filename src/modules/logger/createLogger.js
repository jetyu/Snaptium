/**
 * 创建带分类(scope)的 logger
 * @param {Object} baseLogger - electron-log 实例
 * @param {string} category - 日志分类
 * @returns {Object}
 */
export function createLogger(baseLogger, category = "app") {
  const scoped = baseLogger.scope(category);

  return {
    debug: (...args) => scoped.debug(...args),
    info: (...args) => scoped.info(...args),
    warn: (...args) => scoped.warn(...args),
    error: (...args) => scoped.error(...args),
    verbose: (...args) => scoped.verbose(...args)
  };
}
