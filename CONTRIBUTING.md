# Contributing to Snaptium / 参与贡献

Thank you for your interest in contributing to Snaptium. This guide explains how to propose changes safely and consistently.

感谢你有兴趣参与 Snaptium。本指南说明如何安全、一致地提交改动。

## Before You Start / 开始之前

- Read the project README to understand Snaptium's goals and feature scope.
- Search existing issues and pull requests to avoid duplicate work.
- For large features, architecture changes, data migration, security-sensitive work, or user-data behavior changes, open an issue first and wait for maintainer feedback.
- Keep changes focused. Avoid unrelated refactors or formatting-only edits.

- 阅读项目 README，了解 Snaptium 的目标和功能范围。
- 搜索已有 Issue 和 Pull Request，避免重复工作。
- 对于大型功能、架构变更、数据迁移、安全敏感改动或影响用户数据的行为，请先创建 Issue 并等待维护者反馈。
- 保持改动聚焦，避免无关重构或纯格式化改动。

## Development Setup / 开发环境

Snaptium is an Electron + Vue 3 + TypeScript application.

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build:main
npm run build:preload
npm run typecheck
npm run lint
npm run test:unit
```

## Architecture Guidelines / 架构约定

Please follow the repository's architecture and development rules:

- Renderer code must not access Node.js APIs directly.
- Use `window.electronAPI` for renderer-to-system capabilities.
- Keep IPC channel names centralized in `electron/main/constants/ipc.constants.ts`.
- Validate IPC input at the boundary.
- Put system capabilities in main-process services.
- Keep renderer services responsible for business orchestration.
- Reuse existing `utils`, `services`, `shared`, or `core` code before adding new helpers.
- Do not hardcode user-visible UI text; use the existing i18n system and update Simplified Chinese locale files when adding or changing UI text.

请遵循仓库的架构与开发规则：

- Renderer 不得直接访问 Node.js API。
- Renderer 如需系统能力，应通过 `window.electronAPI`。
- IPC channel 名称统一维护在 `electron/main/constants/ipc.constants.ts`。
- IPC 输入必须在边界校验。
- 系统能力应放在 Main 进程服务中。
- Renderer service 负责业务编排。
- 新增 helper 前，优先复用已有 `utils`、`services`、`shared` 或 `core` 代码。
- 不要硬编码用户可见 UI 文案；应使用现有 i18n 系统，新增或修改 UI 文案时同步更新简体中文 locale 文件。

## TypeScript Guidelines / TypeScript 规则

- Do not use `@ts-ignore`.
- Avoid `@ts-expect-error`; use it only for a clearly documented boundary reason.
- Do not use `any`.
- Use `unknown` only at boundaries, then narrow it immediately.
- Add explicit types for business interfaces, IPC input/output, service returns, store state, and API responses.

## Commit and Pull Request Expectations / 提交与 Pull Request 要求

Before opening a pull request:

1. Keep the pull request scoped to one purpose.
2. Update documentation when behavior, setup, or user-facing functionality changes.
3. Add or update tests when changing logic with existing test coverage.
4. Run the smallest relevant verification command for your change.
5. Fill out the pull request template completely.

创建 Pull Request 前：

1. 确保 Pull Request 聚焦于单一目的。
2. 当行为、配置方式或用户可见功能变化时，同步更新文档。
3. 修改已有测试覆盖的逻辑时，新增或更新测试。
4. 根据改动范围运行最小必要验证命令。
5. 完整填写 Pull Request 模板。

## Security / 安全

Do not report security vulnerabilities in public issues. Follow the repository security policy and use GitHub Security Advisory for responsible disclosure.

请不要在公开 Issue 中报告安全漏洞。请遵循仓库安全策略，通过 GitHub Security Advisory 进行负责任披露。

## License / 许可

By contributing to Snaptium, you agree that your contributions are submitted under the repository's Apache-2.0 license unless explicitly stated otherwise.

向 Snaptium 提交贡献即表示你同意相关贡献默认遵循仓库的 Apache-2.0 许可证，除非另有明确说明。
