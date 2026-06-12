export const DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS = Object.freeze([
  'githubusercontent.com',
  'cloudflarestorage.com',
] as const);

const HOST_LABEL_PATTERN = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const DOMAIN_PATTERN = new RegExp(`^${HOST_LABEL_PATTERN}(?:\\.${HOST_LABEL_PATTERN})+$`, 'i');
const WILDCARD_DOMAIN_PATTERN = new RegExp(`^\\*\\.(${HOST_LABEL_PATTERN}(?:\\.${HOST_LABEL_PATTERN})+)$`, 'i');
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function normalizePort(port: unknown): string | null {
  if (!port) {
    return '';
  }

  const normalizedPort = Number.parseInt(String(port), 10);
  if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
    return null;
  }

  return String(normalizedPort);
}

function isValidIpv4(value: string): boolean {
  if (!IPV4_PATTERN.test(value)) {
    return false;
  }

  return value.split('.').every((segment) => {
    const value = Number.parseInt(segment, 10);
    return value >= 0 && value <= 255;
  });
}

function normalizeHostAndPort(hostname: unknown, port: unknown): string | null {
  const normalizedHostname = String(hostname ?? '').trim().toLowerCase();
  if (!normalizedHostname) {
    return null;
  }

  const normalizedPort = normalizePort(port);
  if (normalizedPort === null) {
    return null;
  }

  const formattedPort = normalizedPort ? `:${normalizedPort}` : '';

  if (normalizedHostname === 'localhost' || isValidIpv4(normalizedHostname) || DOMAIN_PATTERN.test(normalizedHostname)) {
    return `${normalizedHostname}${formattedPort}`;
  }

  const wildcardMatch = normalizedHostname.match(WILDCARD_DOMAIN_PATTERN);
  if (wildcardMatch) {
    return `*.${wildcardMatch[1]}${formattedPort}`;
  }

  return null;
}

export function normalizeTrustedRemoteImageHost(value: unknown): string | null {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.includes('://')) {
    try {
      const parsedUrl = new URL(normalizedValue);
      return normalizeHostAndPort(parsedUrl.hostname, parsedUrl.port);
    } catch {
      return null;
    }
  }

  if (normalizedValue.includes('/')) {
    return null;
  }

  if (normalizedValue.startsWith('*.')) {
    const separatorIndex = normalizedValue.lastIndexOf(':');
    const hasPort = separatorIndex > normalizedValue.lastIndexOf('.');
    const wildcardHostname = hasPort ? normalizedValue.slice(0, separatorIndex) : normalizedValue;
    const wildcardPort = hasPort ? normalizedValue.slice(separatorIndex + 1) : '';
    const normalizedHost = normalizeHostAndPort(wildcardHostname, wildcardPort);
    return normalizedHost?.startsWith('*.') ? normalizedHost : null;
  }

  const separatorIndex = normalizedValue.lastIndexOf(':');
  const hostname = separatorIndex === -1 ? normalizedValue : normalizedValue.slice(0, separatorIndex);
  const port = separatorIndex === -1 ? '' : normalizedValue.slice(separatorIndex + 1);
  return normalizeHostAndPort(hostname, port);
}

export function normalizeTrustedRemoteImageHosts(
  values: unknown,
  fallback: readonly string[] = DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS
): string[] {
  const sourceValues = Array.isArray(values) ? values : fallback;
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of sourceValues) {
    const normalizedHost = normalizeTrustedRemoteImageHost(value);
    if (!normalizedHost || seen.has(normalizedHost)) {
      continue;
    }

    normalized.push(normalizedHost);
    seen.add(normalizedHost);
  }

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS];
}

function splitHostAndPort(hostPattern: string): { hostname: string; port: string } {
  const separatorIndex = hostPattern.lastIndexOf(':');
  if (separatorIndex === -1 || hostPattern.startsWith('*.') && hostPattern.indexOf(':') === -1) {
    return {
      hostname: hostPattern,
      port: '',
    };
  }

  return {
    hostname: hostPattern.slice(0, separatorIndex),
    port: hostPattern.slice(separatorIndex + 1),
  };
}

function matchesTrustedHostPattern(hostname: string, port: string, hostPattern: string): boolean {
  const { hostname: trustedHostname, port: trustedPort } = splitHostAndPort(hostPattern);
  if (trustedPort && trustedPort !== port) {
    return false;
  }

  const targetHost = hostname.toLowerCase();
  const matchPattern = trustedHostname.toLowerCase();

  // 1. 处理通配符模式 (e.g., *.github.com)
  if (matchPattern.startsWith('*.')) {
    const suffix = matchPattern.slice(1); // .github.com
    // 允许子域名，同时也允许主域名本身 (例如 *.github.com 匹配 github.com)
    return targetHost === matchPattern.slice(2) || targetHost.endsWith(suffix);
  }

  // 2. 智能包含模式：填写主域名 github.com，自动信任所有子域名 *.github.com
  return targetHost === matchPattern || targetHost.endsWith('.' + matchPattern);
}

export function isTrustedRemoteImageUrl(
  value: unknown,
  trustedHosts: readonly string[] = DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS
): boolean {
  try {
    const parsedUrl = new URL(String(value ?? ''));
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const port = parsedUrl.port;
    const normalizedHosts = normalizeTrustedRemoteImageHosts(trustedHosts);
    return normalizedHosts.some((hostPattern) => matchesTrustedHostPattern(hostname, port, hostPattern));
  } catch {
    return false;
  }
}
