export const LICENSE_PLANS = {
  FREE: 'free',
  TRIAL: 'trial',
  INSIDER: 'insider',
  PRO: 'pro',
  ULTIMATE: 'ultimate',
  ENTERPRISE: 'enterprise',
} as const satisfies Record<string, string>;

export type LicensePlan = (typeof LICENSE_PLANS)[keyof typeof LICENSE_PLANS];

export const LICENSE_STATUSES = {
  FREE: 'free',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  OFFLINE_GRACE: 'offline_grace',
  SESSION_GRACE: 'session_grace',
  MAX_DEVICES_REACHED: 'max_devices_reached',
  NETWORK_ERROR: 'network_error',
} as const satisfies Record<string, string>;

export type LicenseStatus = (typeof LICENSE_STATUSES)[keyof typeof LICENSE_STATUSES];

export const LICENSE_FEATURES = {
  AI_SOURCES: 'aiSources',
  AI_ASSISTANT: 'aiAssistant',
  RAG: 'rag',
  SYNC: 'sync',
} as const satisfies Record<string, string>;

export type LicensedFeature = (typeof LICENSE_FEATURES)[keyof typeof LICENSE_FEATURES];

export interface LicenseDevice {
  id: string;
  fingerprint: string;
  name: string;
  platform: string | null;
  status: 'active' | 'inactive' | 'revoked' | string;
  activatedAt: string | null;
  lastSeenAt: string | null;
  current: boolean;
}

export interface LicenseState {
  plan: LicensePlan;
  activated: boolean;
  valid: boolean;
  status: LicenseStatus;
  source: 'default' | 'license-api';
  expiresAt: string | null;
  graceExpiresAt: string | null;
  maxDevices: number | null;
  activatedDevices: number;
  currentDeviceId: string | null;
  devices: LicenseDevice[];
  lastValidatedAt: number | null;
  lastHeartbeatAt: number | null;
  lastServerSyncAt: number | null;
  lastDeviceRefreshAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export const DEFAULT_LICENSE_STATE: LicenseState = {
  plan: LICENSE_PLANS.FREE,
  activated: false,
  valid: true,
  status: LICENSE_STATUSES.FREE,
  source: 'default',
  expiresAt: null,
  graceExpiresAt: null,
  maxDevices: null,
  activatedDevices: 0,
  currentDeviceId: null,
  devices: [],
  lastValidatedAt: null,
  lastHeartbeatAt: null,
  lastServerSyncAt: null,
  lastDeviceRefreshAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
};

const LICENSE_ACCESSIBLE_STATUSES = new Set<LicenseStatus>([
  LICENSE_STATUSES.ACTIVE,
  LICENSE_STATUSES.OFFLINE_GRACE,
  LICENSE_STATUSES.SESSION_GRACE,
]);

type PersistedLicensePlan = Exclude<LicensePlan, 'free'>;

export interface PersistedLicenseState {
  version: number;
  encryptedToken: string | null;
  plan: PersistedLicensePlan | null;
  expiresAt: string | null;
  graceExpiresAt: string | null;
  maxDevices: number | null;
  currentDeviceId: string | null;
  devices: LicenseDevice[];
  activatedAt: number | null;
  lastValidatedAt: number | null;
  lastHeartbeatAt: number | null;
  lastServerSyncAt: number | null;
  lastDeviceRefreshAt: number | null;
}

export interface LicenseDevicePayload {
  id: string;
  fingerprint: string;
  name: string;
  platform?: string | null;
  status?: string | null;
  activated_at?: string | null;
  last_seen_at?: string | null;
}

export interface LicenseActivationResponse {
  valid: boolean;
  type: string;
  token: string;
  expires_at: string | null;
  grace_expires_at: string | null;
  max_devices: number;
  current_device_id: string;
  devices: LicenseDevicePayload[];
}

export interface LicenseValidationResponse {
  valid: boolean;
  type: string;
  token?: string;
  expires_at: string | null;
  grace_expires_at: string | null;
  max_devices: number;
  current_device_id: string;
  devices: LicenseDevicePayload[];
}

export interface LicenseDevicesResponse {
  valid?: boolean;
  type?: string;
  token?: string;
  expires_at?: string | null;
  grace_expires_at?: string | null;
  max_devices: number;
  current_device_id: string;
  devices: LicenseDevicePayload[];
}

export type LicenseHeartbeatResponse = Partial<LicenseDevicesResponse>;

export interface LicenseClaimSnapshot {
  plan: LicensePlan | null;
  expiresAt: string | null;
  graceExpiresAt: string | null;
  maxDevices: number;
  currentDeviceId: string | null;
  devices: LicenseDevice[];
}

export interface LicenseApiErrorResponse {
  code?: string;
  message?: string;
}

export const LICENSE_ERROR_CODES = {
  LICENSE_INVALID: 'license_invalid',
  LICENSE_EXPIRED: 'license_expired',
  LICENSE_INACTIVE: 'license_inactive',
  MAX_DEVICES_REACHED: 'max_devices_reached',
  DEVICE_NOT_FOUND: 'device_not_found',
  CANNOT_DEACTIVATE_CURRENT_DEVICE: 'cannot_deactivate_current_device',
  TOO_MANY_REQUESTS: 'too_many_requests',
  NETWORK_TIMEOUT: 'network_timeout',
  NETWORK_ERROR: 'network_error',
  UNKNOWN: 'unknown',
} as const satisfies Record<string, string>;

export type LicenseErrorCode = (typeof LICENSE_ERROR_CODES)[keyof typeof LICENSE_ERROR_CODES];

export const PAID_LICENSE_PLANS = [
  LICENSE_PLANS.TRIAL,
  LICENSE_PLANS.INSIDER,
  LICENSE_PLANS.PRO,
  LICENSE_PLANS.ULTIMATE,
  LICENSE_PLANS.ENTERPRISE,
] as const;

export const PLAN_FEATURES: Record<LicensePlan, Record<LicensedFeature, boolean>> = {
  free: {
    aiSources: false,
    aiAssistant: false,
    rag: false,
    sync: false,
  },
  trial: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
  insider: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
  pro: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
  ultimate: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
  enterprise: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
};

export function isPaidPlan(plan: LicensePlan): boolean {
  return plan !== LICENSE_PLANS.FREE;
}

export function canManageLicense(state: LicenseState): boolean {
  return isPaidPlan(state.plan) && LICENSE_ACCESSIBLE_STATUSES.has(state.status);
}

export function canUseLicensedFeature(state: LicenseState, feature: LicensedFeature): boolean {
  if (!PLAN_FEATURES[state.plan][feature]) {
    return false;
  }

  return LICENSE_ACCESSIBLE_STATUSES.has(state.status);
}
