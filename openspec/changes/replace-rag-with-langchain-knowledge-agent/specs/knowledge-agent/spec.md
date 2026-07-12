## ADDED Requirements

### Requirement: Knowledge Agent 配置
系统 SHALL 暴露 `knowledgeAgent` 配置，用于启用该能力并选择 embedding、chat 和 reranker 模型服务。

#### Scenario: 替换后能力处于未配置状态
- **WHEN** 应用在没有 `knowledgeAgent` 配置的情况下启动
- **THEN** 系统将 knowledge-agent 能力视为禁用或未配置，直到用户完成配置

#### Scenario: 不使用旧 RAG 配置
- **WHEN** 系统中只存在旧 `rag` 配置值
- **THEN** 系统 MUST NOT 使用这些值初始化 knowledge-agent 能力

### Requirement: 知识库索引
系统 SHALL 使用已配置的 embedding 模型服务，基于笔记内容构建和维护知识库向量索引。

#### Scenario: 索引笔记内容
- **WHEN** 一个有效笔记以非空内容进入索引流程
- **THEN** 系统对内容分块、生成 embeddings，并存储与该笔记关联的可检索知识块

#### Scenario: 删除笔记索引
- **WHEN** 一个笔记需要从知识库索引中移除
- **THEN** 系统删除与该笔记关联的已索引 chunks

#### Scenario: 从零重建索引
- **WHEN** 用户触发 knowledge-agent 全量索引重建
- **THEN** 系统清空当前 knowledge-agent 索引，并基于当前笔记内容重新创建 chunks

### Requirement: 知识库检索
系统 SHALL 通过语义向量搜索和可选 rerank 获取知识库证据，不得通过普通本地笔记搜索获取。

#### Scenario: 语义检索返回证据
- **WHEN** 用户提出知识问题，或 agent 调用知识搜索工具
- **THEN** 系统使用 embeddings 搜索知识库索引，并返回带分数和笔记元数据的匹配笔记 chunks

#### Scenario: 排除本地搜索
- **WHEN** 执行知识库检索
- **THEN** 系统 MUST NOT 调用普通本地笔记搜索服务作为 fallback 检索路径

### Requirement: 基于证据的知识库问答
系统 SHALL 使用检索到的知识库证据回答问题；当已索引知识库无法支持回答时，系统 SHALL 返回证据不足结果。

#### Scenario: 基于充足证据回答
- **WHEN** 检索到的知识 chunks 满足证据策略，且已配置 chat 模型
- **THEN** 系统返回基于这些 chunks 的回答，并包含来源 chunks

#### Scenario: 无 chat 模型时返回来源 fallback
- **WHEN** 检索到的知识 chunks 满足证据策略，但未配置 chat 模型
- **THEN** 系统返回相关来源内容作为 fallback，并标记使用了 fallback

#### Scenario: 拒绝无证据回答
- **WHEN** 检索到的知识 chunks 不满足证据策略
- **THEN** 系统返回证据不足结果，并且不生成无依据断言

### Requirement: LangChain Agent 任务执行
系统 SHALL 通过基于 LangChain 的 agent 执行 agent-task 模式，并允许调用已批准的 knowledge-agent tools。

#### Scenario: Agent 使用知识搜索工具
- **WHEN** agent 任务需要从用户笔记中获取信息
- **THEN** agent 可以调用由知识库检索路径支持的 `searchKnowledgeBase` tool

#### Scenario: Agent 读取和列出笔记
- **WHEN** agent 任务需要工作区上下文
- **THEN** agent 可以调用已批准的笔记工具来列出最近笔记并读取笔记内容

#### Scenario: Confirm 模式生成写入建议
- **WHEN** agent 任务写入模式为 confirm
- **THEN** agent 返回创建或更新笔记的建议，而不直接写入笔记内容

#### Scenario: Auto 模式执行写入
- **WHEN** agent 任务写入模式为 auto，且证据策略允许写入
- **THEN** agent 可以通过已批准的工作区写入工具创建或更新笔记

### Requirement: 现有搜索 UI 重定向
系统 SHALL 保持当前知识搜索 UI 布局和模式不变，同时将其服务调用重定向到 `knowledge-agent`。

#### Scenario: QA 模式保持可用
- **WHEN** 用户在现有搜索 UI 中选择 QA 模式
- **THEN** UI 通过 knowledge-agent QA API 发送请求，并在现有布局中展示回答和来源

#### Scenario: Agent task 模式保持可用
- **WHEN** 用户在现有搜索 UI 中选择 agent-task 模式
- **THEN** UI 通过 knowledge-agent task API 发送请求，并在现有布局中展示最终回答、步骤、trace、来源和写入建议

### Requirement: 移除旧 RAG 表面
系统 SHALL 移除旧 RAG 命名的产品与代码表面，不保留兼容别名。

#### Scenario: IPC channel 使用 knowledge-agent 命名
- **WHEN** Renderer 或 Preload 调用 knowledge-agent 能力 API
- **THEN** 系统使用 `knowledge-agent:*` IPC channels，并且不暴露 `rag:*` IPC channels

#### Scenario: Bridge API 使用 knowledgeAgent
- **WHEN** Renderer 代码通过 Electron bridge 调用 knowledge-agent 功能
- **THEN** 可用 bridge namespace 为 `knowledgeAgent`，而不是 `rag`

#### Scenario: Renderer feature 使用 knowledge-agent
- **WHEN** Renderer 模块导入 knowledge-agent 能力
- **THEN** 它们从 `features/knowledge-agent` 导入，而不是从 `features/rag` 导入
