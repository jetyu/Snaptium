/**
 * Renderer-side logger service that sends logs to the main process via IPC.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private source: string;

  constructor(source: string = 'Default') {
    this.source = source;
  }

  private send(level: LogLevel, message: string) {
    if (window.electronAPI?.log) {
      window.electronAPI.log({ level, source: this.source, message });
    } else {
      // Fallback for dev environments without Electron bridge
      const formatted = `[${level.toUpperCase()}] [${this.source}] ${message}`;
      (console as any)[level]?.(formatted) || console.log(formatted);
    }
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
