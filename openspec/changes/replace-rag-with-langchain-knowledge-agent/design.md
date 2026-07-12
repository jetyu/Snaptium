## Context

Snaptium 当前通过 `rag` 命名暴露知识库能力，这个命名横跨 Renderer service、Preload API、IPC channel、Main service、prompt、settings 和 license 检查。当前实现已经在搜索 UI 中支持两种用户模式：知识库问答和 agent 任务执行。但问答编排位于 RAG IPC 模块中，agent 任务执行位于手写的 Main 进程 tool loop 中，并且仍依赖 `ragService`。

目标产品边界是 `knowledge-agent`：一个知识库智能助手能力，负责索引、语义检索、基于证据的问答和 agent 执行。普通本地笔记搜索不属于这个能力。

## Goals / Non-Goals

**Goals:**

- 将旧 `rag` 命名替换为 `knowledge-agent` 命名，覆盖代码、IPC、bridge API、settings、prompt 和用户可见文案。
- 保持当前 UI 布局和交互模型不变。
- 保留两种模式：知识库问答、agent 任务执行。
- 使用 LangChain 作为模型/tool 编排的核心 agent 框架。
- 让已索引知识库检索继续作为 QA 和知识搜索工具的证据来源。
- 将旧 RAG 设置和旧向量索引视为废弃数据，不提供兼容别名或迁移逻辑。

**Non-Goals:**

- 不重新设计搜索 UI。
- 不把普通本地笔记搜索合并进 `knowledge-agent`。
- 不保留 `rag:*` IPC channel、`electronAPI.rag`、`config.rag` 或 `src/renderer/features/rag` 兼容导出。
- 不迁移现有 `.lancedb` 索引内容或旧 RAG 配置值。
- 不新增网络知识源、Web 搜索或非笔记知识连接器。

## Decisions

### Decision: 硬替换 `rag` 为 `knowledge-agent`

采用破坏性重命名，不做兼容 shim。实现时应删除旧 RAG 入口，并在每一层引入新命名：

- `knowledge-agent:*` IPC channels。
- `electronAPI.knowledgeAgent` preload bridge。
- `electronApi.knowledgeAgent` renderer bridge facade。
- `src/renderer/features/knowledge-agent`。
- Main 进程 `knowledge-agent` IPC 和 services。
- `config.knowledgeAgent` settings 结构。

备选方案：在过渡期保留旧 `rag` API 作为 alias。该方案被拒绝，因为当前目标是全新开始，不需要旧命名策略。

### Decision: 拆分检索/索引与 agent 执行

新能力应在同一产品边界内拆分系统职责：

```text
knowledge-agent
  |-- knowledge index service
  |   `-- chunk notes, generate embeddings, write vector store
  |-- knowledge retrieval service
  |   `-- semantic search, rerank, evidence assessment
  |-- knowledge QA service
  |   `-- retrieve evidence, answer from evidence, fallback to sources when no chat model
  `-- knowledge task agent service
      `-- LangChain agent with approved tools
```

备选方案：只创建一个大的 `knowledge-agent.service.ts`。该方案被拒绝，因为索引、检索、QA 和 agent 执行有不同的失败模式和测试表面。

### Decision: LangChain 负责 agent 编排，Snaptium 负责工具和边界

LangChain 应替换当前 agent 任务执行中的手写 model/tool loop。Snaptium 仍负责：

- AI source 和 license 解析。
- Electron IPC 输入校验。
- VFS 读写操作。
- 证据评估策略。
- 现有 UI 使用的返回结构。
- 持久化到 workbench 历史中的 trace 和 step 归一化。

LangChain 集成应基于现有 OpenAI-compatible 模型配置做适配，不应让 Renderer 输入直接接触 LangChain。

备选方案：保留自定义 tool loop，只做命名替换。该方案被拒绝，因为目标架构要求以 LangChain 为核心。

### Decision: 知识工具不得使用普通本地搜索

agent 的 `searchKnowledgeBase` tool 必须使用已索引知识库检索路径，不得调用现有普通本地搜索服务。`listRecentNotes`、`readNote`、创建/更新笔记等直接笔记工具仍可用于 agent 执行，因为它们是笔记工作区动作，不是本地搜索 fallback。

备选方案：语义检索较弱时 fallback 到本地搜索。该方案被拒绝，因为新能力范围是知识库 RAG 行为，而不是本地检索。

### Decision: 不迁移 settings 或 vector index

实现应引入新的 `knowledgeAgent` settings 对象，并忽略旧 `rag` settings。旧 RAG 索引位置下的向量数据视为废弃，可以清理，也可以保持未使用。

备选方案：迁移 `config.rag` 到 `config.knowledgeAgent`。该方案被拒绝，以保持替换语义清晰、干净。

## Risks / Trade-offs

- **既有用户会丢失 RAG 配置** -> 设置 UI 应把新能力显示为未配置，直到用户重新配置 embedding/chat/reranker source。
- **既有索引会变成未使用数据** -> 在新能力下重建索引；不要读取旧索引表或依赖旧路径。
- **LangChain 包行为可能不匹配当前 trace/result shape** -> 用 wrapper 包住 tool 和模型调用，将 `steps`、`traceEvents`、`sources`、`pendingWrites`、`executedWrites` 归一化后再返回 UI。
- **license entitlement 可能外部仍叫 `rag`** -> 实现阶段决定是否能把内部 runtime feature ID 也改名；如果会破坏授权 payload，则保留 entitlement ID 作为计费/运行时兼容细节，但产品和代码可见命名仍移除 RAG。
- **硬删除增加改动面** -> 分层实现并在每个主要阶段运行 main、preload、renderer typecheck 和相关单元测试。

## Migration Plan

1. 新增 LangChain 依赖，并为现有 AI source 配置创建 Main 进程适配层。
2. 创建新的 `knowledge-agent` Main 进程 services 和 IPC handlers。
3. 将 Preload 与 Renderer bridge API 替换为 `knowledgeAgent`。
4. 创建 `src/renderer/features/knowledge-agent`，并在不改 UI 布局的前提下重定向现有搜索 UI。
5. 替换 settings key 和简体中文 locale 文案。
6. 删除旧 `rag` Renderer feature、IPC module、channels、service names、prompts 和过期 constants。
7. 运行最小相关验证命令：`npm run build:main`、`npm run build:preload`、`npm run typecheck`，如有相关测试则运行聚焦测试。

不预期通过兼容代码回滚。如果实现阶段在发布前失败，应回退该变更分支，而不是支持 RAG 与 knowledge-agent 混合 API。

## Open Questions

- license entitlement 标识是否也从 `rag` 改成 `knowledgeAgent`，还是保留为内部计费兼容 ID，同时移除所有产品/代码可见 RAG 命名？
- 新向量索引是否复用现有 `.lancedb` 目录并使用新表名，还是使用 knowledge-agent 专属存储路径？
- Electron Main 中 OpenAI-compatible 模型适配应使用哪组 LangChain 包：`langchain` + `@langchain/openai`，还是基于现有 `remoteAiService` 实现自定义 `BaseChatModel` adapter？
