import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { formatTimestamp } from '../utils/formatTools.js';

const LOG_AUTO_CLEAR_DAY_OPTIONS = new Set([0, 10, 20]);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

class LoggerService {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.enabled = true;
    this.level = 'error';
    this.cleanupDays = 0;
    this.lastCleanupDateKey = '';
    this.levels = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    this.init();
  }

  normalizeLevel(level) {
    if (typeof level !== 'string') {
      return null;
    }

    const normalizedLevel = level.toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.levels, normalizedLevel)
      ? normalizedLevel
      : null;
  }

  normalizeConfiguredLevel(level) {
    const normalizedLevel = this.normalizeLevel(level) ?? 'error';

    return normalizedLevel;
  }

  normalizeCleanupDays(days) {
    const normalizedDays = Number(days);

    if (!Number.isFinite(normalizedDays)) {
      return 0;
    }

    return LOG_AUTO_CLEAR_DAY_OPTIONS.has(normalizedDays) ? normalizedDays : 0;
  }

  getCleanupDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  cleanupExpiredLogs(force = false) {
    const cleanupDays = this.normalizeCleanupDays(this.cleanupDays);
    if (cleanupDays <= 0) {
      return 0;
    }

    const todayKey = this.getCleanupDateKey();
    if (!force && this.lastCleanupDateKey === todayKey) {
      return 0;
    }

    this.lastCleanupDateKey = todayKey;
    const expireBefore = Date.now() - (cleanupDays * DAY_IN_MS);
    let deletedCount = 0;

    try {
      const entries = fs.readdirSync(this.logDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.log') {
          continue;
        }

        const filePath = path.join(this.logDir, entry.name);

        try {
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < expireBefore) {
            fs.unlinkSync(filePath);
            deletedCount += 1;
          }
        } catch (error) {
          console.error(`Failed to evaluate log file for cleanup: ${entry.name}`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired log files:', error);
    }

    return deletedCount;
  }

  init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  updateConfig(config) {
    if (config.loggingEnabled !== undefined) {
      this.enabled = config.loggingEnabled;
    }
    if (config.logLevel !== undefined) {
      this.level = this.normalizeConfiguredLevel(config.logLevel);
    }
    if (config.logAutoClearDays !== undefined) {
      this.cleanupDays = this.normalizeCleanupDays(config.logAutoClearDays);
      if (this.cleanupDays === 0) {
        this.lastCleanupDateKey = '';
      }
    }

    this.cleanupExpiredLogs(true);
  }

  getLogFilePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return path.join(this.logDir, `Pilotrix_App_logs_${year}${month}${day}.log`);
  }

  normalizeMessage(message, context) {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    if (context === undefined) {
      return text;
    }

    if (context instanceof Error) {
      return `${text} | ${context.name}: ${context.message}`;
    }

    if (typeof context === 'string') {
      return `${text} | ${context}`;
    }

    try {
      return `${text} | ${JSON.stringify(context)}`;
    } catch {
      return `${text} | [unserializable context]`;
    }
  }

  formatMessage(level, source, message, context) {
    const timestamp = formatTimestamp();
    const sourceTag = source ? ` [${source}]` : '';
    const normalizedMessage = this.normalizeMessage(message, context);
    return `[${timestamp}] [${level.toUpperCase()}]${sourceTag} ${normalizedMessage}\n`;
  }

  log(level, source, message, context) {
    this.cleanupExpiredLogs();

    if (!this.enabled) return;

    const normalizedLevel = this.normalizeLevel(level);
    if (!normalizedLevel) {
      return;
    }

    const currentLevelNum = this.levels[normalizedLevel];
    const minLevelNum = this.levels[this.level] ?? 1;

    if (currentLevelNum < minLevelNum) {
      return;
    }

    const formatted = this.formatMessage(normalizedLevel, source, message, context);

    const consoleMsg = formatted.trim();
    switch (normalizedLevel) {
      case 'error':
        console.error(consoleMsg);
        break;
      case 'warn':
        console.warn(consoleMsg);
        break;
      case 'info':
        console.info(consoleMsg);
        break;
      case 'debug':
        console.debug(consoleMsg);
        break;
      default:
        console.log(consoleMsg);
    }

    try {
      const logFile = this.getLogFilePath();
      fs.appendFileSync(logFile, formatted, 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  openLogDir() {
    shell.openPath(this.logDir).catch(err => {
      console.error('Failed to open log directory:', err);
    });
  }

  info(source, message, context) { this.log('info', source, message, context); }
  warn(source, message, context) { this.log('warn', source, message, context); }
  error(source, message, context) { this.log('error', source, message, context); }
  debug(source, message, context) { this.log('debug', source, message, context); }

  createLogger(source) {
    return {
      info: (message, context) => this.info(source, message, context),
      warn: (message, context) => this.warn(source, message, context),
      error: (message, context) => this.error(source, message, context),
      debug: (message, context) => this.debug(source, message, context),
    };
  }
}

export const loggerService = new LoggerService();
