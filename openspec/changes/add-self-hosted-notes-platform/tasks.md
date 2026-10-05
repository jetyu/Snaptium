## 1. Product Decisions and Risk Spikes

- [ ] 1.1 Choose the product name, application identifiers, and container image name using the agreed platform workspace paths without changing existing application entry points
- [x] 1.2 Resolve first-release organization scope, attachment limit, storage quota, tombstone retention, note-history retention, and registration default
  - Confirmed: single-level folders, folder deletion preserves notes as uncategorized, 20 MiB attachments, administrator-adjustable 5 GiB/account default, latest 100 note versions, no automatic tombstone purge, and administrator-created accounts with public registration disabled.
- [ ] 1.3 Prototype Milkdown WYSIWYG editing with Chinese IME, selection, undo, paste, image insertion, and canonical Markdown round trips
- [ ] 1.4 Prototype Tauri 2 on Windows with Vue assets, coarse-grained Rust commands, SQLite access, credential storage, and production packaging
- [ ] 1.5 Prototype Tauri 2 on Android for Chinese IME, keyboard layout, file selection, WebView performance, and WorkManager-to-Rust synchronization invocation, then record the native-shell fallback decision
- [x] 1.6 Define the supported Markdown subset and add canonical serialization/import fixtures before building persistent note storage

## 2. Greenfield Workspace and Quality Gates

- [ ] 2.1 Create the root Rust workspace with `apps/server/`, `apps/windows/src-tauri/`, `crates/domain/`, `crates/protocol/`, `crates/native-core/`, and integration tests, keeping server and native repositories/migrations separate
- [ ] 2.2 Create the frontend workspace with platform entries in `apps/web/` and `apps/windows/` and shared `packages/ui/`, `packages/editor/`, `packages/i18n/`, and `packages/contracts/` without duplicating shared application logic
- [x] 2.2.1 Scaffold and verify the Web entry and shared UI, Simplified Chinese i18n, and runtime-validated foundation health contract; keep Windows scaffolding pending
- [ ] 2.3 Configure strict TypeScript, Rust formatting/linting, dependency policies, and reproducible lockfiles
- [x] 2.3.1 Configure strict Vue/TypeScript checks, frontend ESLint rules, pinned compatible dependencies, and a verified frozen pnpm lockfile
- [x] 2.3.2 Generate the Cargo lockfile, verify the current server/protocol workspace with Rust format/clippy/tests, and require locked dependencies in Rust CI and Docker builds; keep native quality gates pending
- [ ] 2.4 Add CI jobs for frontend typecheck/lint/unit tests, Rust format/clippy/tests, protocol fixtures, Docker build, and Windows Tauri build
- [x] 2.4.1 Add frontend CI commands and locally verify typecheck, lint, health-boundary/component tests, and production Web build
- [ ] 2.5 Define structured error codes, request correlation, content-free logs, and development diagnostics shared across applications

## 3. Shared Domain and API Contract

- [ ] 3.1 Define UUIDv7 identifiers, RFC 3339 timestamps, string-encoded revisions/cursors, entity operations, and validation constraints
- [ ] 3.2 Define note, organization, attachment, device, session, mutation, change-page, conflict, export, backup, and service-discovery wire contracts
- [ ] 3.3 Version the HTTP, WebSocket notification, synchronization, Markdown, schema, and backup-manifest formats independently
- [ ] 3.4 Add golden JSON fixtures and forward/backward compatibility tests for supported adjacent protocol versions
- [ ] 3.5 Generate and validate OpenAPI documentation without exposing server database row types

## 4. Server Storage Foundation

- [ ] 4.1 Implement server SQLite connection configuration with WAL, foreign keys, busy timeout, bounded connections, and single-instance ownership
- [x] 4.1.1 Implement and verify the server-only empty-database connection module with per-connection WAL/foreign keys/FULL synchronous/busy timeout, bounded pool, cross-process ownership, and incompatible-database refusal; keep HTTP startup integration and migrated storage pending
- [ ] 4.2 Add forward migrations for users, devices, sessions, notes, organization, attachments, mutation outcomes, change log, quotas, and schema metadata
- [x] 4.2.1 Implement and verify transactional empty-database schema initialization for users, single-level folders, notes, confirmed policy defaults and schema metadata; verify reopen, rollback/retry, cross-owner constraints and exact-schema refusal, keeping business APIs and existing-data upgrades pending
- [ ] 4.3 Implement typed server repositories with short transactions and owner-scoped queries
- [x] 4.3.1 Implement and verify server-only owner-scoped note reads and bounded UUID-keyset folder pagination, canonical UUIDv7 inputs, positive lossless revisions, content-free errors and raw-source preservation; keep authenticated HTTP integration and transactional writes pending
- [ ] 4.4 Implement local attachment storage with opaque paths, atomic writes, integrity metadata, and garbage-collection state
- [ ] 4.5 Add repository integration tests for constraints, concurrency, restart durability, and attachment/database consistency

