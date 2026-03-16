# NoteWizard Scaffold (Electron + Vue 3 + CodeMirror 6 + Markdown-It)

你提到的这些能力（TypeScript / ESLint / Vitest / Pinia / Zod / Playwright）**非常适合企业级项目**，不仅适合学习，而且是长期维护的基础设施。

## 企业级路线（已落地在本仓库）

- ✅ TypeScript：建立 `tsconfig.json`，主入口与核心业务开始迁移到 TS
- ✅ ESLint：统一代码规范和潜在问题检查
- ✅ Vitest：单元测试框架
- ✅ Playwright：E2E 测试框架与配置
- ✅ Pinia：状态管理（文档状态已放入 store）
- ✅ Zod：IPC 入参 schema 校验
- ✅ Markdown 安全增强：允许 HTML 时进行白名单清洗

## 目录建议（可长期扩展）

```text
src/renderer/
├── app/
├── views/
├── layouts/
├── features/
│   ├── editor/
│   ├── workspace/
│   ├── preview/
│   └── settings/
├── shared/
│   ├── constants/
│   ├── utils/
│   ├── composables/
│   ├── services/
│   ├── components/
│   ├── directives/
│   ├── hooks/
│   └── types/
├── stores/
├── config/
└── router/

electron/main/
├── constants/
├── services/
├── utils/
└── ipc/
    ├── index.js
    ├── editor.js
    └── modules/
```

## 命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## 学习顺序（企业实战导向）

1. 先看 `stores/documentStore.ts` + `composables/useEditorDocument.ts`（状态流）
2. 再看 `electron/preload/index.js` + `electron/main/ipc/editor.js`（安全边界 + schema）
3. 再看 `core/markdown/markdownService.ts`（安全渲染）
4. 最后看 `tests/unit` 与 `tests/e2e`（测试闭环）
