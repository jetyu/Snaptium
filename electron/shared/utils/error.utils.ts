/**
 * Error handling runs at runtime boundaries (IPC, third-party responses, catch blocks),
 * so the input type is `unknown` and must be narrowed before use.
 */

export interface SerializedError {
  name: string;
  message: string;
  code: string | null;
  stack: string | null;
}

interface ErrorRecord {
  message?: string;
  name?: string;
  code?: string;
  stack?: string;
}

function isErrorRecord(value: unknown): value is ErrorRecord {
  return typeof value === 'object' && value !== null;
}

export function getErrorMessage(error: unknown, fallbackMessage = 'Unknown error'): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message.length > 0 ? message : fallbackMessage;
  }

  if (typeof error === 'string') {
    const message = error.trim();
    return message.length > 0 ? message : fallbackMessage;
  }

  if (isErrorRecord(error) && typeof error.message === 'string') {
    const message = error.message.trim();
    return message.length > 0 ? message : fallbackMessage;
  }

  return fallbackMessage;
}

export function getErrorCode(error: unknown): string | null {
  if (!isErrorRecord(error)) {
    return null;
  }

  return typeof error.code === 'string' && error.code.trim().length > 0
    ? error.code
    : null;
}

export function serializeError(error: unknown, fallbackMessage = 'Unknown error'): SerializedError {
  const message = getErrorMessage(error, fallbackMessage);

  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message,
      code: getErrorCode(error),
      stack: typeof error.stack === 'string' && error.stack.trim().length > 0 ? error.stack : null,
    };
  }

  if (isErrorRecord(error)) {
    return {
      name: typeof error.name === 'string' && error.name.trim().length > 0 ? error.name : 'Error',
      message,
      code: getErrorCode(error),
      stack: typeof error.stack === 'string' && error.stack.trim().length > 0 ? error.stack : null,
    };
  }

  return {
    name: 'Error',
    message,
    code: null,
    stack: null,
  };
}
