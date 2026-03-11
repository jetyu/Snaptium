import fs from "node:fs";
import log from "electron-log";
import { getLogDirectory, getLogFileName } from "./config.js";

export function createGlobalLogger(app) {
  const logDir = getLogDirectory(app);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  log.initialize();

  log.transports.console.level = "info";
  log.transports.file.level = "info";
  log.transports.file.maxSize = 10 * 1024 * 1024;
  log.transports.file.format = "{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}";
  log.transports.file.resolvePathFn = () => `${logDir}/${getLogFileName()}`;

  return {
    logger: log,
    logDir
  };
}

