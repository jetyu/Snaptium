import { session } from 'electron';
import { getErrorCode, getErrorMessage } from '../../shared/utils/error.utils.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Network Service');
const ELECTRON_NETWORK_REQUEST_ERROR_CODE = 'ELECTRON_NETWORK_REQUEST_FAILED';

export class ElectronNetworkRequestError extends Error {
  readonly code = ELECTRON_NETWORK_REQUEST_ERROR_CODE;

  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'ElectronNetworkRequestError';
  }
}

export function isElectronNetworkRequestError(error: unknown): error is ElectronNetworkRequestError {
  return error instanceof ElectronNetworkRequestError;
}

function valueToText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getErrorName(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return 'Error';
  }

  const name = valueToText((error as { name?: unknown }).name);
  return name ?? 'Error';
}

function isAbortError(error: unknown): boolean {
  return getErrorName(error) === 'AbortError';
}

function formatErrorCause(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null) {
    return null;
  }

  const record = cause as Record<string, unknown>;
  const parts = [
    valueToText(record.message),
    valueToText(record.code),
    valueToText(record.hostname),
    valueToText(record.address),
    valueToText(record.port),
  ].filter((item): item is string => item !== null);

  return parts.length > 0 ? parts.join(' / ') : null;
}

function getErrorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : null;
}

function sanitizeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function formatNetworkErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, 'Network request failed');
  const cause = formatErrorCause(getErrorCause(error));

  if (!cause || cause === message) {
    return message;
  }

  return `${message} (${cause})`;
}

async function logProxyDiagnostics(url: string, error: unknown): Promise<void> {
  const target = sanitizeUrlForLog(url);
  const cause = formatErrorCause(getErrorCause(error));

  try {
    const proxy = await session.defaultSession.resolveProxy(url);
    logger.warn('Electron fetch failed', {
      target,
      proxy: proxy.trim() || 'DIRECT',
      errorName: getErrorName(error),
      error: getErrorMessage(error),
      errorCode: getErrorCode(error),
      cause,
    });
  } catch (proxyError) {
    logger.warn('Electron fetch failed and proxy diagnostics failed', {
      target,
      errorName: getErrorName(error),
      error: getErrorMessage(error),
      errorCode: getErrorCode(error),
      cause,
      proxyError: getErrorMessage(proxyError),
    });
  }
}

export async function mainProcessFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await session.defaultSession.fetch(url, init);
  } catch (error) {
    await logProxyDiagnostics(url, error);

    if (isAbortError(error)) {
      throw error;
    }

    throw new ElectronNetworkRequestError(`Electron fetch failed: ${formatNetworkErrorMessage(error)}`, error);
  }
}
