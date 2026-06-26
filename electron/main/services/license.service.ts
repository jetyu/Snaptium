import { app, safeStorage } from 'electron';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import {
  canUseLicensedFeature,
  DEFAULT_LICENSE_STATE,
  LICENSE_ERROR_CODES,
  LICENSE_FEATURES,
  LICENSE_PLANS,
  LICENSE_STATUSES,
  type LicenseActivationResponse,
  type LicenseApiErrorResponse,
  type LicenseDevice,
  type LicenseDevicePayload,
  type LicenseDevicesResponse,
  type LicenseErrorCode,
  type LicensedFeature,
  type LicenseHeartbeatResponse,
  type LicensePlan,
  type LicenseState,
  type LicenseValidationResponse,
  type PersistedLicenseState,
  PAID_LICENSE_PLANS,
  isPaidPlan,
} from '../../shared/license.constants.js';
import { loggerService } from './logger.service.js';
import { appEnvInfoService } from './appEnvInfo.service.js';

const logger = loggerService.createLogger('Electron:LicenseService');

const API_BASE_URL = (process.env.SNAPTIUM_LICENSE_API_BASE?.trim() || 'https://api.snaptium.com/v1').replace(/\/+$/, '');
const LICENSE_FILE_NAME = 'license.json';
const DEVICE_FILE_NAME = 'license-device.json';
const PERSISTED_STATE_VERSION = 1;
const SERVER_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SERVER_SYNC_RENEWAL_MARGIN_MS = 5 * 60 * 1000;
const DEVICE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const STARTUP_VALIDATE_TIMEOUT_MS = 3_500;
const REQUEST_MAX_RETRIES = 2;
const REQUEST_RETRY_DELAYS_MS = [350, 900] as const;
const FEATURE_REVALIDATION_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface LicenseRequestError extends Error {
  code: LicenseErrorCode | string;
  status: number | null;
  retryable: boolean;
  network: boolean;
  timeout: boolean;
}

interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  force?: boolean;
}

interface LicenseDeviceInfoPayload {
  platform: string;
  platform_version: string;
  os_name: string;
  software_version: string;
  device_mac_hash: string | null;
}

const devicePayloadSchema = z.object({
  id: z.string().min(1),
  fingerprint: z.string().min(1),
  name: z.string().min(1),
  platform: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  activated_at: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
});

const licenseActivationResponseSchema = z.object({
  valid: z.boolean(),
  type: z.string(),
  token: z.string().min(1),
  expires_at: z.string().nullable(),
  grace_expires_at: z.string().nullable(),
  max_devices: z.number().int().nonnegative(),
  current_device_id: z.string().min(1),
  devices: z.array(devicePayloadSchema),
});

const licenseValidationResponseSchema = z.object({
  valid: z.boolean(),
  type: z.string(),
  token: z.string().min(1).optional(),
  expires_at: z.string().nullable(),
  grace_expires_at: z.string().nullable(),
  max_devices: z.number().int().nonnegative(),
  current_device_id: z.string().min(1),
  devices: z.array(devicePayloadSchema),
});

const licenseDevicesResponseSchema = z.object({
  valid: z.boolean().optional(),
  type: z.string().optional(),
  token: z.string().min(1).optional(),
  expires_at: z.string().nullable().optional(),
  grace_expires_at: z.string().nullable().optional(),
  max_devices: z.number().int().nonnegative(),
  current_device_id: z.string().min(1).nullable(),
  devices: z.array(devicePayloadSchema),
});

const licenseHeartbeatResponseSchema = z.object({
  valid: z.boolean().optional(),
  type: z.string().optional(),
  token: z.string().min(1).optional(),
  expires_at: z.string().nullable().optional(),
  grace_expires_at: z.string().nullable().optional(),
  max_devices: z.number().int().nonnegative().optional(),
  current_device_id: z.string().nullable().optional(),
  devices: z.array(devicePayloadSchema).optional(),
});

const persistedStateSchema = z.object({
  version: z.number().int().positive(),
  encryptedToken: z.string().nullable(),
  plan: z.enum(PAID_LICENSE_PLANS).nullable(),
  expiresAt: z.string().nullable(),
  graceExpiresAt: z.string().nullable(),
  maxDevices: z.number().int().nonnegative().nullable(),
  currentDeviceId: z.string().nullable(),
  devices: z.array(z.object({
    id: z.string(),
    fingerprint: z.string(),
    name: z.string(),
    platform: z.string().nullable(),
    status: z.string(),
    activatedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
    current: z.boolean(),
  })),
  activatedAt: z.number().int().nullable(),
  lastValidatedAt: z.number().int().nullable(),
  lastHeartbeatAt: z.number().int().nullable(),
  lastServerSyncAt: z.number().int().nullable().optional(),
  lastDeviceRefreshAt: z.number().int().nullable().optional(),
});

