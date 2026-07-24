## Why

现有 Knowledge Agent 只在 agent loop 中部分使用 LangChain，索引、检索、设置与产品命名仍分散且缺少明确的 Provider 身份。需要以 Knowledge Copilot 为统一边界重建 Ask 与 Agent 两种模式，并让 AI Sources 以可识别、可验证的供应商配置支持多模型能力。

## What Changes

- **BREAKING** 将 `knowledge-agent` 产品与代码边界替换为 `knowledge-copilot`，删除旧知识库首选项和旧功能数据。
- 使用 LangChain/LangGraph 统一索引、检索、问答、agent 工具编排、HITL 与当前应用进程内的会话状态。
- 保留 LanceDB，并通过 LangChain VectorStore 适配器和增量记录管理维护全部有效笔记索引。
- 提供同页面 Knowledge Ask 与 Knowledge Agent；Agent 支持 confirm/auto，但破坏性工作区动作始终确认且不允许永久删除。
- 扩展 AI Sources Provider：OpenAI、OpenAI-compatible、SiliconFlow、Anthropic、Google Gemini、Ollama、Cohere。
- 为 Provider 增加本地品牌 Logo 注册表，在来源卡片、Provider 选择器和 Knowledge Copilot 来源选择中一致展示。
- 新增 Knowledge Copilot 首选项，集中选择 Ask、Agent、Embedding、Reranker 模型并管理索引。
- 迁移已有 AI Sources；清理旧 Knowledge Agent 设置、会话和索引，但保留笔记与凭据。

## Capabilities

### New Capabilities

- `knowledge-copilot`: Knowledge Ask、Knowledge Agent、索引、进程内会话状态、HITL 和安全笔记工具的统一能力。
- `ai-provider-sources`: 多 Provider AI Source 配置、能力发现、品牌呈现、连接验证与安全迁移。

### Modified Capabilities

- 无。

## Impact

- Renderer settings、search/workbench 与新的 `features/knowledge-copilot`。
- Main knowledge services、AI configuration/provider factories、LanceDB persistence。
- Preload、Renderer bridge、IPC constants 和输入验证。
- Settings schema、迁移、简体中文与相关品牌 locale keys。
- LangChain provider integrations、LangGraph in-memory checkpoint/interrupt 与文本切分依赖。
