## Context

This change defines a greenfield, self-hosted notes product rather than extending Snaptium's current Electron runtime. A deployment must provide a usable Web application and its backend together, while optional native clients connect to the same user-configured server for offline work and synchronization. The first native target is Windows; later Tauri targets are expected to reuse the same UI and Rust core.

The product targets individuals, families, and small trusted groups operating a single server. It favors a low-friction Docker deployment, portable Markdown data, and reliable single-user multi-device synchronization over enterprise scaling or real-time collaboration. Server administrators are trusted in the first release, so transport, authentication, authorization, backup, and host security are required, but zero-knowledge end-to-end encryption is not.

Stakeholders include self-hosting users, browser-only users, Windows users who require offline access, operators performing upgrades and backups, and maintainers evolving the synchronization protocol without losing user data.

## Goals / Non-Goals

**Goals:**

- Deliver the Web client and API as one versioned Docker application with a minimal persistent-volume layout.
- Reuse one Vue 3/TypeScript UI and WYSIWYG Markdown editor across Web and Tauri clients.
- Keep Markdown as the canonical portable note format.
- Provide an online-first Web experience and an offline-first Windows experience.
- Make synchronization incremental, idempotent, resumable, conflict-safe, and compatible across adjacent client versions.
- Protect accounts, sessions, attachments, and administrative operations without claiming end-to-end encryption.
- Make backup, restore, export, and upgrade recovery first-class product behavior.
- Preserve clear migration boundaries for a future PostgreSQL deployment profile, complete Web offline mode, mobile clients, and optional encrypted vaults.

**Non-Goals:**

- Modifying or migrating the existing Electron application during this change.
- Real-time collaborative editing, shared live cursors, CRDT, or team workspaces.
- End-to-end encryption or protection from a trusted server administrator.
- Horizontal server scaling, multi-primary databases, or Kubernetes deployment.
- A full offline Web replica in the first release.
- Android, iOS, macOS, or Linux release artifacts in the first release.
- Redis, Elasticsearch, mandatory MinIO/S3, or microservices.
- Arbitrary HTML or unrestricted Markdown extensions.

## Decisions

### 1. Use a greenfield workspace with shared packages and Rust crates

The repository will add separate applications for the Web/Tauri client and Axum server, shared Vue editor/UI packages, and shared Rust protocol/domain crates. Existing Electron layering does not apply to the new Tauri runtime, but the same principles of strict boundaries, typed inputs, i18n, and minimum privilege remain mandatory.

Application paths are platform-oriented: `apps/web/` contains the browser entry, `apps/windows/` contains the Windows Vue entry and `src-tauri/` shell, and `apps/server/` contains the Axum application, server repositories, and server migrations. Dockerfile, Compose, proxy examples, and deployment configuration live in `deploy/docker/`; Docker packages Web and API together rather than defining another client.

Shared Vue UI, editor, i18n, and frontend contracts live in `packages/ui/`, `packages/editor/`, `packages/i18n/`, and `packages/contracts/`. Shared Rust crates live in `crates/domain/`, `crates/protocol/`, and `crates/native-core/`. The root Cargo workspace includes `apps/server/`, `apps/windows/src-tauri/`, and these shared crates; there is no duplicate `crates/server/`. Platform applications depend on shared packages instead of copying UI or synchronization logic. Additional lowercase platform directories are introduced only when those platforms enter implementation scope; the Android risk spike does not imply a first-release Android application.

Alternatives considered:

- Extending the current Electron app would reduce initial scaffolding but retain a desktop-only runtime and conflict with the requested clean restart.
- Separate repositories would reduce repository size but make atomic protocol changes, releases, and shared tests harder.

### 2. Ship one application image that embeds the Web build

The production build will compile the Vue Web application and embed or package its static output with the Axum server. One public origin serves `/`, `/assets`, `/.well-known/notes`, `/api/v1`, and `/ws`. The default Compose deployment contains the application container and persistent data volume; an external reverse proxy terminates HTTPS.

Embedding avoids Web/API version skew and makes upgrade and rollback atomic. PostgreSQL, Redis, and object storage are not default dependencies.

### 3. Use different stores behind a common domain and protocol contract

The server uses SQLite as its authoritative store. The Tauri client uses a separate SQLite schema for offline notes, pending mutations, sync state, conflicts, and local search. The first Web release calls the server API directly and uses IndexedDB only for recoverable drafts, preferences, and transient uploads.