function createLicenseError(
  code: LicenseErrorCode | string,
  message: string,
  extra?: Partial<Omit<LicenseRequestError, 'name' | 'message' | 'code'>>,
): LicenseRequestError {
  const error = new Error(message) as LicenseRequestError;
  error.code = code;
  error.status = extra?.status ?? null;
  error.retryable = extra?.retryable ?? false;
  error.network = extra?.network ?? false;
  error.timeout = extra?.timeout ?? false;
  return error;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return undefined;
}

function parseApiError(value: unknown): LicenseApiErrorResponse {
  if (!isObject(value)) {
    return {};
  }

  const sources: Record<string, unknown>[] = [
    value,
    isObject(value.error) ? value.error : null,
    isObject(value.data) ? value.data : null,
    isObject(value.details) ? value.details : null,
  ].filter((candidate): candidate is Record<string, unknown> => candidate !== null);

  for (const source of sources) {
    const code = getStringField(source, ['code', 'error_code']);
    const message = getStringField(source, ['message', 'detail', 'msg', 'error_description', 'description', 'reason']);
    if (code || message) {
      return { code, message };
    }
  }

  return {
    message: typeof value.error === 'string' ? value.error : undefined,
  };
}

function parseJsonResponseBody(text: string): unknown {
  const normalized = text.trim();
  if (!normalized) {
    return {};
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    return {};
  }
}

function normalizePlan(value: string): LicensePlan | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === LICENSE_PLANS.FREE) return LICENSE_PLANS.FREE;
  if (normalized === LICENSE_PLANS.TRIAL) return LICENSE_PLANS.TRIAL;
  if (normalized === LICENSE_PLANS.INSIDER) return LICENSE_PLANS.INSIDER;
  if (normalized === LICENSE_PLANS.PRO) return LICENSE_PLANS.PRO;
  if (normalized === LICENSE_PLANS.ULTIMATE) return LICENSE_PLANS.ULTIMATE;
  if (normalized === LICENSE_PLANS.ENTERPRISE) return LICENSE_PLANS.ENTERPRISE;
  return null;
}

function normalizeLicenseKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeMessage(message: string, fallback: string): string {
  const value = message.trim();
  return value.length > 0 ? value : fallback;
}


function isDateInFuture(value: string | null): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function normalizeMacAddress(mac: string): string | null {
  const normalized = mac.trim().toLowerCase();
  if (!normalized || normalized === '00:00:00:00:00:00') {
    return null;
  }
  return /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/.test(normalized) ? normalized : null;
}

function cloneState(state: LicenseState): LicenseState {
  return {
    ...state,
    devices: state.devices.map((device) => ({ ...device })),
  };
}

function mapDevicePayload(payload: LicenseDevicePayload, currentDeviceId: string | null): LicenseDevice {
  return {
    id: payload.id,
    fingerprint: payload.fingerprint,
    name: payload.name,
    platform: payload.platform ?? null,
    status: payload.status ?? 'active',
    activatedAt: payload.activated_at ?? null,
    lastSeenAt: payload.last_seen_at ?? null,
    current: currentDeviceId !== null && payload.id === currentDeviceId,
  };
}

export class LicenseService {
  private state: LicenseState = { ...DEFAULT_LICENSE_STATE };
  private token: string | null = null;
  private deviceFingerprint: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private featureRevalidationPromise: Promise<LicenseState> | null = null;
  private listeners = new Set<(state: LicenseState) => void>();
  private warnedPlaintextFallback = false;

  async initialize(): Promise<void> {
    logger.info('Initializing license service');
    await this.loadDeviceFingerprint();
    await this.loadPersistedState();

    if (!this.token) {
      this.notifyStateChange();
      return;
    }

    if (this.isServerSyncFresh()) {
      this.notifyStateChange();
      this.startHeartbeatIfNeeded();
      return;
    }

    await this.validateLicense({ timeoutMs: STARTUP_VALIDATE_TIMEOUT_MS, force: true });
    this.startHeartbeatIfNeeded(SERVER_SYNC_INTERVAL_MS);
  }

  destroy(): void {
    this.stopHeartbeat();
    this.listeners.clear();
  }

  getState(): LicenseState {
    return cloneState(this.state);
  }

  canUse(feature: LicensedFeature): boolean {
    this.maybeTriggerFeatureRevalidation();
    return canUseLicensedFeature(this.state, feature);
  }

  ensureFeatureEnabled(feature: LicensedFeature): void {
    if (this.canUse(feature)) {
      return;
    }

    throw createLicenseError(
      LICENSE_ERROR_CODES.LICENSE_INACTIVE,
      `Feature "${feature}" requires an active paid license.`,
    );
  }

