import { healthSchema, sessionSchema, loginRequestSchema, bootstrapRequestSchema, apiErrorSchema } from '@snaptium/contracts';
import type { Health, WebSession, LoginRequest, BootstrapRequest } from '@snaptium/contracts';

export async function fetchHealth(signal: AbortSignal): Promise<Health> {
  const response = await fetch('/api/v1/health', {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('health_unavailable');
  const body: unknown = await response.json();
  return healthSchema.parse(body);
}

export class IdentityApiError extends Error {
  constructor(readonly code: 'authentication_rejected' | 'csrf_rejected' | 'invalid_request' | 'throttled' | 'unavailable') {
    super(code);
  }
}
async function requireSuccess(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await readIdentityJson(response);
  const error = apiErrorSchema.parse(body);
  if (response.status === 429) throw new IdentityApiError('throttled');
  if (error.code === 'authentication_rejected' || error.code === 'csrf_rejected' || error.code === 'invalid_request') {
    throw new IdentityApiError(error.code);
  }
  throw new IdentityApiError('unavailable');
}
async function readIdentityJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new IdentityApiError('unavailable');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new IdentityApiError('unavailable'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    return body;
  } finally { reader.releaseLock(); }
}
export async function fetchSession(signal: AbortSignal): Promise<WebSession> {
  const response = await fetch('/api/v1/auth/session', {
    signal, credentials: 'same-origin', redirect: 'error', headers: { Accept: 'application/json' },
  });
  await requireSuccess(response);
  const body = await readIdentityJson(response);
  return sessionSchema.parse(body);
}
async function identityWrite(path: string, body: unknown, signal: AbortSignal, csrf?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Snaptium-Request': 'web-v1' };
  if (csrf !== undefined) headers['X-CSRF-Token'] = csrf;
  const response = await fetch(path, { method: 'POST', signal, credentials: 'same-origin', redirect: 'error', headers, body: JSON.stringify(body) });
  await requireSuccess(response);
  return response;
}
export async function bootstrapAdmin(input: BootstrapRequest, signal: AbortSignal): Promise<void> {
  const parsed = bootstrapRequestSchema.safeParse(input);
  if (!parsed.success) throw new IdentityApiError('invalid_request');
  await identityWrite('/api/v1/auth/bootstrap', parsed.data, signal);
}
export async function loginAccount(input: LoginRequest, signal: AbortSignal): Promise<WebSession> {
  const parsed = loginRequestSchema.safeParse(input);
  if (!parsed.success) throw new IdentityApiError('invalid_request');
  const response = await identityWrite('/api/v1/auth/login', parsed.data, signal);
  const body = await readIdentityJson(response);
  const session = sessionSchema.parse(body);
  if (session.state !== 'authenticated') throw new IdentityApiError('unavailable');
  return session;
}
export async function logoutAccount(csrf: string, signal: AbortSignal): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(csrf)) throw new IdentityApiError('csrf_rejected');
  await identityWrite('/api/v1/auth/logout', {}, signal, csrf);
}
