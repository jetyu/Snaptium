import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

class LoggerService {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.init();
  }

  init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, source, message) {
    const timestamp = new Date().toISOString();
    const sourceTag = source ? ` [${source}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${sourceTag} ${message}\n`;
  }

  log(level, source, message) {
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
      fs.appendFileSync(this.logFile, formatted, 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(source, message) { this.log('info', source, message); }
  warn(source, message) { this.log('warn', source, message); }
  error(source, message) { this.log('error', source, message); }
  debug(source, message) { this.log('debug', source, message); }
}

export const loggerService = new LoggerService();
