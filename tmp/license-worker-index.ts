import { Hono, Context } from "hono";
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";

interface D1Result<T = unknown> {
  results?: T[];
  meta: {
    changes?: number;
    [key: string]: unknown;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  LICENSE_PEPPER: string;
  TOKEN_SECRET: string;
  ADMIN_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  RATE_LIMIT_PER_MIN: string;
}

type EnvCheck = { ok: true } | { ok: false; missing: string[]; invalid: string[] };
type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 429 | 500;

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];
type IssuableLicensePlan = "trial" | "insider" | "pro" | "ultimate" | "enterprise";

type Role = "owner" | "admin" | "support" | "readonly";
const roleRank: Record<Role, number> = { readonly: 1, support: 2, admin: 3, owner: 4 };

type JwtPayload = { uid: string; role: Role; exp: number };
type LicenseToken = { lid: string; did: string; exp: number };

interface LicenseRow {
  id: string;
  license_key_hash: string;
  license_key_plain: string | null;
  plan: string;
  user_channel: string;
  max_devices: number;
  status: "active" | "revoked";
  issued_at: string;
  expires_at: string;
  grace_days: number;
  metadata?: string;
}

interface DeviceRow {
  id: string;
  license_id: string;
  device_fingerprint_hash: string;
  device_name: string | null;
  platform: string | null;
  platform_version: string | null;
  os_name: string | null;
  first_activated_at: string;
  last_seen_at: string;
  last_ip_prefix: string | null;
  status: "active" | "inactive" | "revoked";
}

interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
}

interface LicenseClientDevicePayload {
  id: string;
  fingerprint: string;
  name: string;
  platform: string | null;
  status: string;
  activated_at: string | null;
  last_seen_at: string | null;
}

interface LicenseClientSnapshot {
  valid: boolean;
  type: string;
  expires_at: string | null;
  grace_expires_at: string | null;
  max_devices: number;
  current_device_id: string;
  devices: LicenseClientDevicePayload[];
}

interface LicenseAuthContext {
  tokenPayload: LicenseToken;
  license: LicenseRow;
  currentDevice: DeviceRow;
}

interface SqliteTableInfoRow {
  name?: string;
}

interface NormalizedDevicePlatformInfo {
  platform: string | null;
  platformVersion: string | null;
  osName: string | null;
}

let licenseDeviceSchemaReadyPromise: Promise<void> | null = null;

// --- Base64url and Cryptography Utilities ---

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveEncryptionKey(pepper: string): Promise<CryptoKey> {
  const pepperBuffer = new TextEncoder().encode(pepper);
  const hash = await crypto.subtle.digest("SHA-256", pepperBuffer);
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const packed = new Uint8Array(iv.length + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.length);
  return b64urlEncode(packed);
}

