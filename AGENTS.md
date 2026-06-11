# Snaptium Agent Instructions

This file is the short, always-loaded entrypoint for AI coding agents.

## Reference rule files

Follow these files when they are relevant to the task:

* `CLAUDE.md` — coding behavior: think first, keep changes simple, make surgical edits, and verify.
* `docs/DevGuide.md` — Snaptium architecture, TypeScript rules, Electron boundaries, IPC, i18n, service layering, testing, and release checks.

Do not copy the full contents of those files here. Read them when the task touches their scope.

## Core behavior

* Read the relevant project files before answering code questions or making changes.
* Do not guess from memory.
* State important assumptions before implementing.
* If ambiguity affects architecture, data safety, security, public behavior, or user data, ask before changing.
* For low-risk implementation details, choose the smallest reasonable solution and mention the assumption.
* Make the minimum necessary change.
* Do not add features that were not requested.
* Do not refactor unrelated code.
* Do not reformat unrelated files.
* Match the existing style of the touched files.
* Remove only unused code introduced by your own changes.

## Snaptium architecture rules

* Snaptium is an Electron + Vue 3 + TypeScript app.
* Respect the Electron layer boundary: Renderer → Preload/Bridge → Main.
* Renderer must not access Node.js APIs directly.
* Renderer must use `window.electronAPI` for system capabilities.
* IPC channels must be centralized in `electron/main/constants/ipc.constants.ts`.
* IPC input must be validated at the boundary.
* Main process services provide system capabilities.
* Renderer services should handle business orchestration.
* Avoid duplicate logic. Reuse existing `utils`, `services`, `shared`, or `core` code before adding new helpers.

## TypeScript rules

* Do not use `@ts-ignore`.
* Avoid `@ts-expect-error`; use it only when there is a clear boundary reason.
* Do not use `any`.
* Use `unknown` only at boundaries such as IPC input, third-party responses, or caught errors, and narrow it immediately.
* Add explicit types for business interfaces, IPC input/output, service returns, store state, and API responses.

## i18n rules

* Do not hardcode user-visible text.
* Use the existing i18n system.
* When adding or changing UI text, update the Simplified Chinese locale files consistently.
* Do not add or modify other locale files unless explicitly requested.

## Verification

After changes, run the smallest relevant verification command:

* Main process changes: `npm run build:main`
* Preload changes: `npm run build:preload`
* Renderer or shared TypeScript changes: `npm run typecheck`
* Lint-sensitive changes: `npm run lint`
* Logic changes with existing tests: run the relevant unit test or `npm run test:unit`

If verification cannot be run, say why and state what should be run manually.

## Skills

* When polishing website or frontend UI, read and apply `.codex/skills/ui-polish/SKILL.md`.
