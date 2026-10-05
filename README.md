# Self-hosted Notes Platform

This branch is the greenfield planning baseline for a self-hosted, local-first Markdown notes product.

The target product provides:

- a Docker deployment containing the Web client and API server;
- a Windows client built with Tauri 2;
- WYSIWYG authoring with portable Markdown as the canonical format;
- offline native storage and versioned incremental synchronization;
- user-controlled export, backup, restore, and upgrade recovery.

The Web/server foundation and shared Markdown editor preview have been scaffolded. Explicit identity configuration enables SQLite-backed administrator initialization, browser login, bounded in-memory sessions, CSRF protection, throttling and logout. Server note saving and native clients are not implemented yet. Web preview edits remain independent browser-local IndexedDB drafts, not account-scoped notes. These drafts are not server commits or a complete offline replica, and browser storage is not a backup. The planned scope, architecture, requirements, and implementation tasks live in:

`openspec/changes/add-self-hosted-notes-platform/`

Implementation follows the OpenSpec apply workflow, with Web/server/Docker foundations first and Windows implementation later.

## Development

Start the Web preview with `pnpm install --frozen-lockfile` and `pnpm dev:web`.
Run frontend verification with `pnpm check`.
See [本地开发与验证](docs/development.md) for server and Docker commands, current limitations, and implementation status.

## Engineering documentation

- [技术架构](docs/technical-architecture.md): target components, boundaries, synchronization, security, and recovery.
- [开发规约](docs/development-guidelines.md): implementation rules, verification, CI, and review requirements.
- [Markdown 格式与编辑器边界](docs/markdown-format.md): supported syntax, canonical serialization, source preservation, and editor verification.
- [Web 本地草稿](docs/web-drafts.md): preview-only storage, recovery, failure handling, and verification.
- [服务端 SQLite 连接基础](docs/server-storage.md): connection policy, process ownership, compatibility refusal, optional identity startup, and verification.
- [服务端读取数据访问层](docs/server-repositories.md): owner-scoped queries, validated IDs, bounded folder pagination, and verification; note HTTP integration and write APIs remain pending.
- [服务端密码与管理员初始化基础](docs/server-identity.md): bounded Argon2id verification, transactional one-time bootstrap, fresh schema compatibility, and tests.
- [Web 初始化、登录与会话](docs/web-identity.md): explicit local setup, secure production boundaries, cookie/CSRF policy, throttling, restart behavior and current limitations.
- [服务端数据库备份与恢复](docs/server-backup.md): current-schema snapshots, strict integrity manifests and new-directory restore; attachments and automated migrations remain pending.

These documents derive from the OpenSpec planning baseline; they do not indicate that implementation is complete or the proposal has been approved.