## 5. Identity, Devices, and Authorization

- [ ] 5.1 Implement one-time administrator bootstrap with initialization-secret validation and permanent closure after success
- [x] 5.1.1 Implement and verify validated server-only initialization secrets and transactional administrator creation with persistent closure, concurrent-winner isolation, rollback/retry and restart protection; initialize fresh schema 2 and refuse schema 1 without mutation, keeping configuration and HTTP bootstrap pending
- [ ] 5.2 Implement account creation policy and Argon2id password verification with versioned parameters
- [x] 5.2.1 Implement and verify typed credential boundaries, salted versioned Argon2id hashes, bounded PHC parameters and process-wide blocking-work capacity, generic credential failures and first-administrator password policy; keep administrator-managed accounts, password updates and HTTP login pending
- [ ] 5.3 Implement Secure HttpOnly SameSite Web sessions with CSRF protection and logout
- [ ] 5.4 Implement native device registration, short-lived access credentials, hashed rotating refresh credentials, and protected client storage integration
- [ ] 5.5 Implement user device listing, naming, last-seen metadata, individual revocation, and revoke-all behavior
- [ ] 5.6 Enforce owner-scoped authorization on notes, attachments, synchronization, export, and device operations
- [ ] 5.7 Add generic authentication failures, rate limiting, security-event auditing, and log-redaction tests
- [ ] 5.8 Add user-facing security documentation that explicitly states the trusted-server and non-E2EE model

## 6. Note and Attachment API

- [ ] 6.1 Implement versioned note create/read/update/trash/restore/delete operations with revision preconditions
- [ ] 6.2 Implement first-release folder organization operations and ownership rules; keep tags deferred
- [ ] 6.3 Implement bounded note listing, filtering, ordering, and server-side search for the Web client
- [ ] 6.4 Implement authenticated attachment upload, download, association, deletion, size limits, safe names, and integrity checks
- [ ] 6.5 Implement note revision history according to the resolved retention policy
- [ ] 6.6 Add API tests for validation, authorization, stale revisions, malicious Markdown/URLs, attachment abuse, and quota enforcement

## 7. Web Client and Editor

- [ ] 7.1 Build the responsive authenticated shell, navigation, note list, editor layout, settings, device management, and administration entry points
- [x] 7.2 Implement the Milkdown editor using the controlled Markdown schema and canonical serialization fixtures
- [ ] 7.3 Sanitize rendered/imported Markdown and enforce a strict content-security policy without third-party runtime scripts
- [ ] 7.4 Implement online-first note CRUD, organization, trash, search, history, and attachment workflows against the versioned API
- [ ] 7.5 Implement IndexedDB-backed unsent drafts, preferences, and transient upload recovery without claiming a full offline replica
- [x] 7.5.1 Implement and verify preview-only IndexedDB drafts with exact raw-source retention, explicit recovery into independent copies, serial transaction-complete save states, bounded validation, and failure retry; keep authenticated drafts, preferences, and upload recovery pending
- [ ] 7.6 Implement revision-conflict UI that preserves the local Web draft and displays the current server version
- [ ] 7.7 Add Simplified Chinese resources for all user-visible strings and enforce i18n usage in shared UI
- [ ] 7.8 Add browser unit/component tests and end-to-end tests for authoring, drafts, search, attachment access, security sanitization, and session expiry

## 8. Synchronization Server

- [ ] 8.1 Implement transactional mutation submission with mutation-ID outcome retention and deterministic idempotent retries
- [ ] 8.2 Implement base-revision validation and conflict responses containing the current authorized entity version
- [ ] 8.3 Implement ordered per-user change-log cursors and bounded pull pagination
- [ ] 8.4 Implement tombstone creation, retention, and safe cleanup without stranding supported offline clients
- [ ] 8.5 Implement attachment synchronization states so note metadata never references an unavailable committed attachment
- [ ] 8.6 Implement WebSocket change-available notifications that carry cursors but not authoritative entity payloads
- [ ] 8.7 Add fault-injection tests for lost responses, duplicate pushes, interrupted pulls, stale revisions, deletion races, and service restarts

## 9. Windows Tauri Client Core