Database files and database row models are never synchronized. Shared contracts cover IDs, timestamps, Markdown payloads, revisions, cursors, mutations, errors, and protocol versions.

Server SQLite runs as a single writer-capable application instance with WAL, foreign keys, busy timeout, short write transactions, and application-level backup coordination. Attachments remain outside SQLite as files referenced by database metadata.

First-release organization uses single-level folders, as confirmed by the user on 2026-10-05. Tags and note-tag associations are deferred; do not add speculative tag tables, APIs, or UI. Folder access and note moves must remain owner-scoped across Web and native clients. Deleting a folder moves its notes to the virtual uncategorized group without deleting their content; the eventual repository operation must also update revisions and the change log atomically.

Confirmed first-release defaults: each attachment is bounded to 20 MiB (20,971,520 bytes); each account starts with a 5 GiB (5,368,709,120 bytes) administrator-adjustable quota; retain the latest 100 versions per note; do not automatically purge synchronization tombstones in the first release; public registration is disabled and administrators create accounts. These are product defaults, not measured performance promises. Quota accounting and history pruning remain implementation tasks and must include retained content and attachments without deleting data to force compliance after a quota reduction.

### 4. Use Markdown as canonical content with a controlled WYSIWYG projection

Milkdown/ProseMirror provides the editor UI, but normalized Markdown text is the stored and synchronized representation. The first supported subset includes paragraphs, headings, emphasis, strike-through, ordered/unordered/task lists, quotes, code, links, images, and horizontal rules. Arbitrary HTML is rejected or sanitized.

Canonical serialization and cross-client fixtures prevent format churn. Unsupported Markdown must not be silently destroyed; it is either preserved as source-compatible content or blocked with an explicit import warning.

Format v1 details and fixtures are documented in `docs/markdown-format.md`. The shared `packages/editor/` implementation rejects raw HTML, tables, footnotes, reference definitions/links/images, and extra code-fence metadata before rich projection. Rejected source remains editable as text. The prototype renders image references as non-fetching placeholders while preserving URLs, alt text, and titles; authenticated image loading is added with the attachment workflow. Paste accepts plain text through the Markdown boundary, arbitrary clipboard HTML and file drops are blocked, and composition prevents toolbar operations and mode switches. The 512 KiB prototype editor input bound does not resolve the final persisted-note quota decision.

### 5. Use revision-and-cursor synchronization rather than database replication

Native clients maintain an outbox of immutable mutations. Each mutation carries a globally unique mutation ID, entity ID, operation, base revision, and payload. The server records accepted mutations atomically with an ordered change-log cursor and remembers mutation outcomes for idempotent retries.

Clients push pending mutations, then pull ordered changes after their last committed cursor. Deletes use tombstones retained long enough for offline clients. Pull is paginated. The client commits a page and its cursor in one local transaction.

When a base revision is stale, the server rejects the mutation with the current entity version. The native client preserves the local edit as a conflict copy instead of silently overwriting either version. CRDT and automatic semantic merging are deferred.

Web writes use the same revision preconditions but do not require a local outbox in the first release.

### 6. Separate authentication, device sessions, and synchronization identity

Passwords are hashed with Argon2id using versioned parameters. Web sessions use Secure, HttpOnly, SameSite cookies. Native devices receive independently revocable access/refresh credentials stored in operating-system-protected storage; persistent refresh credentials are stored hashed on the server. Passwords are never persisted by clients.

The initial server credential module uses Argon2id v=19 with m=19456 KiB, t=2, p=1, a fresh operating-system-generated 16-byte salt and a 32-byte output. Verification accepts only this bounded PHC profile; unknown or excessive stored costs are refused before hashing. A process-wide limit of two blocking hash/verify jobs has no unbounded wait queue, and permits stay with blocking jobs after caller cancellation. This resource limit does not replace HTTP authentication rate limiting. New passwords contain at least 15 Unicode characters and at most 1024 UTF-8 bytes without trimming or truncation; the technical login identifier is 3–64 ASCII lowercase letters, digits or `._-`, separate from future display names.