  async activate(licenseKey: string): Promise<LicenseState> {
    const normalizedKey = normalizeLicenseKey(licenseKey);
    if (!normalizedKey) {
      throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'License key is required.');
    }

    const deviceFingerprint = this.requireDeviceFingerprint();
    try {
      const payload = {
        license_key: normalizedKey,
        device_fingerprint: deviceFingerprint,
        device_name: sanitizeMessage(os.hostname(), `${appEnvInfoService.getAppName()} Device`),
        ...this.getDeviceInfoPayload(),
      };

      const response = await this.requestJson(
        '/license/activate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        licenseActivationResponseSchema,
      );

      const data = response as LicenseActivationResponse;
      const plan = this.resolvePlanOrThrow(data.type);
      if (!isPaidPlan(plan)) {
        throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'Activation response does not contain a paid license type.');
      }
      if (!data.valid) {
        throw createLicenseError(LICENSE_ERROR_CODES.LICENSE_INVALID, 'License is not valid.');
      }

      this.token = data.token;
      this.applyLicenseResponse(data);
      const now = Date.now();
      this.state.status = LICENSE_STATUSES.ACTIVE;
      this.state.activated = true;
      this.state.valid = true;
      this.state.lastValidatedAt = now;
      this.state.lastServerSyncAt = now;
      this.state.lastDeviceRefreshAt = now;
      this.state.lastErrorCode = null;
      this.state.lastErrorMessage = null;
      await this.savePersistedState();
      this.startHeartbeatIfNeeded();
      this.notifyStateChange();
      return this.getState();
    } catch (error) {
      const normalizedError = this.normalizeRequestError(error, 'License activation failed');
      this.state.lastErrorCode = String(normalizedError.code);
      this.state.lastErrorMessage = normalizedError.message;
      if (normalizedError.code === LICENSE_ERROR_CODES.MAX_DEVICES_REACHED) {
        this.state.status = LICENSE_STATUSES.MAX_DEVICES_REACHED;
      } else if (normalizedError.code === LICENSE_ERROR_CODES.LICENSE_EXPIRED) {
        this.state.status = LICENSE_STATUSES.EXPIRED;
      } else {
        this.state.status = LICENSE_STATUSES.INVALID;
      }
      this.notifyStateChange();
      throw normalizedError;
    }
  }

  async validateLicense(options?: RequestOptions): Promise<LicenseState> {
    if (!this.token) {
      return this.getState();
    }

    if (!options?.force && this.isServerSyncFresh()) {
      return this.getState();
    }

    const deviceFingerprint = this.requireDeviceFingerprint();
    try {
      const response = await this.requestJson(
        '/license/validate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            device_fingerprint: deviceFingerprint,
          }),
        },
        licenseValidationResponseSchema,
        options,
      );

      const data = response as LicenseValidationResponse;
      this.applyIssuedToken(data);
      this.applyLicenseResponse(data);
      const now = Date.now();
      this.state.lastValidatedAt = now;
      this.state.lastServerSyncAt = now;
      this.state.lastDeviceRefreshAt = now;
      this.state.lastErrorCode = null;
      this.state.lastErrorMessage = null;

      if (data.valid) {
        this.state.status = LICENSE_STATUSES.ACTIVE;
        this.state.activated = true;
        this.state.valid = true;
      } else if (isDateInFuture(data.grace_expires_at)) {
        this.state.status = LICENSE_STATUSES.SESSION_GRACE;
        this.state.activated = true;
        this.state.valid = true;
      } else {
        await this.clearLicenseInternal(LICENSE_STATUSES.EXPIRED, {
          lastErrorCode: LICENSE_ERROR_CODES.LICENSE_EXPIRED,
          lastErrorMessage: 'License expired.',
        });
        return this.getState();
      }

      await this.savePersistedState();
      this.startHeartbeatIfNeeded();
      this.notifyStateChange();
      return this.getState();
    } catch (error) {
      const normalizedError = this.normalizeRequestError(error, 'License validation failed');
      const nextState = await this.handleValidationError(normalizedError);
      this.notifyStateChange();
      return nextState;
    }
  }

  async refreshDevices(options?: RequestOptions): Promise<LicenseState> {
    if (!this.token) {
      return this.getState();
    }

    if (!options?.force && this.isDeviceRefreshFresh()) {
      return this.getState();
    }

    const deviceFingerprint = this.requireDeviceFingerprint();
    try {
      const response = await this.requestJson(
        '/license/devices',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            device_fingerprint: deviceFingerprint,
          }),
        },
        licenseDevicesResponseSchema,
        options,
      );

      const data = response as LicenseDevicesResponse;
      this.applyDevicesSnapshot(data);
      this.applyIssuedToken(data);
      const now = Date.now();
      this.state.lastDeviceRefreshAt = now;
      if (typeof data.valid === 'boolean') {
        this.state.lastValidatedAt = now;
        this.state.lastServerSyncAt = now;
      }
      this.state.lastErrorCode = null;
      this.state.lastErrorMessage = null;
      await this.savePersistedState();
      this.notifyStateChange();
      return this.getState();
    } catch (error) {
      const normalizedError = this.normalizeRequestError(error, 'Refresh devices failed');
      if (normalizedError.status === 404) {
        return await this.validateLicense({ force: true });
      }

      if (normalizedError.code === LICENSE_ERROR_CODES.LICENSE_INVALID || normalizedError.code === LICENSE_ERROR_CODES.LICENSE_INACTIVE) {
        await this.clearLicenseInternal(LICENSE_STATUSES.INVALID, {
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
        });
        this.notifyStateChange();
        return this.getState();
      }

      this.state.lastErrorCode = String(normalizedError.code);
      this.state.lastErrorMessage = normalizedError.message;
      this.notifyStateChange();
      return this.getState();
    }
  }

  async deactivateDevice(deviceId: string): Promise<LicenseState> {
    if (!this.token) {
      return this.getState();
    }

    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId) {
      throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'Device ID is required.');
    }
    const isCurrentDevice = normalizedDeviceId === this.state.currentDeviceId;

    if (normalizedDeviceId === this.state.currentDeviceId) {
      throw createLicenseError(
        LICENSE_ERROR_CODES.CANNOT_DEACTIVATE_CURRENT_DEVICE,
        'Cannot deactivate current device from remote device management.',
      );
    }

    try {
      const response = await this.requestJson(
        '/license/deactivate-device',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ device_id: normalizedDeviceId }),
        },
        licenseDevicesResponseSchema,
      );

      const data = response as LicenseDevicesResponse;
      if (isCurrentDevice) {
        await this.clearLicenseInternal(LICENSE_STATUSES.FREE, {
          lastErrorCode: null,
          lastErrorMessage: null,
        });
        this.notifyStateChange();
        return this.getState();
      }

      this.applyDevicesSnapshot(data);
      this.applyIssuedToken(data);
      this.state.lastErrorCode = null;
      this.state.lastErrorMessage = null;
      await this.savePersistedState();
      this.notifyStateChange();
      return this.getState();
    } catch (error) {
      const normalizedError = this.normalizeRequestError(error, 'Deactivate device failed');
      if (
        normalizedError.code === LICENSE_ERROR_CODES.LICENSE_INVALID
        || normalizedError.code === LICENSE_ERROR_CODES.LICENSE_EXPIRED
        || normalizedError.code === LICENSE_ERROR_CODES.LICENSE_INACTIVE
      ) {
        await this.clearLicenseInternal(LICENSE_STATUSES.INVALID, {
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
        });
        this.notifyStateChange();
        return this.getState();
      }

      throw normalizedError;
    }
  }

  async clearLicense(): Promise<LicenseState> {
    await this.clearLicenseInternal(LICENSE_STATUSES.FREE, {
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    this.notifyStateChange();
    return this.getState();
  }

  addStateChangeListener(callback: (state: LicenseState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyStateChange(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        logger.warn('License listener execution failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async requestJson<T>(
    route: string,
    init: RequestInit,
    schema: z.ZodSchema<T>,
    options?: RequestOptions,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? REQUEST_MAX_RETRIES;

    let attempt = 0;
    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${API_BASE_URL}${route}`, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const responseText = await response.text();
          const body = parseJsonResponseBody(responseText);
          const errorPayload = parseApiError(body);
          const errorMessage = sanitizeMessage(
            errorPayload.message ?? '',
            sanitizeMessage(responseText, `HTTP ${response.status}`),
          );
          const mappedCode = this.mapHttpErrorCode(route, response.status, errorPayload.code, errorMessage);
          throw createLicenseError(
            mappedCode,
            errorMessage,
            {
              status: response.status,
              retryable: false,
              network: false,
              timeout: false,
            },
          );
        }

        const payload = await response.json();
        return schema.parse(payload);
      } catch (error) {
        clearTimeout(timer);
        const normalizedError = this.normalizeRequestError(error, 'License API request failed');
        if (!normalizedError.retryable || attempt >= maxRetries) {
          throw normalizedError;
        }

        const delayMs = REQUEST_RETRY_DELAYS_MS[Math.min(attempt, REQUEST_RETRY_DELAYS_MS.length - 1)];
        await delay(delayMs);
        attempt += 1;
      }
    }

    throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'License API request failed after retries.');
  }

  private normalizeRequestError(error: unknown, fallbackMessage: string): LicenseRequestError {
    if (isObject(error) && typeof error.code === 'string' && typeof error.message === 'string' && 'retryable' in error) {
      const candidate = error as Partial<LicenseRequestError>;
      return createLicenseError(
        candidate.code ?? LICENSE_ERROR_CODES.UNKNOWN,
        sanitizeMessage(candidate.message ?? '', fallbackMessage),
        {
          status: typeof candidate.status === 'number' ? candidate.status : null,
          retryable: candidate.retryable === true,
          network: candidate.network === true,
          timeout: candidate.timeout === true,
        },
      );
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return createLicenseError(
        LICENSE_ERROR_CODES.NETWORK_TIMEOUT,
        'License request timed out.',
        {
          status: null,
          retryable: true,
          network: true,
          timeout: true,
        },
      );
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return createLicenseError(
        LICENSE_ERROR_CODES.NETWORK_TIMEOUT,
        'License request timed out.',
        {
          status: null,
          retryable: true,
          network: true,
          timeout: true,
        },
      );
    }

    if (error instanceof Error && error.message.includes('fetch')) {
      return createLicenseError(
        LICENSE_ERROR_CODES.NETWORK_ERROR,
        sanitizeMessage(error.message, fallbackMessage),
        {
          status: null,
          retryable: true,
          network: true,
          timeout: false,
        },
      );
    }

    if (error instanceof z.ZodError) {
      return createLicenseError(
        LICENSE_ERROR_CODES.UNKNOWN,
        `Invalid license API response: ${error.message}`,
      );
    }

    if (error instanceof Error) {
      return createLicenseError(
        LICENSE_ERROR_CODES.UNKNOWN,
        sanitizeMessage(error.message, fallbackMessage),
      );
    }

    return createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, fallbackMessage);
  }

  private mapHttpErrorCode(
    route: string,
    status: number,
    serverCode?: string,
  ): LicenseErrorCode | string {
    if (serverCode && serverCode.trim().length > 0 && serverCode.trim() !== LICENSE_ERROR_CODES.UNKNOWN) {
      return serverCode.trim();
    }


    if (serverCode && serverCode.trim().length > 0) {
      return serverCode.trim();
    }

    if ((status === 400 || status === 422) && route === '/license/activate') return LICENSE_ERROR_CODES.LICENSE_INVALID;
    if ((status === 400 || status === 422) && route === '/license/validate') return LICENSE_ERROR_CODES.LICENSE_INVALID;
    if (status === 401) return LICENSE_ERROR_CODES.LICENSE_INVALID;
    if (status === 403) return LICENSE_ERROR_CODES.LICENSE_INVALID;
    if (status === 404 && route === '/license/deactivate-device') return LICENSE_ERROR_CODES.DEVICE_NOT_FOUND;
    if (status === 409) return LICENSE_ERROR_CODES.MAX_DEVICES_REACHED;
    if (status === 429) return LICENSE_ERROR_CODES.TOO_MANY_REQUESTS;
    return LICENSE_ERROR_CODES.UNKNOWN;
  }

  private resolvePlanOrThrow(type: string): LicensePlan {
    const plan = normalizePlan(type);
    if (!plan) {
      throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'License response does not include a recognizable plan type.');
    }

    return plan;
  }

  private applyIssuedToken(response: { token?: string }): void {
    if (typeof response.token === 'string' && response.token.trim().length > 0) {
      this.token = response.token;
    }
  }

  private applyLicenseResponse(
    response: LicenseActivationResponse | LicenseValidationResponse,
  ): void {
    const plan = this.resolvePlanOrThrow(response.type);
    if (!isPaidPlan(plan)) {
      throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'License type must be a paid plan for activated users.');
    }

    this.state.plan = plan;
    this.state.source = 'license-api';
    this.state.expiresAt = response.expires_at;
    this.state.graceExpiresAt = response.grace_expires_at;
    this.state.maxDevices = response.max_devices;
    this.state.currentDeviceId = response.current_device_id;
    this.state.devices = response.devices
      .map((item) => this.mapDevice(item, response.current_device_id))
      .filter((device) => device.status === 'active');
    this.state.activatedDevices = this.state.devices.length;
    this.state.status = response.valid ? LICENSE_STATUSES.ACTIVE : LICENSE_STATUSES.EXPIRED;
  }

  private applyDevicesSnapshot(response: LicenseDevicesResponse): void {
    this.state.source = 'license-api';

    if (typeof response.type === 'string') {
      const plan = normalizePlan(response.type);
      if (plan && isPaidPlan(plan)) {
        this.state.plan = plan;
      }
    }

    if (response.expires_at !== undefined) {
      this.state.expiresAt = response.expires_at;
    }
    if (response.grace_expires_at !== undefined) {
      this.state.graceExpiresAt = response.grace_expires_at;
    }

    this.state.maxDevices = response.max_devices;
    this.state.currentDeviceId = response.current_device_id;
    this.state.devices = response.devices
      .map((item) => this.mapDevice(item, response.current_device_id))
      .filter((device) => device.status === 'active');
    this.state.activatedDevices = this.state.devices.length;

    if (typeof response.valid === 'boolean') {
      this.applySnapshotValidity(response.valid);
    }
  }

  private applySnapshotValidity(valid: boolean): void {
    if (valid) {
      this.state.status = LICENSE_STATUSES.ACTIVE;
      this.state.valid = true;
      this.state.activated = true;
      return;
    }

    if (isDateInFuture(this.state.graceExpiresAt)) {
      this.state.status = LICENSE_STATUSES.SESSION_GRACE;
      this.state.valid = true;
      this.state.activated = true;
      return;
    }

    this.state.status = LICENSE_STATUSES.EXPIRED;
    this.state.valid = false;
    this.state.activated = false;
  }

  private mapDevice(payload: LicenseDevicePayload, currentDeviceId: string | null): LicenseDevice {
    return mapDevicePayload(payload, currentDeviceId);
  }

  private async handleValidationError(error: LicenseRequestError): Promise<LicenseState> {
    this.state.lastErrorCode = String(error.code);
    this.state.lastErrorMessage = error.message;

    if (error.code === LICENSE_ERROR_CODES.TOO_MANY_REQUESTS) {
      return this.getState();
    }

    if (error.code === LICENSE_ERROR_CODES.LICENSE_INVALID || error.code === LICENSE_ERROR_CODES.LICENSE_INACTIVE) {
      await this.clearLicenseInternal(LICENSE_STATUSES.INVALID, {
        lastErrorCode: String(error.code),
        lastErrorMessage: error.message,
      });
      return this.getState();
    }

    if (error.code === LICENSE_ERROR_CODES.LICENSE_EXPIRED) {
      if (isDateInFuture(this.state.graceExpiresAt)) {
        this.state.status = LICENSE_STATUSES.SESSION_GRACE;
        this.state.valid = true;
        this.state.activated = true;
        await this.savePersistedState();
        return this.getState();
      }

      await this.clearLicenseInternal(LICENSE_STATUSES.EXPIRED, {
        lastErrorCode: String(error.code),
        lastErrorMessage: error.message,
      });
      return this.getState();
    }

    if (error.network || error.timeout) {
      if (isDateInFuture(this.state.graceExpiresAt) || isDateInFuture(this.state.expiresAt)) {
        this.state.status = LICENSE_STATUSES.OFFLINE_GRACE;
        this.state.valid = true;
        this.state.activated = true;
      } else {
        this.state.status = LICENSE_STATUSES.NETWORK_ERROR;
        this.state.valid = false;
      }

      return this.getState();
    }

    if (
      this.token
      && isPaidPlan(this.state.plan)
      && (
        this.state.status === LICENSE_STATUSES.ACTIVE
        || this.state.status === LICENSE_STATUSES.OFFLINE_GRACE
        || this.state.status === LICENSE_STATUSES.SESSION_GRACE
      )
    ) {
      logger.warn('Preserving active license state after unexpected validation failure', {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      this.state.valid = true;
      this.state.activated = true;
      return this.getState();
    }

    this.state.status = LICENSE_STATUSES.INVALID;
    this.state.valid = false;
    this.state.activated = false;
    return this.getState();
  }

  private isTimestampFresh(value: number | null, maxAgeMs: number): boolean {
    if (!value) {
      return false;
    }

    const ageMs = Date.now() - value;
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMs;
  }

  private isServerSyncFresh(): boolean {
    return this.isTimestampFresh(this.state.lastServerSyncAt, SERVER_SYNC_INTERVAL_MS - SERVER_SYNC_RENEWAL_MARGIN_MS);
  }

  private shouldRevalidateForFeatureAccess(): boolean {
    if (!this.token || !isPaidPlan(this.state.plan)) {
      return false;
    }

    if (
      this.state.status !== LICENSE_STATUSES.ACTIVE
      && this.state.status !== LICENSE_STATUSES.OFFLINE_GRACE
      && this.state.status !== LICENSE_STATUSES.SESSION_GRACE
    ) {
      return false;
    }

    return !this.isTimestampFresh(this.state.lastServerSyncAt, FEATURE_REVALIDATION_INTERVAL_MS);
  }

  private maybeTriggerFeatureRevalidation(): void {
    if (this.featureRevalidationPromise || !this.shouldRevalidateForFeatureAccess()) {
      return;
    }

    this.featureRevalidationPromise = this.validateLicense({
      force: true,
      maxRetries: 0,
      timeoutMs: STARTUP_VALIDATE_TIMEOUT_MS,
    })
      .catch((error: unknown) => {
        logger.warn('Feature access license revalidation failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      })
      .finally(() => {
        this.featureRevalidationPromise = null;
      });
  }

  private isDeviceRefreshFresh(): boolean {
    return this.isTimestampFresh(this.state.lastDeviceRefreshAt, DEVICE_REFRESH_COOLDOWN_MS);
  }

  private getNextServerSyncDelay(): number {
    if (!this.state.lastServerSyncAt) {
      return 0;
    }

    const elapsedMs = Date.now() - this.state.lastServerSyncAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      return SERVER_SYNC_INTERVAL_MS;
    }

    return Math.max(0, SERVER_SYNC_INTERVAL_MS - SERVER_SYNC_RENEWAL_MARGIN_MS - elapsedMs);
  }

  private startHeartbeatIfNeeded(minimumDelayMs = 0): void {
    this.stopHeartbeat();

    if (!this.token || !isPaidPlan(this.state.plan)) {
      return;
    }

    if (
      this.state.status !== LICENSE_STATUSES.ACTIVE
      && this.state.status !== LICENSE_STATUSES.OFFLINE_GRACE
      && this.state.status !== LICENSE_STATUSES.SESSION_GRACE
    ) {
      return;
    }

    const delayMs = Math.max(this.getNextServerSyncDelay(), minimumDelayMs);
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      void this.sendHeartbeat();
    }, delayMs);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.token) {
      return;
    }

    const deviceFingerprint = this.requireDeviceFingerprint();
    try {
      const response = await this.requestJson(
        '/license/heartbeat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            device_fingerprint: deviceFingerprint,
            ...this.getDeviceInfoPayload(),
          }),
        },
        licenseHeartbeatResponseSchema,
        {
          timeoutMs: REQUEST_TIMEOUT_MS,
          maxRetries: 1,
        },
      );

      const data = response as LicenseHeartbeatResponse;
      this.applyIssuedToken(data);
      const now = Date.now();
      this.state.lastHeartbeatAt = now;
      this.state.lastServerSyncAt = now;

      if (Array.isArray(data.devices) && data.max_devices !== undefined && typeof data.current_device_id === 'string') {
        this.applyDevicesSnapshot({
          max_devices: data.max_devices,
          current_device_id: data.current_device_id,
          devices: data.devices,
          type: data.type,
          valid: data.valid,
          expires_at: data.expires_at,
          grace_expires_at: data.grace_expires_at,
        });
        this.state.lastDeviceRefreshAt = now;
      }

      await this.savePersistedState();
      this.notifyStateChange();
    } catch (error) {
      const normalizedError = this.normalizeRequestError(error, 'License heartbeat failed');
      logger.warn('License heartbeat request failed', {
        code: normalizedError.code,
        status: normalizedError.status,
      });
    } finally {
      this.startHeartbeatIfNeeded(SERVER_SYNC_INTERVAL_MS);
    }
  }

  private async loadDeviceFingerprint(): Promise<void> {
    const filePath = path.join(app.getPath('userData'), DEVICE_FILE_NAME);
    let installationUuid: string;
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content) as { installationUuid?: unknown };
      if (typeof parsed.installationUuid === 'string' && parsed.installationUuid.trim().length > 0) {
        installationUuid = parsed.installationUuid.trim();
      } else {
        throw new Error('Invalid installation UUID in device file.');
      }
    } catch {
      installationUuid = crypto.randomUUID();
      await fs.writeFile(filePath, JSON.stringify({ installationUuid }, null, 2), 'utf8');
    }

    this.deviceFingerprint = crypto
      .createHash('sha256')
      .update(`${appEnvInfoService.getAppName()}-${process.platform}-${installationUuid}`)
      .digest('hex');
  }

  private getDeviceInfoPayload(): LicenseDeviceInfoPayload {
    return {
      platform: process.platform,
      platform_version: os.release(),
      os_name: os.version(),
      software_version: appEnvInfoService.getAppVersion(),
      device_mac_hash: this.getDeviceMacHash(),
    };
  }

  private getDeviceMacHash(): string | null {
    const macAddresses = Object.values(os.networkInterfaces())
      .flatMap((items) => items ?? [])
      .filter((item) => !item.internal)
      .map((item) => normalizeMacAddress(item.mac))
      .filter((mac): mac is string => mac !== null)
      .sort();

    if (macAddresses.length === 0) {
      return null;
    }

    return crypto
      .createHash('sha256')
      .update(macAddresses.join('|'))
      .digest('hex');
  }

  private async loadPersistedState(): Promise<void> {
    const filePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = persistedStateSchema.parse(JSON.parse(content));

      if (parsed.encryptedToken) {
        try {
          if (safeStorage.isEncryptionAvailable()) {
            this.token = safeStorage.decryptString(Buffer.from(parsed.encryptedToken, 'base64'));
          } else {
            this.token = parsed.encryptedToken;
            this.logPlaintextStorageWarning();
          }
        } catch (error) {
          logger.warn('Failed to decrypt local license token', {
            message: error instanceof Error ? error.message : String(error),
          });
          this.token = null;
        }
      }

      const plan = parsed.plan ?? LICENSE_PLANS.FREE;
      const lastServerSyncAt = parsed.lastServerSyncAt ?? parsed.lastValidatedAt ?? parsed.lastHeartbeatAt;
      const lastDeviceRefreshAt = parsed.lastDeviceRefreshAt ?? parsed.lastValidatedAt ?? parsed.lastHeartbeatAt;
      this.state = {
        ...this.state,
        plan,
        activated: Boolean(this.token && isPaidPlan(plan)),
        valid: Boolean(this.token && isPaidPlan(plan)),
        status: this.token && isPaidPlan(plan) ? LICENSE_STATUSES.OFFLINE_GRACE : LICENSE_STATUSES.FREE,
        source: this.token ? 'license-api' : 'default',
        expiresAt: parsed.expiresAt,
        graceExpiresAt: parsed.graceExpiresAt,
        maxDevices: parsed.maxDevices,
        currentDeviceId: parsed.currentDeviceId,
        devices: parsed.devices.filter((device) => device.status === 'active'),
        activatedDevices: parsed.devices.filter((device) => device.status === 'active').length,
        lastValidatedAt: parsed.lastValidatedAt,
        lastHeartbeatAt: parsed.lastHeartbeatAt,
        lastServerSyncAt,
        lastDeviceRefreshAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
    } catch {
      this.token = null;
      this.state = {
        ...DEFAULT_LICENSE_STATE,
      };
    }
  }

  private async savePersistedState(): Promise<void> {
    const filePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);
    let encryptedToken: string | null = null;

    if (this.token) {
      if (safeStorage.isEncryptionAvailable()) {
        encryptedToken = safeStorage.encryptString(this.token).toString('base64');
      } else {
        encryptedToken = this.token;
        this.logPlaintextStorageWarning();
      }
    }

    const persistedState: PersistedLicenseState = {
      version: PERSISTED_STATE_VERSION,
      encryptedToken,
      plan: this.state.plan === LICENSE_PLANS.FREE ? null : this.state.plan,
      expiresAt: this.state.expiresAt,
      graceExpiresAt: this.state.graceExpiresAt,
      maxDevices: this.state.maxDevices,
      currentDeviceId: this.state.currentDeviceId,
      devices: this.state.devices,
      activatedAt: this.state.lastValidatedAt,
      lastValidatedAt: this.state.lastValidatedAt,
      lastHeartbeatAt: this.state.lastHeartbeatAt,
      lastServerSyncAt: this.state.lastServerSyncAt,
      lastDeviceRefreshAt: this.state.lastDeviceRefreshAt,
    };

    await fs.writeFile(filePath, JSON.stringify(persistedState, null, 2), 'utf8');
  }

  private async clearLicenseInternal(
    status: LicenseState['status'],
    options?: {
      lastErrorCode?: string | null;
      lastErrorMessage?: string | null;
    },
  ): Promise<void> {
    this.token = null;
    this.stopHeartbeat();
    this.state = {
      ...DEFAULT_LICENSE_STATE,
      status,
      lastErrorCode: options?.lastErrorCode ?? null,
      lastErrorMessage: options?.lastErrorMessage ?? null,
    };
    await this.savePersistedState();
  }

  private requireDeviceFingerprint(): string {
    if (!this.deviceFingerprint) {
      throw createLicenseError(LICENSE_ERROR_CODES.UNKNOWN, 'Device fingerprint has not been initialized.');
    }

    return this.deviceFingerprint;
  }

  private logPlaintextStorageWarning(): void {
    if (this.warnedPlaintextFallback) {
      return;
    }

    this.warnedPlaintextFallback = true;
    logger.warn('safeStorage unavailable. License token is stored without OS-level encryption.');
  }
}

export const licenseService = new LicenseService();

export const LICENSE_RUNTIME_FEATURES = {
  AI_SOURCES: LICENSE_FEATURES.AI_SOURCES,
  AI_ASSISTANT: LICENSE_FEATURES.AI_ASSISTANT,
  RAG: LICENSE_FEATURES.RAG,
  SYNC: LICENSE_FEATURES.SYNC,
} as const;

export type LicenseRuntimeFeature = (typeof LICENSE_RUNTIME_FEATURES)[keyof typeof LICENSE_RUNTIME_FEATURES];
