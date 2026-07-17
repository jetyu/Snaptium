## ADDED Requirements

### Requirement: Knowledge Copilot Preferences
系统 SHALL 用独立 Knowledge Copilot 首选项替换旧知识库面板，并为 Ask Chat、Agent Chat、Embedding 与可选 Reranker 分别选择来源和模型。

#### Scenario: 首次启动未配置
- **WHEN** 用户尚未选择 Embedding 来源与模型
- **THEN** 系统显示未配置状态且不启动索引，并引导用户前往 Knowledge Copilot 首选项

#### Scenario: 删除正在使用的来源
- **WHEN** 用户删除被 Knowledge Copilot 使用的 AI Source
- **THEN** 系统清空受影响角色配置并显示需要重新配置

### Requirement: Automatic Knowledge Index
系统 SHALL 使用 LangChain Document、文本切分器、RecordManager 与 LanceDB VectorStore 适配器，对全部有效笔记进行后台增量索引。

#### Scenario: 笔记更新
- **WHEN** 有效笔记内容发生变化
- **THEN** 系统自动替换该笔记的旧 chunks，且其他笔记索引不受影响

#### Scenario: 笔记进入回收站
- **WHEN** 笔记被软删除
- **THEN** 系统从当前可检索索引移除其 chunks

#### Scenario: Embedding 配置变化
- **WHEN** Embedding Provider、模型或维度发生变化
- **THEN** 系统创建新的索引世代并后台重建全部有效笔记

### Requirement: Knowledge Ask
系统 SHALL 在 Knowledge Ask 中固定执行向量召回、可选重排和基于来源回答，并返回可定位的来源。

#### Scenario: 正常回答
- **WHEN** 检索证据充分且 Ask Chat 已配置
- **THEN** 系统仅基于返回的知识 chunks 生成回答并附带来源

#### Scenario: 无 Chat 模型
- **WHEN** 检索成功但 Ask Chat 未配置或不可用
- **THEN** 系统返回来源内容 fallback，而不生成无来源回答

#### Scenario: 同线程追问
- **WHEN** 用户在同一 Knowledge Copilot 线程内提出省略实体或代词的追问
- **THEN** 系统使用受限的近期对话上下文将问题改写为独立检索查询，并且仅将本次检索到的笔记作为事实证据

#### Scenario: 长会话摘要
- **WHEN** 同一线程已超过六个完成回合
- **THEN** 系统自动维护早期回合摘要，并将摘要与最近六个回合用于 Ask 和 Agent 上下文

### Requirement: Knowledge Agent
系统 SHALL 使用 LangGraph 和进程内 checkpoint 执行 Knowledge Agent，并允许知识检索及受控笔记管理工具。

#### Scenario: 当前会话恢复
- **WHEN** 用户在当前应用进程内对同一 conversation 的 Agent 中断步骤进行确认或编辑
- **THEN** 系统恢复该 Agent thread 的 checkpoint

#### Scenario: 应用重启
- **WHEN** 用户重启应用
- **THEN** 系统不恢复运行中的 Agent checkpoint

#### Scenario: Confirm 工具调用
- **WHEN** confirm 模式中的 Agent 准备执行会改变工作区的工具
- **THEN** graph 中断并等待用户批准、编辑或拒绝该步骤

#### Scenario: Auto 创建与更新
- **WHEN** auto 模式中的 Agent 调用创建或更新笔记工具
- **THEN** 系统可自动执行并记录 trace

#### Scenario: 高风险动作仍确认
- **WHEN** auto 模式中的 Agent 调用重命名、移动、移入回收站或恢复工具
- **THEN** graph MUST 中断并等待用户明确批准

#### Scenario: 禁止永久删除
- **WHEN** Agent 请求永久删除笔记
- **THEN** 系统拒绝该操作，且不存在可调用的永久删除工具

### Requirement: Knowledge Copilot Electron Boundary
系统 SHALL 仅通过 `window.electronAPI.knowledgeCopilot` 暴露索引、Ask、Agent、确认与会话能力，并在 Main IPC 边界验证输入。

#### Scenario: Renderer 发起 Ask
- **WHEN** Renderer 提交 Ask 请求
- **THEN** Preload 只转发类型化 DTO，Main 验证后执行 LangChain 流程

### Requirement: Knowledge Data Reset
系统 SHALL 在迁移到 Knowledge Copilot 时清理旧 Knowledge Agent 设置、会话与向量索引，同时保留笔记和迁移后的 AI Sources。

#### Scenario: 升级启动
- **WHEN** 应用首次加载 Knowledge Copilot schema
- **THEN** 系统执行一次幂等清理并标记迁移版本
