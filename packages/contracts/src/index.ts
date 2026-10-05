import { z } from 'zod';

// Foundation contract only. It deliberately advertises no usable notes protocol.
export const healthSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1).max(64),
  mode: z.literal('foundation'),
  storage: z.literal('not_configured'),
});
export type Health = z.infer<typeof healthSchema>;