Bootstrap compares a configured 32-byte random initialization secret encoded as 64 lowercase hexadecimal characters with the validated request candidate. Account creation and permanent bootstrap closure commit atomically after hashing outside the write transaction. Closure survives restart and account removal; failed inserts roll back so initialization can be retried. The trusted configured secret must never be taken from the request. This phase initializes fresh schema 2 databases with immutable core and bootstrap migration records in one transaction. Existing schema 1 databases are refused during the read-only probe until verified pre-upgrade backup/restore exists; no automatic upgrade, destructive reset or downgrade is permitted. Rust credential verification alone neither issues a Web session nor authorizes a client-supplied owner ID. HTTP/configuration integration remains a separate pending task.

All note and attachment access is scoped to the authenticated owner. Administrative APIs are separated from user APIs, rate-limited, audited without note content, and unavailable until server initialization establishes the first administrator.

### 7. Keep Web online-first for the first release

The Web client obtains authoritative note state from the server. IndexedDB protects unsent editor drafts and upload progress but is not a complete replica. This avoids building a second offline synchronization engine before the protocol is proven by the Windows client.

A later complete Web offline mode can implement the same repository/outbox contract on IndexedDB without changing server APIs.

### 8. Put native persistence and synchronization in Rust

Tauri commands expose coarse-grained domain operations such as save note, query notes, import attachment, and synchronize once. Vue code does not execute arbitrary SQL, handle refresh tokens directly, or perform unrestricted filesystem operations. Rust owns SQLite migrations, transactional outbox behavior, local FTS, attachment files, synchronization, and system credential integration.

The Windows UI remains responsive by running storage and network work outside the UI thread. A future Android WorkManager integration can invoke the same Rust synchronization operation through a narrow platform plugin.

### 9. Make portability and recovery part of the data contract

Users can export Markdown plus attachments without proprietary lock-in. Server backups contain the database, attachments, and a manifest recording application/schema versions. Backup creation uses a consistent SQLite backup mechanism rather than copying a live database file. Restore is documented and verified through automated tests.

Every schema migration is forward-only, runs after a pre-upgrade backup, and prevents startup if compatibility checks fail. Rollback restores the prior application image and corresponding backup rather than attempting an unsafe down migration.

## Risks / Trade-offs

- [Tauri mobile behavior may not meet future Android UX and background requirements] → Validate Android input, WebView, file access, and background synchronization with an early spike; retain the Rust core and protocol if a native Kotlin shell becomes necessary.
- [SQLite permits only one concurrent writer and cannot support horizontal application replicas] → Declare single-instance operation, keep transactions short, enable WAL/busy timeout, and migrate to a PostgreSQL deployment profile only after measured demand.
- [Different Web and native persistence layers can diverge] → Share protocol fixtures and domain semantics, test cross-client scenarios, and keep Web online-first until synchronization behavior is mature.
- [WYSIWYG serialization can rewrite or lose Markdown] → Define a controlled syntax subset, maintain golden round-trip fixtures, warn on unsupported imports, and store recovery revisions.
- [Synchronization bugs can lose user data] → Use idempotent mutations, atomic cursor commits, tombstones, conflict copies, fault-injection tests, and mandatory backup/restore tests.
- [A compromised self-hosted Web server can serve malicious client code] → Document the trust model, ship strict CSP without third-party scripts, publish signed native clients, and never load remote UI code inside Tauri.
- [No E2EE means an operator can read stored content] → State this clearly in product security documentation, require HTTPS for remote access, recommend encrypted disks/backups, and reserve versioned payload fields for a future encrypted mode.
- [Shared Rust protocol types can over-couple client and server implementations] → Share wire/domain primitives only; keep server rows, client rows, repositories, and migrations separate.

## Migration Plan

1. Add the greenfield workspace and shared protocol/domain packages without changing existing application entry points.
2. Deliver a development server and embedded Web build using disposable SQLite data.
3. Stabilize server schema, API v1, Markdown format, and backup manifest before public data is accepted.
4. Deliver Docker Compose with explicit persistent volumes, initialization flow, health checks, and documented HTTPS proxy configuration.
5. Add the Windows Tauri client, local SQLite migrations, outbox synchronization, and cross-client compatibility tests.
6. Run an internal data-loss and recovery gate covering interrupted upgrades, duplicate mutations, stale revisions, deleted notes, attachment failures, and backup restoration.
7. Publish a beta with schema/protocol compatibility policy and automated pre-upgrade backup.

Rollback restores the previous application image together with the backup taken immediately before migration. The application must refuse to open a schema newer than it understands.

## Open Questions

- Final product name, application identifiers, and image names.
- Which Windows signing and update distribution channel will be used for the first public beta.
