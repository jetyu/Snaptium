import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { formatTimestamp } from '../utils/formatTools.js';

class LoggerService {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.enabled = true;
    this.level = 'info';
    this.levels = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    this.init();
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
      this.level = config.logLevel.toLowerCase();
    }
  }

  getLogFilePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return path.join(this.logDir, `Pilotra_App_logs_${year}${month}${day}.log`);
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
    if (!this.enabled) return;

    const currentLevelNum = this.levels[level.toLowerCase()] ?? 1;
    const minLevelNum = this.levels[this.level] ?? 1;

    if (currentLevelNum < minLevelNum) {
      return;
    }

    const formatted = this.formatMessage(level, source, message, context);

    const consoleMsg = formatted.trim();
    switch (level.toLowerCase()) {
      case 'error':
        console.error(consoleMsg);
        break;
      case 'warn':
        console.warn(consoleMsg);
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
