# Self-hosted Notes Platform

This branch is the greenfield planning baseline for a self-hosted, local-first Markdown notes product.

The target product provides:

- a Docker deployment containing the Web client and API server;
- a Windows client built with Tauri 2;
- WYSIWYG authoring with portable Markdown as the canonical format;
- offline native storage and versioned incremental synchronization;
- user-controlled export, backup, restore, and upgrade recovery.

No production application code has been scaffolded yet. The approved scope, architecture, requirements, and implementation tasks live in:

`openspec/changes/add-self-hosted-notes-platform/`

Implementation should begin through the OpenSpec apply workflow after the proposal is reviewed.

## Engineering documentation

- [技术架构](docs/technical-architecture.md): target components, boundaries, synchronization, security, and recovery.
- [开发规约](docs/development-guidelines.md): implementation rules, verification, CI, and review requirements.

These documents derive from the OpenSpec planning baseline; they do not indicate that implementation is complete or the proposal has been approved.
