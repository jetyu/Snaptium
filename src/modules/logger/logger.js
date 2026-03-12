import fs from "node:fs";
import log from "electron-log";
import { getLogDirectory, getLogFileName } from "./config.js";

export function createGlobalLogger(app) {
  const logDir = getLogDirectory(app);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  log.initialize();

  log.transports.console.level = "debug";
  log.transports.file.level = "debug";
  log.transports.file.maxSize = 10 * 1024 * 1024;
  log.transports.file.format = "{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}";
  log.transports.file.resolvePathFn = () => `${logDir}/${getLogFileName()}`;

  return {
    logger: log,
    logDir
  };
}

/**
 * 更新日志配置
 * @param {Object} settings - { enabled, level }
 */
export function updateLoggerConfig(settings) {
  if (!settings) return;

  const { enabled, level } = settings;
  const validLevels = ['error', 'warn', 'info', 'debug'];

  // 校验参数
  const finalEnabled = typeof enabled === 'boolean' ? enabled : true;
  const finalLevel = validLevels.includes(level) ? level : 'info';

  if (finalEnabled) {
    log.transports.console.level = finalLevel;
    log.transports.file.level = finalLevel;
  }

  // 记录配置变更调试信息
  log.debug(`Logging status changed: ${finalEnabled ? 'Enabled' : 'Disabled'}`);
  if (finalEnabled) {
    log.debug(`Log level set to: ${finalLevel}`);
  }

  if (!finalEnabled) {
    log.transports.console.level = false;
    log.transports.file.level = false;
  }
}


