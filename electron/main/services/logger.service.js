import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';

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

  /**
   * Update logger configuration
   * @param {Object} config 
   */
  updateConfig(config) {
    if (config.loggingEnabled !== undefined) {
      this.enabled = config.loggingEnabled;
    }
    if (config.logLevel !== undefined) {
      this.level = config.logLevel.toLowerCase();
    }
  }

  /**
   * Get current log file path based on date
   * Format: Pilotra_logs_YYYYMMDD.log
   */
  getLogFilePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return path.join(this.logDir, `Pilotra_logs_${year}${month}${day}.log`);
  }

  formatMessage(level, source, message) {
    const timestamp = new Date().toISOString();
    const sourceTag = source ? ` [${source}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${sourceTag} ${message}\n`;
  }

  log(level, source, message) {
    if (!this.enabled) return;

    const currentLevelNum = this.levels[level.toLowerCase()] ?? 1;
    const minLevelNum = this.levels[this.level] ?? 1;

    if (currentLevelNum < minLevelNum) {
      return;
    }

    const formatted = this.formatMessage(level, source, message);
    
    // Console output
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

    // File output
    try {
      const logFile = this.getLogFilePath();
      fs.appendFileSync(logFile, formatted, 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  /**
   * Open the log directory in system explorer
   */
  openLogDir() {
    shell.openPath(this.logDir).catch(err => {
      console.error('Failed to open log directory:', err);
    });
  }

  info(source, message) { this.log('info', source, message); }
  warn(source, message) { this.log('warn', source, message); }
  error(source, message) { this.log('error', source, message); }
  debug(source, message) { this.log('debug', source, message); }
}

export const loggerService = new LoggerService();
