import { electronApi } from '@renderer/core/bridge/electronApi';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogContext = string | number | boolean | Record<string, unknown> | Error | null;

class Logger {
  private source: string;

  constructor(source: string = 'Default') {
    this.source = source;
  }

  private normalizeMessage(message: string, context?: LogContext): string {
    if (context === undefined) {
      return message;
    }

    if (context instanceof Error) {
      return `${message} | ${context.name}: ${context.message}`;
    }

    if (typeof context === 'string' || typeof context === 'number' || typeof context === 'boolean') {
      return `${message} | ${String(context)}`;
    }

    try {
      return `${message} | ${JSON.stringify(context)}`;
    } catch {
      return `${message} | [unserializable context]`;
    }
  }

  private send(level: LogLevel, message: string, context?: LogContext) {
    const normalizedMessage = this.normalizeMessage(message, context);

    if (electronApi.logger.isAvailable()) {
      electronApi.logger.log({ level, source: this.source, message, context });
      return;
    }

    const formatted = `[${this.source}] ${normalizedMessage}`;
    const consoleMethods: Record<LogLevel, (...args: unknown[]) => void> = {
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
    consoleMethods[level](formatted);
  }

  info(message: string, context?: LogContext) { this.send('info', message, context); }
  warn(message: string, context?: LogContext) { this.send('warn', message, context); }
  error(message: string, context?: LogContext) { this.send('error', message, context); }
  debug(message: string, context?: LogContext) { this.send('debug', message, context); }
}

// Create a default instance for general use
export const logger = new Logger();

// Factory for partitioned loggers
export const createLogger = (source: string) => new Logger(source);
