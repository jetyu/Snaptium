export const DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS: readonly string[];

export function normalizeTrustedRemoteImageHost(value: unknown): string | null;

export function normalizeTrustedRemoteImageHosts(
  values: unknown,
  fallback?: readonly string[],
): string[];

export function isTrustedRemoteImageUrl(
  value: unknown,
  trustedHosts?: readonly string[],
): boolean;
