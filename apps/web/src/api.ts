import { healthSchema } from '@snaptium/contracts';
import type { Health } from '@snaptium/contracts';

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
