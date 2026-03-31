export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private source: string;

  constructor(source: string = 'Default') {
    this.source = source;
  }

  private send(level: LogLevel, message: string) {
    const api = window.electronAPI?.logger;
    if (api?.log) {
      api.log({ level, source: this.source, message });
      return;
    }
    // Fallback for dev environments without Electron bridge
    const formatted = `[${this.source}] ${message}`;
    const consoleMethods: Record<LogLevel, (...args: unknown[]) => void> = {
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
    consoleMethods[level](formatted);
  }

  info(message: string) { this.send('info', message); }
  warn(message: string) { this.send('warn', message); }
  error(message: string) { this.send('error', message); }
  debug(message: string) { this.send('debug', message); }
}

// Create a default instance for general use
export const logger = new Logger();

// Factory for partitioned loggers
export const createLogger = (source: string) => new Logger(source);
