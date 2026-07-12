## Why

当前知识库能力在 Renderer、Preload、IPC、Main Service、配置和文案中仍使用 `rag` 命名，同时把向量索引、知识库问答和 agent 任务执行混在同一边界里。这会让产品概念不清晰，也让 agent 运行时继续绑定在手写 tool loop 上，而不是一个明确的 agent 框架。

## What Changes

- **BREAKING** 使用新的 `knowledge-agent` 能力边界替换现有 RAG 功能边界。
- **BREAKING** 删除旧 `rag` 代码命名、IPC channel、bridge API、Renderer feature 导出、配置 key 和用户可见文案 key，不保留兼容别名。
- 引入 `knowledge-agent` 作为知识库索引、知识库问答和 agent 任务执行的统一产品能力。
- 保持当前搜索 UI 的行为和布局不变，仅把服务调用重定向到新的 `knowledge-agent` Renderer facade。
- 使用 LangChain 作为 agent 任务执行和 tool 编排的核心框架。
- 保留知识库约束：QA 和知识工具必须使用已索引的知识库，而不是普通本地笔记检索。
- 将现有 RAG 配置和向量索引视为废弃数据；用户需要在新能力下重新配置并重建索引。

## Capabilities

### New Capabilities

- `knowledge-agent`: 覆盖知识库索引、语义检索、基于证据的问答，以及基于 LangChain 的 agent 任务执行；数据来源是已索引知识库和允许的笔记工具。

### Modified Capabilities

- 无。

## Impact

- 影响 Renderer 区域：`src/renderer/features/rag`、`src/renderer/features/search`、设置集成，以及保存 agent 元数据的 workbench 历史类型。
- 影响 Electron Bridge 区域：`src/renderer/core/bridge/electronApi.ts`、`electron/preload/src/initPreloadCore.ts`、`electron/main/constants/ipc.constants.ts`。
- 影响 Main Process 区域：RAG IPC handler、RAG service、agent service、AI config resolution、证据评估、prompt、vector-store 集成、license 检查、导入导出清理逻辑和 settings normalization。
- 预计需要新增 LangChain JavaScript 相关依赖。
- 不迁移现有 `config.rag.*` 设置和 `.lancedb` RAG 索引数据。
