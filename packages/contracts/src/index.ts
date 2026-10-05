import { z } from 'zod';

// Identity readiness does not advertise note persistence or a sync protocol.
export const healthSchema = z.discriminatedUnion('mode', [
  z.object({ status: z.literal('ok'), version: z.string().min(1).max(64), mode: z.literal('foundation'), storage: z.literal('not_configured') }),
  z.object({ status: z.enum(['ok', 'initialization_required']), version: z.string().min(1).max(64), mode: z.literal('identity'), storage: z.literal('ready') }),
]);
export type Health = z.infer<typeof healthSchema>;

const accountId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const csrfToken = z.string().regex(/^[0-9a-f]{64}$/);
export const sessionSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('anonymous'), bootstrapRequired: z.boolean() }),
  z.object({ state: z.literal('authenticated'), account: z.object({ id: accountId, isAdmin: z.boolean() }), csrfToken }),
]);
export type WebSession = z.infer<typeof sessionSchema>;
const login = z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/);
const password = z.string().min(1).refine(value => new TextEncoder().encode(value).byteLength <= 1024);
export const loginRequestSchema = z.object({ login, password }).strict();
export const bootstrapRequestSchema = loginRequestSchema.extend({
  password: password.refine(value => [...value].length >= 15),
  initializationSecret: csrfToken,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export const apiErrorSchema = z.object({
  code: z.enum(['not_found', 'service_unavailable', 'invalid_request', 'authentication_rejected', 'csrf_rejected']),
  requestId: accountId,
});
