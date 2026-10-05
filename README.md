# Self-hosted Notes Platform

This branch is the greenfield planning baseline for a self-hosted, local-first Markdown notes product.

The target product provides:

- a Docker deployment containing the Web client and API server;
- a Windows client built with Tauri 2;
- WYSIWYG authoring with portable Markdown as the canonical format;
- offline native storage and versioned incremental synchronization;
- user-controlled export, backup, restore, and upgrade recovery.

The Web/server foundation and shared Markdown editor preview have been scaffolded. Server-only SQLite, read repositories, password verification and administrator-bootstrap modules are tested but not wired into HTTP startup. Web login, server note saving, and native clients are not implemented yet. Web preview edits are saved as browser-local IndexedDB drafts, with explicit recovery into a new copy. These drafts are not server commits or a complete offline replica, and browser storage is not a backup. The planned scope, architecture, requirements, and implementation tasks live in:

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
- [服务端 SQLite 连接基础](docs/server-storage.md): connection policy, process ownership, compatibility refusal, and verification; not yet wired into HTTP startup.
- [服务端读取数据访问层](docs/server-repositories.md): owner-scoped queries, validated IDs, bounded folder pagination, and verification; no authentication or write API yet.
- [服务端密码与管理员初始化基础](docs/server-identity.md): bounded Argon2id verification, transactional one-time bootstrap, fresh schema compatibility, and tests; no HTTP login or sessions yet.

These documents derive from the OpenSpec planning baseline; they do not indicate that implementation is complete or the proposal has been approved.