async function decryptText(packedBase64: string, key: CryptoKey): Promise<string> {
  const packed = b64urlDecode(packedBase64);
  if (packed.length < 13) throw new Error("Invalid encrypted payload");
  const iv = packed.slice(0, 12);
  const encrypted = packed.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new TextEncoder().encode(salt);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    256 // 32 bytes (256 bits)
  );
  return [...new Uint8Array(derivedKey)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateRandomSalt(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isWithinExpiry(expires: string, graceDays: number, now: Date): boolean {
  return now.getTime() <= new Date(expires).getTime() + graceDays * 86400000;
}

function createLicenseKey(plan: string): string {
  const normalized = plan.toLowerCase();
  const planPrefix =
    normalized === "trial"
        ? "SNPT"
        : normalized === "insider"
          ? "SNPI"
          : normalized === "pro"
            ? "SNPP"
            : normalized === "ultimate"
              ? "SNPU"
              : normalized === "enterprise"
                ? "SNPE"
                : "SNPI";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomBuffer = new Uint8Array(16);
  crypto.getRandomValues(randomBuffer);
  const part = (offset: number) =>
    Array.from({ length: 4 }, (_, i) => alphabet[randomBuffer[offset + i] % alphabet.length]).join("");
  return `${planPrefix}-${part(0)}-${part(4)}-${part(8)}-${part(12)}`;
}

function ipPrefix(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  if (ip.includes(".")) {
    const p = ip.split(".");
    return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0/24` : ip;
  } else if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}

function normalizeLicenseType(plan: string): string {
  const normalized = String(plan || "").trim().toLowerCase();
  if (
    normalized === "trial"
    || normalized === "insider"
    || normalized === "pro"
    || normalized === "ultimate"
    || normalized === "enterprise"
  ) {
    return normalized;
  }
  return "insider";
}

function normalizeIssuablePlan(rawPlan: unknown): IssuableLicensePlan | null {
  const normalized = String(rawPlan || "").trim().toLowerCase();
  if (!normalized) {
    return "insider";
  }
  if (
    normalized === "trial"
    || normalized === "insider"
    || normalized === "pro"
    || normalized === "ultimate"
    || normalized === "enterprise"
  ) {
    return normalized;
  }
  return null;
}

function getGraceExpiresAt(expiresAt: string, graceDays: number): string | null {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) {
    return null;
  }
  const graceMs = expiresMs + Math.max(0, graceDays) * 86400000;
  return new Date(graceMs).toISOString();
}

function getLicenseTimeState(license: LicenseRow, now: Date): "active" | "grace" | "expired" {
  const expiresMs = new Date(license.expires_at).getTime();
  if (!Number.isFinite(expiresMs)) {
    return "expired";
  }
  if (now.getTime() <= expiresMs) {
    return "active";
  }
  const graceMs = expiresMs + Math.max(0, license.grace_days) * 86400000;
  if (now.getTime() <= graceMs) {
    return "grace";
  }
  return "expired";
}

function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function jsonError(c: Context, status: ErrorStatusCode, code: string, message: string): Response {
  c.status(status);
  return c.json({ code, message });
}

function normalizeOptionalString(value: unknown, maxLength: number = 120): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function normalizePlatformToken(rawPlatform: string | null): string | null {
  if (!rawPlatform) {
    return null;
  }
  const platform = rawPlatform.trim().toLowerCase();
  if (!platform) {
    return null;
  }
  if (platform === "win32" || platform === "windows" || platform === "windows_nt") {
    return "windows";
  }
  if (platform === "darwin" || platform === "mac" || platform === "macos" || platform === "osx") {
    return "macos";
  }
  if (platform === "linux") {
    return "linux";
  }
  if (platform === "android") {
    return "android";
  }
  if (platform === "ios") {
    return "ios";
  }
  return platform.slice(0, 32);
}

function getWindowsBuildNumber(platformVersion: string | null): number | null {
  if (!platformVersion) {
    return null;
  }
  const matches = platformVersion.match(/\d+/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  const build = Number(matches[matches.length - 1]);
  return Number.isFinite(build) ? build : null;
}

function toTitleCaseToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  const parts = normalized.split(/[_\-\s]+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return token;
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveDevicePlatformLabel(
  platform: string | null,
  platformVersion: string | null,
  osName: string | null
): string | null {
  const osNameLabel = normalizeOptionalString(osName, 80);
  if (osNameLabel) {
    return osNameLabel;
  }

  const normalizedPlatform = normalizePlatformToken(platform);
  if (!normalizedPlatform) {
    return null;
  }
  const version = normalizeOptionalString(platformVersion, 80);

  if (normalizedPlatform === "windows") {
    const build = getWindowsBuildNumber(version);
    if (build !== null) {
      return build >= 22000 ? "Windows 11" : "Windows 10";
    }
    return "Windows";
  }
  if (normalizedPlatform === "macos") {
    return version ? `macOS ${version}` : "macOS";
  }
  if (normalizedPlatform === "linux") {
    return version ? `Linux ${version}` : "Linux";
  }
  if (normalizedPlatform === "android") {
    return version ? `Android ${version}` : "Android";
  }
  if (normalizedPlatform === "ios") {
    return version ? `iOS ${version}` : "iOS";
  }
  const fallback = toTitleCaseToken(normalizedPlatform);
  return version ? `${fallback} ${version}` : fallback;
}

function normalizeDevicePlatformInfo(
  rawPlatform: unknown,
  rawPlatformVersion: unknown,
  rawOsName: unknown
): NormalizedDevicePlatformInfo {
  const platform = normalizePlatformToken(normalizeOptionalString(rawPlatform, 64));
  const platformVersion = normalizeOptionalString(rawPlatformVersion, 80);
  const osName = normalizeOptionalString(rawOsName, 80);
  return {
    platform,
    platformVersion,
    osName,
  };
}

async function ensureLicenseDeviceSchema(c: Context): Promise<void> {
  if (!licenseDeviceSchemaReadyPromise) {
    licenseDeviceSchemaReadyPromise = (async () => {
      const tableInfo = (await c.env.DB.prepare("PRAGMA table_info(license_devices)").all()) as D1Result<SqliteTableInfoRow>;
      const existingColumns = new Set(
        (tableInfo.results || [])
          .map((row: SqliteTableInfoRow) => String(row.name || "").trim())
          .filter((name: string) => name.length > 0)
      );
      const missingColumns: string[] = [];
      if (!existingColumns.has("platform")) {
        missingColumns.push("platform");
      }
      if (!existingColumns.has("platform_version")) {
        missingColumns.push("platform_version");
      }
      if (!existingColumns.has("os_name")) {
        missingColumns.push("os_name");
      }
      for (const column of missingColumns) {
        await c.env.DB.prepare(`ALTER TABLE license_devices ADD COLUMN ${column} TEXT`).run();
      }
    })().catch((error: unknown) => {
      licenseDeviceSchemaReadyPromise = null;
      throw error;
    });
  }
  await licenseDeviceSchemaReadyPromise;
}

function mapDeviceRowToClientPayload(device: DeviceRow): LicenseClientDevicePayload {
  return {
    id: device.id,
    fingerprint: device.device_fingerprint_hash,
    name: device.device_name ?? "Unknown Device",
    platform: resolveDevicePlatformLabel(device.platform, device.platform_version, device.os_name),
    status: device.status,
    activated_at: device.first_activated_at ?? null,
    last_seen_at: device.last_seen_at ?? null,
  };
}

async function listActiveDevices(c: Context, licenseId: string): Promise<DeviceRow[]> {
  const result = (await c.env.DB.prepare(
    "SELECT id, license_id, device_fingerprint_hash, device_name, platform, platform_version, os_name, first_activated_at, last_seen_at, last_ip_prefix, status FROM license_devices WHERE license_id = ? AND status = 'active' ORDER BY first_activated_at DESC"
  )
    .bind(licenseId)
    .all()) as D1Result<DeviceRow>;
  return result.results || [];
}

async function findActiveDeviceByFingerprintHash(
  c: Context,
  licenseId: string,
  deviceFingerprintHash: string
): Promise<DeviceRow | null> {
  const row = (await c.env.DB.prepare(
    "SELECT id, license_id, device_fingerprint_hash, device_name, platform, platform_version, os_name, first_activated_at, last_seen_at, last_ip_prefix, status FROM license_devices WHERE license_id = ? AND device_fingerprint_hash = ? AND status = 'active' LIMIT 1"
  )
    .bind(licenseId, deviceFingerprintHash)
    .first()) as DeviceRow | null;
  return row ?? null;
}

async function buildLicenseSnapshot(
  c: Context,
  license: LicenseRow,
  currentDeviceId: string,
  valid: boolean
): Promise<LicenseClientSnapshot> {
  const devices = await listActiveDevices(c, license.id);
  return {
    valid,
    type: normalizeLicenseType(license.plan),
    expires_at: license.expires_at ?? null,
    grace_expires_at: getGraceExpiresAt(license.expires_at, license.grace_days),
    max_devices: Math.max(0, Number(license.max_devices || 0)),
    current_device_id: currentDeviceId,
    devices: devices.map((item) => mapDeviceRowToClientPayload(item)),
  };
}

async function authenticateLicenseToken(c: Context): Promise<LicenseAuthContext | Response> {
  const rawToken = parseBearerToken(c.req.header("authorization"));
  if (!rawToken) {
    return jsonError(c, 401, "invalid_token", "Missing bearer token.");
  }

  let payload: LicenseToken;
  try {
    payload = (await verify(rawToken, c.env.TOKEN_SECRET, "HS256")) as LicenseToken;
  } catch {
    return jsonError(c, 401, "invalid_token", "Invalid or expired token.");
  }

  if (!payload || !payload.lid || !payload.did) {
    return jsonError(c, 401, "invalid_token", "Invalid token payload.");
  }

  const license = (await c.env.DB.prepare("SELECT * FROM licenses WHERE id = ? LIMIT 1")
    .bind(payload.lid)
    .first()) as LicenseRow | null;
  if (!license || license.status !== "active") {
    return jsonError(c, 403, "license_invalid", "License is not active.");
  }

  const currentDevice = await findActiveDeviceByFingerprintHash(c, license.id, payload.did);
  if (!currentDevice) {
    return jsonError(c, 403, "license_invalid", "Current device is not bound.");
  }

  return {
    tokenPayload: payload,
    license,
    currentDevice,
  };
}

// --- Env Validation ---

function validateEnv(env: Env): EnvCheck {
  const required = [
    "LICENSE_PEPPER",
    "TOKEN_SECRET",
    "ADMIN_AUTH_SECRET",
    "CORS_ORIGIN",
    "ACCESS_TOKEN_TTL_SECONDS",
    "RATE_LIMIT_PER_MIN",
  ] as const;
  const missing = required.filter((key) => !String(env[key] || "").trim());

  const invalid: string[] = [];
  const ttl = Number(env.ACCESS_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(ttl) || ttl <= 0) invalid.push("ACCESS_TOKEN_TTL_SECONDS");

  const rpm = Number(env.RATE_LIMIT_PER_MIN);
  if (!Number.isFinite(rpm) || rpm <= 0) invalid.push("RATE_LIMIT_PER_MIN");

  return missing.length || invalid.length ? { ok: false, missing, invalid } : { ok: true };
}

// --- Rate Limiting helper ---

async function checkRateLimit(c: Context, key: string): Promise<boolean> {
  const limit = Number(c.env.RATE_LIMIT_PER_MIN || "20");
  const slot = Math.floor(Date.now() / 60000);
  const k = `rl:${key}:${slot}`;
  try {
    const current = Number((await c.env.RATE_LIMIT_KV.get(k)) || "0");
    if (current >= limit) return false;
    await c.env.RATE_LIMIT_KV.put(k, String(current + 1), { expirationTtl: 70 });
    return true;
  } catch (e) {
    console.error("Rate limit KV error:", e);
    return true; // Fail open to avoid blocking valid traffic if KV is down
  }
}

// --- Audit Log writer ---

async function writeEvent(
  c: Context,
  licenseId: string | null,
  eventType: string,
  actorType: string,
  actorId: string | null,
  payload: JsonValue
) {
  const req = c.req.raw;
  const ua = req.headers.get("user-agent") || "";
  const ip = ipPrefix(req);
  const uaHash = await sha256(ua);

  // Simply allow null as licenseId, now that schema permits it.
  const targetId = licenseId;

  await c.env.DB.prepare(
    "INSERT INTO license_events (id, license_id, event_type, actor_type, actor_id, ip_prefix, user_agent_hash, created_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      crypto.randomUUID(),
      targetId,
      eventType,
      actorType,
      actorId,
      ip,
      uaHash,
      new Date().toISOString(),
      JSON.stringify(payload || {})
    )
    .run();
}

// --- Admin Session Verification ---

async function verifyAdminSession(c: Context): Promise<JwtPayload | null> {
  const authHeader = c.req.header("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = (await verify(token, c.env.TOKEN_SECRET, "HS256")) as JwtPayload;
    if (!payload.uid || !payload.role) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// --- App Handlers ---

const app = new Hono<{ Bindings: Env }>();

// Global CORS configuration
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (origin) {
        try {
          const parsed = new URL(origin);
          if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
            return origin;
          }
        } catch {
          // Ignore invalid origin URL parse failures
        }
      }
      return c.env.CORS_ORIGIN || "*";
    },
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    maxAge: 86400,
    credentials: true,
  })
);

// Global Env check middleware
app.use("*", async (c, next) => {
  const envCheck = validateEnv(c.env);
  if (!envCheck.ok) {
    return c.json(
      { error: "misconfigured_runtime", missing: envCheck.missing, invalid: envCheck.invalid },
      500
    );
  }
  await next();
});

app.use("*", async (c, next) => {
  await ensureLicenseDeviceSchema(c);
  await next();
});

// Global Rate Limiting middleware
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();

  const ip = c.req.header("cf-connecting-ip") || "0.0.0.0";
  const path = c.req.path;
  if (!(await checkRateLimit(c, `${path}:${ip}`))) {
    return c.json({ error: "too_many_requests" }, 429);
  }
  await next();
});

// --- Client Endpoints ---

app.post("/v1/license/activate", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as {
      license_key?: string;
      device_fingerprint?: string;
      device_name?: string;
      platform?: string;
      platform_version?: string;
      os_name?: string;
    };
  } catch {
    return jsonError(c, 400, "invalid_payload", "Invalid JSON payload.");
  }

  const normalizedLicenseKey = String(body.license_key || "").trim();
  const normalizedDeviceFingerprint = String(body.device_fingerprint || "").trim();
  if (!normalizedLicenseKey || !normalizedDeviceFingerprint) {
    return jsonError(c, 400, "invalid_payload", "license_key and device_fingerprint are required.");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const requestIpPrefix = ipPrefix(c.req.raw);
  const licenseHash = await sha256(`${normalizedLicenseKey}:${c.env.LICENSE_PEPPER}`);
  const deviceHash = await sha256(normalizedDeviceFingerprint);

  const license = await c.env.DB.prepare("SELECT * FROM licenses WHERE license_key_hash = ? LIMIT 1")
    .bind(licenseHash)
    .first<LicenseRow>();

  if (!license || license.status !== "active") {
    return jsonError(c, 403, "license_invalid", "License key is invalid.");
  }
  if (!isWithinExpiry(license.expires_at, license.grace_days, now)) {
    return jsonError(c, 403, "license_expired", "License has expired.");
  }

  const existing = await c.env.DB.prepare(
    "SELECT id, license_id, device_fingerprint_hash, device_name, platform, platform_version, os_name, first_activated_at, last_seen_at, last_ip_prefix, status FROM license_devices WHERE license_id = ? AND device_fingerprint_hash = ? LIMIT 1"
  )
    .bind(license.id, deviceHash)
    .first<DeviceRow>();

  const deviceName = String(body.device_name || "").trim() || null;
  const platformInfo = normalizeDevicePlatformInfo(body.platform, body.platform_version, body.os_name);
  const currentDeviceId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    const updateRes = await c.env.DB.prepare(
      `UPDATE license_devices
       SET status = 'active',
           device_name = ?,
           platform = COALESCE(?, platform),
           platform_version = COALESCE(?, platform_version),
           os_name = COALESCE(?, os_name),
           last_seen_at = ?,
           last_ip_prefix = ?
       WHERE id = ? AND license_id = ?
         AND (status = 'active' OR (SELECT COUNT(*) FROM license_devices WHERE license_id = ? AND status = 'active') < ?)`
    )
      .bind(
        deviceName,
        platformInfo.platform,
        platformInfo.platformVersion,
        platformInfo.osName,
        nowIso,
        requestIpPrefix,
        existing.id,
        license.id,
        license.id,
        license.max_devices
      )
      .run();

    if (!updateRes.meta.changes || updateRes.meta.changes === 0) {
      return jsonError(c, 409, "max_devices_reached", "Maximum number of devices reached.");
    }
    if (existing.status !== "active") {
      await writeEvent(c, license.id, "activated", "user", null, { device_name: deviceName });
    }
  } else {
    const insertRes = await c.env.DB.prepare(
      `INSERT INTO license_devices (
         id,
         license_id,
         device_fingerprint_hash,
         device_name,
         platform,
         platform_version,
         os_name,
         first_activated_at,
         last_seen_at,
         last_ip_prefix,
         status
       )
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active'
       WHERE (SELECT COUNT(*) FROM license_devices WHERE license_id = ? AND status = 'active') < ?`
    )
      .bind(
        currentDeviceId,
        license.id,
        deviceHash,
        deviceName,
        platformInfo.platform,
        platformInfo.platformVersion,
        platformInfo.osName,
        nowIso,
        nowIso,
        requestIpPrefix,
        license.id,
        license.max_devices
      )
      .run();

    if (!insertRes.meta.changes || insertRes.meta.changes === 0) {
      return jsonError(c, 409, "max_devices_reached", "Maximum number of devices reached.");
    }
    await writeEvent(c, license.id, "activated", "user", null, { device_name: deviceName });
  }

  const token = await sign(
    {
      lid: license.id,
      did: deviceHash,
      exp: Math.floor(Date.now() / 1000) + Number(c.env.ACCESS_TOKEN_TTL_SECONDS || "86400"),
    },
    c.env.TOKEN_SECRET
  );

  const snapshot = await buildLicenseSnapshot(c, license, currentDeviceId, true);
  return c.json({ ...snapshot, token }, 200);
});

app.post("/v1/license/validate", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as { device_fingerprint?: string };
  } catch {
    return jsonError(c, 400, "invalid_payload", "Invalid JSON payload.");
  }

  const normalizedDeviceFingerprint = String(body.device_fingerprint || "").trim();
  if (!normalizedDeviceFingerprint) {
    return jsonError(c, 400, "invalid_payload", "device_fingerprint is required.");
  }

  const authContext = await authenticateLicenseToken(c);
  if (authContext instanceof Response) {
    return authContext;
  }

  const deviceHash = await sha256(normalizedDeviceFingerprint);
  if (deviceHash !== authContext.tokenPayload.did) {
    return jsonError(c, 401, "device_mismatch", "Device fingerprint mismatch.");
  }

  const now = new Date();
  const timeState = getLicenseTimeState(authContext.license, now);
  if (timeState === "expired") {
    return jsonError(c, 403, "license_expired", "License has expired.");
  }

  const snapshot = await buildLicenseSnapshot(
    c,
    authContext.license,
    authContext.currentDevice.id,
    timeState === "active"
  );
  return c.json(snapshot, 200);
});

app.post("/v1/license/heartbeat", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as {
      device_fingerprint?: string;
      platform?: string;
      platform_version?: string;
      os_name?: string;
    };
  } catch {
    return jsonError(c, 400, "invalid_payload", "Invalid JSON payload.");
  }

  const normalizedDeviceFingerprint = String(body.device_fingerprint || "").trim();
  if (!normalizedDeviceFingerprint) {
    return jsonError(c, 400, "invalid_payload", "device_fingerprint is required.");
  }

  const authContext = await authenticateLicenseToken(c);
  if (authContext instanceof Response) {
    return authContext;
  }

  const deviceHash = await sha256(normalizedDeviceFingerprint);
  if (deviceHash !== authContext.tokenPayload.did) {
    return jsonError(c, 401, "device_mismatch", "Device fingerprint mismatch.");
  }

  const now = new Date();
  const timeState = getLicenseTimeState(authContext.license, now);
  if (timeState === "expired") {
    return jsonError(c, 403, "license_expired", "License has expired.");
  }

  const platformInfo = normalizeDevicePlatformInfo(body.platform, body.platform_version, body.os_name);

  await c.env.DB.prepare(
    `UPDATE license_devices
     SET last_seen_at = ?,
         last_ip_prefix = ?,
         platform = COALESCE(?, platform),
         platform_version = COALESCE(?, platform_version),
         os_name = COALESCE(?, os_name)
     WHERE id = ? AND license_id = ? AND status = 'active'`
  )
    .bind(
      now.toISOString(),
      ipPrefix(c.req.raw),
      platformInfo.platform,
      platformInfo.platformVersion,
      platformInfo.osName,
      authContext.currentDevice.id,
      authContext.license.id
    )
    .run();

  const snapshot = await buildLicenseSnapshot(
    c,
    authContext.license,
    authContext.currentDevice.id,
    timeState === "active"
  );
  return c.json(snapshot, 200);
});

app.post("/v1/license/devices", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as { device_fingerprint?: string };
  } catch {
    return jsonError(c, 400, "invalid_payload", "Invalid JSON payload.");
  }

  const normalizedDeviceFingerprint = String(body.device_fingerprint || "").trim();
  if (!normalizedDeviceFingerprint) {
    return jsonError(c, 400, "invalid_payload", "device_fingerprint is required.");
  }

  const authContext = await authenticateLicenseToken(c);
  if (authContext instanceof Response) {
    return authContext;
  }

  const deviceHash = await sha256(normalizedDeviceFingerprint);
  if (deviceHash !== authContext.tokenPayload.did) {
    return jsonError(c, 401, "device_mismatch", "Device fingerprint mismatch.");
  }

  const timeState = getLicenseTimeState(authContext.license, new Date());
  if (timeState === "expired") {
    return jsonError(c, 403, "license_expired", "License has expired.");
  }

  const snapshot = await buildLicenseSnapshot(
    c,
    authContext.license,
    authContext.currentDevice.id,
    timeState === "active"
  );
  return c.json(snapshot, 200);
});

app.post("/v1/license/deactivate-device", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as { device_id?: string };
  } catch {
    return jsonError(c, 400, "invalid_payload", "Invalid JSON payload.");
  }

  const normalizedDeviceId = String(body.device_id || "").trim();
  if (!normalizedDeviceId) {
    return jsonError(c, 400, "invalid_payload", "device_id is required.");
  }

  const authContext = await authenticateLicenseToken(c);
  if (authContext instanceof Response) {
    return authContext;
  }

  const updateRes = await c.env.DB.prepare(
    "UPDATE license_devices SET status = 'inactive', last_seen_at = ?, last_ip_prefix = ? WHERE id = ? AND license_id = ? AND status = 'active'"
  )
    .bind(new Date().toISOString(), ipPrefix(c.req.raw), normalizedDeviceId, authContext.license.id)
    .run();
  if (!updateRes.meta.changes || updateRes.meta.changes === 0) {
    return jsonError(c, 404, "device_not_found", "Device not found.");
  }

  await writeEvent(c, authContext.license.id, "unbound", "user", null, { device_id: normalizedDeviceId });
  const timeState = getLicenseTimeState(authContext.license, new Date());
  const snapshot = await buildLicenseSnapshot(
    c,
    authContext.license,
    authContext.currentDevice.id,
    timeState === "active"
  );
  return c.json(snapshot, 200);
});

// --- Admin Auth ---

app.post("/v1/admin/auth/login", async (c) => {
  let body;
  try {
    body = (await c.req.json()) as { email?: string; password?: string };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return c.json({ error: "invalid_payload" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, email, password_hash, salt, role, status FROM admin_users WHERE email = ? LIMIT 1"
  )
    .bind(email)
    .first<AdminUserRow>();

  if (!user || user.status !== "active") return c.json({ error: "invalid_credentials" }, 401);

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) return c.json({ error: "invalid_credentials" }, 401);

  const token = await sign(
    {
      uid: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    c.env.TOKEN_SECRET
  );

  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } }, 200);
});

// --- Admin Sub-App (Scoped / Protected) ---

const adminApp = new Hono<{ Bindings: Env; Variables: { auth: JwtPayload } }>();

// Protect all admin endpoints with auth middleware
adminApp.use("*", async (c, next) => {
  const auth = await verifyAdminSession(c);
  if (!auth) {
    return c.json({ error: "admin_unauthorized" }, 401);
  }
  c.set("auth", auth);
  await next();
});

adminApp.get("/licenses", async (c) => {
  const q = c.req.query("q") || "";
  const page = Math.max(1, Number(c.req.query("page") || "1"));
  const perPage = Math.max(1, Math.min(100, Number(c.req.query("per_page") || "50")));
  const offset = (page - 1) * perPage;

  let query = "SELECT id, license_key_plain, plan, user_channel, max_devices, status, issued_at, expires_at, grace_days FROM licenses";
  let countQuery = "SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='revoked' THEN 1 ELSE 0 END) as revoked FROM licenses";
  const params: unknown[] = [];

  if (q) {
    const where = " WHERE id LIKE ? OR plan LIKE ? OR user_channel LIKE ? OR status LIKE ?";
    query += where;
    countQuery += where;
    const likeQ = `%${q}%`;
    params.push(likeQ, likeQ, likeQ, likeQ);
  }

  query += " ORDER BY issued_at DESC LIMIT ? OFFSET ?";
  const queryParams = [...params, perPage, offset];

  const [rows, countRes] = await Promise.all([
    c.env.DB.prepare(query).bind(...queryParams).all<LicenseRow>(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number; active: number; revoked: number }>()
  ]);

  const encKey = await deriveEncryptionKey(c.env.LICENSE_PEPPER);

  const items = await Promise.all(
    (rows.results || []).map(async (row) => {
      let plain = row.license_key_plain;
      if (plain) {
        try {
          plain = await decryptText(plain, encKey);
        } catch {
          // If decryption fails, keep the original (backward compatibility for unencrypted database rows)
        }
      }
      return {
        ...row,
        license_key_plain: plain,
      };
    })
  );

  return c.json({ 
    items, 
    total: countRes?.total || 0,
    total_active: countRes?.active || 0,
    total_revoked: countRes?.revoked || 0,
    page,
    per_page: perPage
  }, 200);});

adminApp.post("/licenses", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.admin) return c.json({ error: "forbidden" }, 403);

  let body;
  try {
    body = (await c.req.json()) as {
      plan?: string;
      user_channel?: string;
      max_devices?: number;
      expires_at?: string;
      grace_days?: number;
      metadata?: Record<string, JsonValue>;
    };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  if (!body.expires_at) return c.json({ error: "invalid_payload" }, 400);

  // Validate Input parameters
  const expiresAtDate = new Date(body.expires_at);
  if (isNaN(expiresAtDate.getTime())) {
    return c.json({ error: "invalid_expires_at" }, 400);
  }

  const maxDevices = Number(body.max_devices ?? 1);
  if (!Number.isInteger(maxDevices) || maxDevices <= 0) {
    return c.json({ error: "invalid_max_devices" }, 400);
  }

  const graceDays = Number(body.grace_days ?? 0);
  if (!Number.isInteger(graceDays) || graceDays < 0) {
    return c.json({ error: "invalid_grace_days" }, 400);
  }

  const normalizedPlan = normalizeIssuablePlan(body.plan);
  if (!normalizedPlan) {
    return c.json({ error: "invalid_plan" }, 400);
  }

  const id = crypto.randomUUID();
  const key = createLicenseKey(normalizedPlan);
  const hash = await sha256(`${key}:${c.env.LICENSE_PEPPER}`);
  const now = new Date().toISOString();

  // Encrypt the plain key before saving
  const encKey = await deriveEncryptionKey(c.env.LICENSE_PEPPER);
  const encryptedKeyPlain = await encryptText(key, encKey);

  await c.env.DB.prepare(
    "INSERT INTO licenses (id, license_key_hash, license_key_plain, plan,user_channel, max_devices, status, issued_at, expires_at, grace_days, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      hash,
      encryptedKeyPlain,
      normalizedPlan,
      body.user_channel,
      maxDevices,
      "active",
      now,
      body.expires_at,
      graceDays,
      JSON.stringify(body.metadata || {})
    )
    .run();

  await writeEvent(c, id, "issued", "admin", auth.uid, body.metadata || {});
  return c.json({ id, license_key: key }, 201);
});

adminApp.post("/licenses/batch", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.admin) return c.json({ error: "forbidden" }, 403);

  let body;
  try {
    body = (await c.req.json()) as {
      plan?: string;
      user_channel?: string;
      max_devices?: number;
      expires_at?: string;
      grace_days?: number;
      metadata?: Record<string, JsonValue>;
      quantity?: number;
    };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  if (!body.expires_at) return c.json({ error: "invalid_payload" }, 400);

  const expiresAtDate = new Date(body.expires_at);
  if (isNaN(expiresAtDate.getTime())) {
    return c.json({ error: "invalid_expires_at" }, 400);
  }

  const maxDevices = Number(body.max_devices ?? 1);
  if (!Number.isInteger(maxDevices) || maxDevices <= 0) {
    return c.json({ error: "invalid_max_devices" }, 400);
  }

  const graceDays = Number(body.grace_days ?? 0);
  if (!Number.isInteger(graceDays) || graceDays < 0) {
    return c.json({ error: "invalid_grace_days" }, 400);
  }

  const quantity = Number(body.quantity ?? 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return c.json({ error: "invalid_quantity" }, 400);
  }

  const normalizedPlan = normalizeIssuablePlan(body.plan);
  if (!normalizedPlan) {
    return c.json({ error: "invalid_plan" }, 400);
  }

  const encKey = await deriveEncryptionKey(c.env.LICENSE_PEPPER);
  const stmts = [];
  const generatedKeys = [];
  const now = new Date().toISOString();

  for (let i = 0; i < quantity; i++) {
    const id = crypto.randomUUID();
    const key = createLicenseKey(normalizedPlan);
    const hash = await sha256(`${key}:${c.env.LICENSE_PEPPER}`);
    const encryptedKeyPlain = await encryptText(key, encKey);

    generatedKeys.push(key);

    try {
      const stmt = c.env.DB.prepare(
        "INSERT INTO licenses (id, license_key_hash, license_key_plain, plan, user_channel, max_devices, status, issued_at, expires_at, grace_days, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        id,
        hash,
        encryptedKeyPlain,
        normalizedPlan,
        body.user_channel,
        maxDevices,
        "active",
        now,
        body.expires_at,
        graceDays,
        JSON.stringify(body.metadata || {})
      );
      stmts.push(stmt);
    } catch (e) {
      console.error("Batch bind error:", e);
      throw e;
    }
  }

  await c.env.DB.batch(stmts);

  await writeEvent(c, null, "batch_issued", "admin", auth.uid, { quantity, plan: normalizedPlan });
  return c.json({ keys: generatedKeys }, 201);
});

adminApp.post("/licenses/:id/revoke", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.admin) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  const res = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?").bind(id),
    c.env.DB.prepare("UPDATE license_devices SET status = 'revoked' WHERE license_id = ?").bind(id)
  ]);
  
  if (!res[0].meta.changes || res[0].meta.changes === 0) {
    return c.json({ error: "license_not_found" }, 404);
  }

  await writeEvent(c, id, "revoked", "admin", auth.uid, {});
  return c.json({ ok: true }, 200);
});

adminApp.delete("/licenses/:id", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.admin) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  // Run as batch to delete dependencies
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM license_devices WHERE license_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM license_events WHERE license_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM licenses WHERE id = ?").bind(id),
  ]);

  return c.json({ ok: true }, 200);
});

adminApp.post("/licenses/:id/extend", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.admin) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  let body;
  try {
    body = (await c.req.json()) as { expires_at?: string };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  if (!body.expires_at) return c.json({ error: "invalid_payload" }, 400);

  const expiresAtDate = new Date(body.expires_at);
  if (isNaN(expiresAtDate.getTime())) {
    return c.json({ error: "invalid_expires_at" }, 400);
  }

  const res = await c.env.DB.prepare("UPDATE licenses SET expires_at = ? WHERE id = ?")
    .bind(body.expires_at, id)
    .run();

  if (!res.meta.changes || res.meta.changes === 0) {
    return c.json({ error: "license_not_found" }, 404);
  }

  await writeEvent(c, id, "extended", "admin", auth.uid, { expires_at: body.expires_at });
  return c.json({ ok: true }, 200);
});

adminApp.get("/licenses/:id/devices", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.support) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  const rows = await c.env.DB.prepare(
    "SELECT id, device_fingerprint_hash, device_name, platform, platform_version, os_name, first_activated_at, last_seen_at, last_ip_prefix, status FROM license_devices WHERE license_id = ? ORDER BY first_activated_at DESC"
  )
    .bind(id)
    .all<DeviceRow>();

  return c.json({ devices: rows.results || [] }, 200);
});

adminApp.post("/licenses/:id/unbind-device", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.support) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  let body;
  try {
    body = (await c.req.json()) as { device_fingerprint_hash?: string };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  if (!body.device_fingerprint_hash) return c.json({ error: "invalid_payload" }, 400);

  const res = await c.env.DB.prepare("DELETE FROM license_devices WHERE license_id = ? AND device_fingerprint_hash = ?")
    .bind(id, body.device_fingerprint_hash)
    .run();

  if (!res.meta.changes || res.meta.changes === 0) {
    return c.json({ error: "device_not_found" }, 404);
  }

  await writeEvent(c, id, "unbound", "admin", auth.uid, { device_fingerprint_hash: body.device_fingerprint_hash });
  return c.json({ ok: true }, 200);
});

adminApp.get("/licenses/:id/events", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.support) return c.json({ error: "forbidden" }, 403);

  const id = c.req.param("id");

  const rows = await c.env.DB.prepare(
    "SELECT * FROM license_events WHERE license_id = ? ORDER BY created_at DESC LIMIT 200"
  )
    .bind(id)
    .all();

  return c.json({ events: rows.results || [] }, 200);
});

adminApp.get("/users", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.owner) return c.json({ error: "forbidden" }, 403);

  const rows = await c.env.DB.prepare("SELECT id, email, role, status, created_at FROM admin_users ORDER BY created_at DESC").all();
  return c.json({ items: rows.results || [] }, 200);
});

adminApp.post("/users", async (c) => {
  const auth = c.get("auth");
  if (roleRank[auth.role] < roleRank.owner) return c.json({ error: "forbidden" }, 403);

  let body;
  try {
    body = (await c.req.json()) as { email?: string; password?: string; role?: Role };
  } catch {
    return c.json({ error: "invalid_payload" }, 400);
  }

  if (!body.email || !body.password) return c.json({ error: "invalid_payload" }, 400);

  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const role = body.role || "support";

  if (!["owner", "admin", "support", "readonly"].includes(role)) {
    return c.json({ error: "invalid_role" }, 400);
  }

  const id = crypto.randomUUID();
  const salt = generateRandomSalt();
  const passwordHash = await hashPassword(password, salt);

  try {
    await c.env.DB.prepare(
      "INSERT INTO admin_users (id, email, password_hash, salt, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)"
    )
      .bind(id, email, passwordHash, salt, role, new Date().toISOString())
      .run();
  } catch (err) {
    const e = err as Error;
    if (e.message && e.message.includes("UNIQUE constraint failed")) {
      return c.json({ error: "email_already_exists" }, 409);
    }
    throw e;
  }

  return c.json({ id }, 201);
});

// Mount the admin sub-app
app.route("/v1/admin", adminApp);

// Standard error handling
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "internal_server_error", message: err.message }, 500);
});

app.notFound((c) => {
  return c.json({ error: "not_found" }, 404);
});

export default app;
