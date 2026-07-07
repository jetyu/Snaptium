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

User-level skills may be available from `~/.codex/skills`.

Use relevant skills only. Do not load or apply every skill automatically.

### OpenSpec

Use the `openspec` skill for medium or large feature changes, architecture changes, workflow changes, or changes that need a proposal, design, task list, or acceptance criteria.

Do not use OpenSpec for small fixes such as copy changes, simple UI tweaks, i18n text edits, dependency bumps, or trivial bug fixes unless explicitly requested.

When using the `openspec` skill:

* First create an OpenSpec change only.
* Do not modify business code during the proposal phase.
* Generate proposal, design, tasks, and spec delta as needed.
* Keep the change scoped.
* Avoid unrelated refactoring.
* Wait for confirmation before implementation unless the user explicitly asks to implement immediately.
* After implementation, validate the OpenSpec change and run the smallest relevant project verification command.

### Skill hints

Use these skills only when they clearly match the current task:

* Vue / frontend: `vue3`, `vue-router`, `vue-router-v4`, `pinia`, `vant-vue3`
* UI / design: `design`, `design-system`, `ui-styling`, `ui-ux-pro-max`, `banner-design`, `brand`
* Electron: `electron`
* Cloudflare / Workers / R2: `cloudflare`, `workers-best-practices`, `wrangler`, `durable-objects`, `cloudflare-email-service`
* Performance: `web-perf`
* Release / update links: `upgradelink`
* SDK / agent work: `agents-sdk`, `sandbox-sdk`
* Unsure which skill to use: `find-skills`

Do not use every skill automatically. Only read and apply skills that are clearly relevant to the task.