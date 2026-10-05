## Why

Users need a lightweight notes product that they can deploy on infrastructure they control, use immediately in a browser, and connect to from an installable Windows client for offline work and synchronization. Existing products often trade simple deployment and a polished Markdown writing experience for heavier infrastructure, incomplete native clients, or cloud-service dependency.

## What Changes

- Introduce a new self-hosted notes product delivered as a Docker deployment that includes the Web client, API server, server-side SQLite database, and local attachment storage.
- Provide a responsive Web client for online-first note authoring, organization, search, attachment handling, account access, and device management.
- Provide a Windows desktop client built with Tauri 2 that uses the shared Vue 3 interface, stores an offline copy in local SQLite, and connects to a user-configured server URL.
- Provide WYSIWYG editing over a controlled Markdown subset while preserving Markdown as the portable canonical document format.
- Introduce versioned incremental synchronization based on revisions, cursors, idempotent mutation identifiers, deletion tombstones, pagination, retries, and conflict copies.
- Introduce account authentication, independently revocable device sessions, secure password hashing, HTTPS deployment guidance, and authorization for notes and attachments.
- Provide Markdown import/export, attachment portability, automated server backups, restore documentation, and upgrade-safe database migrations.
- Keep the first release intentionally single-node and collaboration-free: no end-to-end encryption, real-time multi-user editing, CRDT, full Web offline replica, Android/iOS client, PostgreSQL, Redis, or mandatory object storage.
- Treat this as a greenfield product architecture rather than an extension of the repository's current Electron application architecture.

## Capabilities

### New Capabilities

- `self-hosted-notes-deployment`: Docker deployment, embedded Web assets, persistent storage, initialization, health checks, configuration, upgrades, and recovery expectations.
- `notes-web-experience`: Browser-based account access, note navigation, WYSIWYG Markdown authoring, organization, search, drafts, attachments, and responsive behavior.
- `notes-desktop-experience`: Windows Tauri client setup, server discovery, local SQLite storage, offline use, native credential storage, and desktop lifecycle behavior.
- `notes-sync-protocol`: Versioned push/pull synchronization, revision control, cursors, idempotency, deletion propagation, pagination, retries, and conflict preservation.
- `notes-identity-and-devices`: Server initialization, accounts, authentication, session/token handling, device registration, device revocation, authorization, and administrative limits.
- `notes-data-portability`: Markdown and attachment import/export, server backup and restore, database migration safety, and user-controlled data recovery.

### Modified Capabilities

None.

## Impact

- Adds a greenfield workspace containing a Vue 3/TypeScript Web interface, Tauri 2 desktop shell, Rust client core, and Rust Axum server.
- Organizes application entries by platform in `apps/web/` and `apps/windows/`, places the server in `apps/server/`, shares UI and Rust core through `packages/` and `crates/`, and stores Docker deployment assets in `deploy/docker/`.
- Adds SQLite schemas for the authoritative server store and the desktop offline replica; these stores share domain semantics but not database files or identical schemas.
- Adds a versioned HTTP/WebSocket API and shared Rust protocol types consumed by Web and native clients.
- Adds Docker image, Compose configuration, persistent volume layout, health checks, upgrade flow, and release artifacts.
- Adds security-sensitive authentication, authorization, Markdown sanitization, attachment handling, credential storage, backup, and synchronization boundaries that require dedicated threat review and automated tests.
- Does not modify the existing Electron application's business code during the proposal phase.
