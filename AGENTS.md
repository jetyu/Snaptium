# Greenfield Notes Agent Instructions

This branch contains a new product architecture. Do not restore or copy the legacy Electron application unless a reviewed OpenSpec change explicitly requires a targeted migration.

## Source of truth

- Read `openspec/changes/add-self-hosted-notes-platform/` before planning implementation.
- Use OpenSpec for architecture, workflow, synchronization, security, or other medium-to-large changes.
- Keep proposal work separate from implementation work.

## Product boundaries

- The Docker application serves both the Vue Web client and the Axum API.
- Tauri 2 native clients reuse the Vue UI and access native capabilities through validated coarse-grained Rust commands.
- Server and native clients use separate SQLite schemas and never exchange database files.
- Markdown is the canonical portable content format.
- The initial release does not include E2EE, collaboration, CRDT, PostgreSQL, or a complete Web offline replica.

## Engineering rules

- Use strict TypeScript and Rust types; do not use `any` or bypass compiler errors.
- Validate all HTTP, WebSocket, Tauri-command, file, import, and configuration boundaries.
- Keep secrets, credentials, note content, and tokens out of logs.
- Do not expose arbitrary SQL, unrestricted filesystem access, or remote UI loading to the Tauri WebView.
- Keep server rows, native-client rows, repositories, and migrations separate from shared wire/domain types.
- Preserve user data under retries, crashes, stale revisions, interrupted pulls, migrations, and rollback.
- Use the existing i18n system once established; do not hardcode user-visible text.
- Make the minimum change required by the active OpenSpec task and avoid speculative infrastructure.

## Verification

Until the workspace is scaffolded, use `openspec-cn validate <change> --strict` for specification changes. Each implementation task must add the smallest relevant Rust, TypeScript, integration, Docker, or packaging verification command to the project documentation and CI.
