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
  const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
  
  // 校验参数
  const finalEnabled = typeof enabled === 'boolean' ? enabled : true;
  const finalLevel = validLevels.includes(level) ? level : 'info';
  
  // 控制台日志始终开启，但级别可调
  log.transports.console.level = finalEnabled ? finalLevel : false;
  
  // 文件日志
  log.transports.file.level = finalEnabled ? finalLevel : false;
}

