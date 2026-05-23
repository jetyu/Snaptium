CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  license_key_hash TEXT NOT NULL UNIQUE,
  license_key_plain TEXT,
  plan TEXT NOT NULL DEFAULT 'Insider',
  user_channel TEXT NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 0,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS license_devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  device_name TEXT,
  platform TEXT,
  platform_version TEXT,
  os_name TEXT,
  first_activated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_ip_prefix TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_license_device_unique ON license_devices (license_id, device_fingerprint_hash);

CREATE TABLE IF NOT EXISTS license_events (
  id TEXT PRIMARY KEY,
  license_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  ip_prefix TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL,
  payload TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_license_events_license_id ON license_events (license_id, created_at DESC);

INSERT INTO licenses(id, license_key_hash, license_key_plain, plan, user_channel, max_devices, status, issued_at, expires_at, grace_days, metadata) VALUES ('72bbdb93-5e2f-44e8-aa3d-388cc8cb44f4', 'd6ab3fdf4ccb3a1b53c678970ebb6eeb354c429a8bac49d3ec77c5d932621d12', 'SNPI-9FSU-7FX5-D3WU-M3WB', 'Insider', 'GitHub', 3, 'active', '2026-05-22T07:05:03.041Z', '2027-05-22T00:00:00.000Z', 3, '{"billing_status":"unpaid","payment_ref":"","comment_ref":"","device_ip":"","device_mac":"","device_address":""}'), ('168c77d7-27f6-4ffd-8ed0-74bab844a0ab', 'ca295038d70ff8a6252006343e81f899b4eb1d9fe3526072d14455e046010091', 'SNPI-9FSU-7FX5-D3WU-123B', 'Insider', 'App', 3, 'active', '2026-05-22T07:05:32.260Z', '2027-05-22T00:00:00.000Z', 3, '{"billing_status":"unpaid","payment_ref":"123","comment_ref":"444","device_ip":"","device_mac":"","device_address":""}');
INSERT INTO license_devices(id, license_id, device_fingerprint_hash, device_name, first_activated_at, last_seen_at, last_ip_prefix, status) VALUES -- license: 72bbdb93-5e2f-44e8-aa3d-388cc8cb44f4
('gh-dev-001', '72bbdb93-5e2f-44e8-aa3d-388cc8cb44f4', 'fp_hash_gh_001', 'MacBook Pro 16', '2026-05-22T07:06:00.000Z', '2026-05-22T08:10:00.000Z', '192.168.*.*', 'active'), ('gh-dev-002', '72bbdb93-5e2f-44e8-aa3d-388cc8cb44f4', 'fp_hash_gh_002', 'Windows Gaming PC', '2026-05-22T07:08:00.000Z', '2026-05-22T08:12:00.000Z', '10.0.*.*', 'active'), ('gh-dev-003', '72bbdb93-5e2f-44e8-aa3d-388cc8cb44f4', 'fp_hash_gh_003', 'Steam Deck OLED', '2026-05-22T07:12:00.000Z', '2026-05-22T08:15:00.000Z', '172.16.*.*', 'active'), -- license: 168c77d7-27f6-4ffd-8ed0-74bab844a0ab
('app-dev-001', '168c77d7-27f6-4ffd-8ed0-74bab844a0ab', 'fp_hash_app_001', 'Office Laptop', '2026-05-22T07:20:00.000Z', '2026-05-22T08:20:00.000Z', '100.64.*.*', 'active'), ('app-dev-002', '168c77d7-27f6-4ffd-8ed0-74bab844a0ab', 'fp_hash_app_002', 'iPhone 17 Pro', '2026-05-22T07:25:00.000Z', '2026-05-22T08:22:00.000Z', '192.0.*.*', 'active'), ('app-dev-003', '168c77d7-27f6-4ffd-8ed0-74bab844a0ab', 'fp_hash_app_003', 'Surface Pro 11', '2026-05-22T07:30:00.000Z', '2026-05-22T08:24:00.000Z', '172.20.*.*', 'active');
