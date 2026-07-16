## Context

当前实现已将旧 RAG 重命名为 Knowledge Agent，并用 LangChain `createAgent` 替换部分手写循环，但索引、检索、向量存储、会话和写入确认仍是自定义实现。AI Sources 只有 endpoint/model/capabilities，没有 Provider 身份，因此无法可靠选择适配器或呈现品牌。该变更横跨 Electron Main、Preload、Renderer、SQLite、LanceDB、设置和迁移。

## Goals / Non-Goals

**Goals:**

- 统一产品与代码名称为 Knowledge Copilot，并保留同页面 Ask/Agent 模式。
- 使用 LangChain/LangGraph 完成检索、agent、checkpoint 与逐步确认。
- 保留 LanceDB，通过自定义 LangChain VectorStore 适配现有本地数据库。
- 用 Provider discriminator 驱动模型 factory、能力发现、连接测试和文字展示。
- 自动索引全部有效笔记，保护 API Key 和 Electron 边界。
- 对 Agent 工作区工具实施明确的 confirm/auto 安全策略。

**Non-Goals:**

- 不新增 Web 搜索、云知识连接器或永久删除工具。
- 不迁移旧知识索引、知识设置或会话内容。
- 不按具体模型维护 DeepSeek、Qwen 等二级品牌 Logo。
- 不改变服务端现有 `rag` entitlement wire value。

## Decisions

### Knowledge Copilot 是唯一产品边界

删除旧 Knowledge Agent 首选项、feature、IPC 与 bridge namespace，由 `knowledgeCopilot` 完整替换。服务端 entitlement 仅通过 `KNOWLEDGE_COPILOT: 'rag'` 兼容映射保留。相比双命名兼容层，该方案避免继续扩散旧接口。

### LangGraph 分离 Ask 与 Agent 图

Ask 图固定为 retrieve、rerank、answer 三阶段；无 Chat 模型时返回来源 fallback。Agent 图使用持久化 SQLite checkpointer、工具节点和 interrupt/resume 实现逐步确认。两个模式共享 conversation/thread 标识与消息存储，但不共享运行中 graph state。

### LanceDB 使用项目适配器

实现 `SnaptiumLanceVectorStore extends VectorStore`，封装现有 LanceDB 表、过滤与删除能力；不使用版本不匹配且生命周期能力不足的社区适配器。文本使用 LangChain Document 与 RecursiveCharacterTextSplitter，SQLite RecordManager 跟踪增量清理。

### VFS 事件驱动自动索引

应用启动完成一次 reconcile，之后监听创建、更新、重命名、移动、回收与恢复事件，按 note id 排队并去重。Embedding 配置或维度变化触发新索引世代和后台全量重建，旧世代只在新索引可用后清理。

### Provider discriminator 驱动集成

`AIProvider` 包含 `snaptium | openai | openai-compatible | siliconflow | google-gemini | ollama | openrouter | deepseek`。OpenRouter 与 DeepSeek 通过各自默认 baseURL 使用 OpenAI-compatible LangChain adapter；其他 Provider 使用对应集成。旧配置中的其他 Provider 在读取时按原 endpoint 降级为 `openai-compatible`。

### Provider 使用文字展示

Provider presentation registry 使用穷尽映射保存 label。AI Source 与 Knowledge Copilot 不展示供应商 Logo，避免品牌资源、商标和多套渲染分支；通用 OpenAI-compatible 使用中性文字名称。

### 设置职责分离

AI Sources 保存凭据、Provider、endpoint 与用户手动填写的模型名称；Knowledge Copilot 只保存四种角色的 sourceId/modelId、默认模式、自动索引和高级检索参数。Main 解析并验证来源，Renderer 不接触模型 SDK 或 Node API。

### Agent 写入策略

confirm 模式逐工具 interrupt。auto 模式仅自动允许 create/update；rename/move/trash/restore 始终 interrupt。永久删除不注册为工具。所有工具输入在 IPC/graph tool boundary 校验并写入审计 trace。

## Risks / Trade-offs

- [Provider SDK 增加包体积] → 仅安装已支持 Provider 的 LangChain integration，并延迟创建 client。
- [Embedding 变化造成向量维度冲突] → 使用索引世代隔离并要求重建完成后切换。
- [后台索引与笔记写入竞争] → 按 note id 串行化、基于内容 hash 去重并使用原子记录更新。
- [旧数据清理不可逆] → 仅清理知识设置、历史与索引；笔记和 AI Source 凭据先迁移再保存。

## Migration Plan

1. 扩展 settings schema，迁移 AI Sources：官方 OpenAI URL 映射 `openai`、SiliconFlow URL 映射 `siliconflow`、其余映射 `openai-compatible`。
2. 新增 Provider registry/factories、文字展示和连接验证能力。
3. 新增 Knowledge Copilot settings、Main services、SQLite persistence、IPC/bridge 与 Renderer feature。
4. 切换 search/workbench 与设置入口，启动新索引重建。
5. 删除旧 Knowledge Agent 代码、设置、历史和索引数据；保留 entitlement 映射。
6. 分层验证；若发布前失败，回退整个变更，而不是保留双运行时。

## Open Questions

- 无。Provider 使用文字展示；OpenAI 与通用 OpenAI-compatible 分离；默认 Ask、confirm 和自动索引均已确定。
