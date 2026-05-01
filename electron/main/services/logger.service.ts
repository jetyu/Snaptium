import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { formatTimestamp } from '../utils/formatTools.js';
import { getErrorMessage } from '../utils/error.utils.js';

const LOG_AUTO_CLEAR_DAY_OPTIONS = new Set([0, 10, 20]);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMessage = string | JsonValue | Error;
export type LogContext = JsonValue | Error;

export interface LoggerConfigUpdate {
  loggingEnabled?: boolean;
  logLevel?: string;
  logAutoClearDays?: number;
}

export interface ScopedLogger {
  info: (message: LogMessage, context?: LogContext) => void;
  warn: (message: LogMessage, context?: LogContext) => void;
  error: (message: LogMessage, context?: LogContext) => void;
  debug: (message: LogMessage, context?: LogContext) => void;
}

class LoggerService {
  private readonly logDir: string;
  private enabled: boolean;
  private level: LogLevel;
  private cleanupDays: number;
  private lastCleanupDateKey: string;
  private readonly levels: Record<LogLevel, number>;

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

  private normalizeLevel(level: string): LogLevel | null {
    const normalizedLevel = level.toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.levels, normalizedLevel)
      ? normalizedLevel as LogLevel
      : null;
  }

  private normalizeConfiguredLevel(level: string): LogLevel {
    const normalizedLevel = this.normalizeLevel(level) ?? 'error';

    return normalizedLevel;
  }

  private normalizeCleanupDays(days: number): number {
    const normalizedDays = Number(days);

    if (!Number.isFinite(normalizedDays)) {
      return 0;
    }

    return LOG_AUTO_CLEAR_DAY_OPTIONS.has(normalizedDays) ? normalizedDays : 0;
  }

  private getCleanupDateKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private cleanupExpiredLogs(force = false): number {
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
        } catch (error: unknown) {
          console.error(`Failed to evaluate log file for cleanup: ${entry.name}: ${getErrorMessage(error)}`);
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to cleanup expired log files: ${getErrorMessage(error)}`);
    }

    return deletedCount;
  }

  private init(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  updateConfig(config: LoggerConfigUpdate): void {
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

  private getLogFilePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return path.join(this.logDir, `Snaptium_applogs_${year}${month}${day}.log`);
  }

  private stringifyValue(value: LogMessage | LogContext): string {
    if (value instanceof Error) {
      return `${value.name}: ${getErrorMessage(value)}`;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value === null) {
      return 'null';
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable context]';
    }
  }

  private normalizeMessage(message: LogMessage, context?: LogContext): string {
    const text = this.stringifyValue(message);
    if (context === undefined) {
      return text;
    }

    return `${text} | ${this.stringifyValue(context)}`;
  }

  private formatMessage(level: LogLevel, source: string, message: LogMessage, context?: LogContext): string {
    const timestamp = formatTimestamp();
    const sourceTag = source ? ` [${source}]` : '';
    const normalizedMessage = this.normalizeMessage(message, context);
    return `[${timestamp}] [${level.toUpperCase()}]${sourceTag} ${normalizedMessage}\n`;
  }

  log(level: string, source: string, message: LogMessage, context?: LogContext): void {
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
    } catch (error: unknown) {
      console.error(`Failed to write to log file: ${getErrorMessage(error)}`);
    }
  }

  openLogDir(): void {
    shell.openPath(this.logDir).catch((error: unknown) => {
      console.error(`Failed to open log directory: ${getErrorMessage(error)}`);
    });
  }

  info(source: string, message: LogMessage, context?: LogContext): void { this.log('info', source, message, context); }
  warn(source: string, message: LogMessage, context?: LogContext): void { this.log('warn', source, message, context); }
  error(source: string, message: LogMessage, context?: LogContext): void { this.log('error', source, message, context); }
  debug(source: string, message: LogMessage, context?: LogContext): void { this.log('debug', source, message, context); }

  createLogger(source: string): ScopedLogger {
    return {
      info: (message: LogMessage, context?: LogContext) => this.info(source, message, context),
      warn: (message: LogMessage, context?: LogContext) => this.warn(source, message, context),
      error: (message: LogMessage, context?: LogContext) => this.error(source, message, context),
      debug: (message: LogMessage, context?: LogContext) => this.debug(source, message, context),
    };
  }
}

export const loggerService = new LoggerService();
