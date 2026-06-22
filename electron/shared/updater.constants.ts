export const DEFAULT_UPDATE_CHANNEL = 'stable' as const;

export const UPDATE_CHANNEL_TARGETS = {
  stable: 'latest',
  beta: 'beta',
  dev: 'alpha',
} as const;

export type UpdateChannel = keyof typeof UPDATE_CHANNEL_TARGETS;
export type UpdateTargetChannel = (typeof UPDATE_CHANNEL_TARGETS)[UpdateChannel];

export const UPDATE_FEED_BASE_URL = 'https://update.snaptium.com/download' as const;

export function normalizeUpdateChannel(value: unknown): UpdateChannel {
  return typeof value === 'string' && value in UPDATE_CHANNEL_TARGETS
    ? value as UpdateChannel
    : DEFAULT_UPDATE_CHANNEL;
}

export function resolveUpdateTargetChannel(channel: UpdateChannel): UpdateTargetChannel {
  return UPDATE_CHANNEL_TARGETS[channel];
}

export function buildUpdateFeedUrl(channel: UpdateChannel): string {
  return `${UPDATE_FEED_BASE_URL}/${resolveUpdateTargetChannel(channel)}`;
}
export const APP_DISTRIBUTIONS = {
  DIRECT: 'direct',
  MICROSOFT_STORE: 'microsoft-store',
} as const satisfies Record<string, string>;

export type AppDistribution = typeof APP_DISTRIBUTIONS[keyof typeof APP_DISTRIBUTIONS];

type StoreAwareProcess = NodeJS.Process & {
  windowsStore?: boolean;
};

export function getAppDistribution(): AppDistribution {
  const storeAwareProcess = process as StoreAwareProcess;

  if (storeAwareProcess.windowsStore === true) {
    return APP_DISTRIBUTIONS.MICROSOFT_STORE;
  }

  if (process.env.SNAPTIUM_DISTRIBUTION === APP_DISTRIBUTIONS.MICROSOFT_STORE) {
    return APP_DISTRIBUTIONS.MICROSOFT_STORE;
  }

  return APP_DISTRIBUTIONS.DIRECT;
}

export function isMicrosoftStoreDistribution(): boolean {
  return getAppDistribution() === APP_DISTRIBUTIONS.MICROSOFT_STORE;
}