- [ ] 9.1 Implement service discovery and validated server-profile configuration without storing credentials for incompatible endpoints
- [ ] 9.2 Add client SQLite migrations for notes, organization, attachments, pending mutations, sync state, conflicts, FTS, and local settings
- [ ] 9.3 Implement transactional local note operations that atomically persist user changes and outbox mutations
- [ ] 9.4 Implement local FTS indexing and offline search over synchronized and pending note content
- [ ] 9.5 Implement local attachment import, cache, integrity validation, cleanup, and upload/download state
- [ ] 9.6 Implement coarse-grained validated Tauri commands and deny arbitrary SQL, unrestricted filesystem access, and remote UI loading
- [ ] 9.7 Implement native credential storage, server profile logout, local data removal, and revoked-session handling
- [ ] 9.8 Add native-core tests for migrations, transactions, crashes after save, local search, attachment failures, and command validation

## 10. Windows Synchronization and UI

- [ ] 10.1 Implement push retry with stable mutation IDs and deterministic acknowledgement removal
- [ ] 10.2 Implement paginated pull with atomic page application and cursor advancement
- [ ] 10.3 Implement stale-revision conflict-copy creation that preserves both local and authoritative Markdown
- [ ] 10.4 Implement synchronization scheduling, manual sync, connectivity recovery, backoff, and user-visible status
- [ ] 10.5 Integrate the shared Vue workspace and editor with the native repository and synchronization commands
- [ ] 10.6 Implement Windows offline workflows, credential expiry recovery, attachment availability indicators, and conflict resolution UI
- [ ] 10.7 Add cross-client tests for Web-to-Windows, Windows-to-Web, duplicate retry, concurrent edits, deletion propagation, and first-device bootstrap

## 11. Portability, Backup, and Upgrade Safety

- [ ] 11.1 Implement complete Markdown/attachment export with a documented portable manifest
- [ ] 11.2 Implement validated Markdown/attachment import with duplicate policy, sanitization, and itemized failure reporting
- [ ] 11.3 Implement consistent server backups using the SQLite backup mechanism plus attachment and version manifest capture
- [ ] 11.4 Implement backup integrity verification and a restore command that refuses incompatible or incomplete archives before replacing active data
- [ ] 11.5 Implement pre-migration recovery points, schema compatibility refusal, and documented image-plus-backup rollback
- [ ] 11.6 Add automated tests that restore representative backups, upgrade old schemas, reject future schemas, and recover from interrupted upgrade simulations

## 12. Docker Packaging and Operations

- [ ] 12.1 Build the Vue production assets and embed or package them with the Axum release so Web/API versions are atomic
- [ ] 12.2 Create the Dockerfile under `deploy/docker/` for a minimal non-root multi-architecture application image with read-only runtime filesystem outside documented volumes
- [ ] 12.3 Create the supported Compose configuration and environment example under `deploy/docker/`, documenting persistent volume layout, health checks, restart policy, and resource guidance
- [ ] 12.4 Add same-origin routing for Web, API, WebSocket, attachments, service discovery, and SPA fallback
- [ ] 12.5 Document Caddy HTTPS setup, trusted local-network development, initialization, updates, backups, restoration, and troubleshooting
- [ ] 12.6 Validate fresh install, container replacement, upgrade, rollback, amd64, and arm64 deployment scenarios

## 13. Windows Packaging and Release

- [ ] 13.1 Configure stable Windows application identity, icons, installer, single-instance behavior, protocol links, and uninstall data choices
- [ ] 13.2 Configure signed update manifests and an update flow that never loads remote application UI code
- [ ] 13.3 Run Windows compatibility tests for WebView2 installation, Chinese IME, high DPI, accessibility, sleep/wake, proxy, offline use, and large note collections
- [ ] 13.4 Produce signed beta artifacts, checksums, release notes, and installation/update documentation

## 14. Release Readiness

- [ ] 14.1 Complete a threat review covering authentication, authorization, CSRF, XSS, path traversal, attachments, tokens, backups, logs, and update supply chain
- [ ] 14.2 Complete a data-loss review covering transaction boundaries, outbox durability, cursor commits, tombstones, conflicts, migrations, and restore
- [ ] 14.3 Run performance tests for initial synchronization, incremental synchronization, search, large Markdown notes, attachment transfer, and server memory on target hardware
- [ ] 14.4 Publish an explicit compatibility and support policy for API, synchronization protocol, database schema, Windows client, and Docker images
- [ ] 14.5 Verify all specification scenarios through automated tests or documented release checks and publish the public beta
