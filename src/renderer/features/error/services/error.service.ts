import { createLogger } from '@renderer/features/logger';
import { getErrorMessage, serializeError } from '@shared/utils/error.utils';

const logger = createLogger('RendererGlobalError');

let hasRegisteredGlobalErrorHandlers = false;

function normalizeErrorContext(error: unknown) {
  const serializedError = serializeError(error);
  return {
    name: serializedError.name,
    message: serializedError.message,
    code: serializedError.code,
    stack: serializedError.stack,
  };
}

export function registerRendererGlobalErrorHandlers(): void {
  if (hasRegisteredGlobalErrorHandlers) {
    return;
  }

  hasRegisteredGlobalErrorHandlers = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    const error = event.error ?? event.message;
    logger.error('window.error captured', {
      ...normalizeErrorContext(error),
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logger.error('window.unhandledrejection captured', normalizeErrorContext(event.reason));
  });

  logger.info('Renderer global error handlers registered');
}

export function withErrorBoundary<TArgs extends unknown[], TResult>(source: string, fn: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    try {
      return fn(...args);
    } catch (error: unknown) {
      logger.error(`${source} sync error captured`, normalizeErrorContext(error));
      throw error;
    }
  };
}

export async function withErrorBoundaryAsync<TArgs extends unknown[], TResult>(source: string, fn: (...args: TArgs) => Promise<TResult>, args: TArgs): Promise<TResult> {
  try {
    return await fn(...args);
  } catch (error: unknown) {
    logger.error(`${source} async error captured: ${getErrorMessage(error)}`, normalizeErrorContext(error));
    throw error;
  }
}
