import { app } from 'electron';
import { loggerService } from './logger.service.js';
import { serializeError } from '../../shared/utils/error.utils.js';

const GLOBAL_ERROR_SOURCE = 'MainGlobalError';

interface ErrorMetadata {
  [key: string]: string | number | boolean | null;
}

function reportGlobalError(event: string, error: unknown, metadata?: ErrorMetadata): void {
  const serializedError = serializeError(error);
  loggerService.error(GLOBAL_ERROR_SOURCE, `${event} captured`, {
    ...serializedError,
    ...(metadata ?? {}),
  });
}

class ErrorService {
  private hasRegisteredGlobalHandlers = false;

  registerGlobalErrorHandlers(): void {
    if (this.hasRegisteredGlobalHandlers) {
      return;
    }

    this.hasRegisteredGlobalHandlers = true;

    process.on('uncaughtException', (error: Error) => {
      reportGlobalError('uncaughtException', error);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      reportGlobalError('unhandledRejection', reason);
    });

    app.on('render-process-gone', (_event, webContents, details) => {
      reportGlobalError('render-process-gone', new Error('Renderer process exited unexpectedly'), {
        reason: details.reason,
        exitCode: details.exitCode,
        webContentsId: webContents.id,
      });
    });

    app.on('child-process-gone', (_event, details) => {
      reportGlobalError('child-process-gone', new Error('Child process exited unexpectedly'), {
        type: details.type,
        reason: details.reason,
        exitCode: details.exitCode,
        serviceName: details.serviceName ?? null,
        name: details.name ?? null,
      });
    });
  }
}

export const errorService = new ErrorService();


export {
  getErrorCode,
  getErrorMessage,
  serializeError,
  type SerializedError,
} from '../../shared/utils/error.utils.js';
