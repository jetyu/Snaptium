## ADDED Requirements

### Requirement: Provider-aware AI Sources
系统 SHALL 以明确的 Provider 类型保存 AI Source，并由 Provider 决定默认 endpoint、LangChain 适配器与支持能力。

#### Scenario: 创建 SiliconFlow 来源
- **WHEN** 用户选择 SiliconFlow 并填写有效 API Key
- **THEN** 系统使用 SiliconFlow 默认 endpoint 创建来源，并允许发现 chat、embedding 与 reranker 模型

#### Scenario: 通用兼容来源
- **WHEN** 用户选择 OpenAI-compatible
- **THEN** 系统要求自定义 endpoint，并使用中性 Provider 身份而不是 OpenAI 品牌

### Requirement: Provider Connection Validation
系统 SHALL 在 Main 边界使用用户手动填写的模型名称验证 Provider 连接与所选模型能力。

#### Scenario: 手动填写模型名称
- **WHEN** 用户创建或编辑任一 Provider 的来源
- **THEN** 系统显示普通模型名称输入框，不请求或显示 Provider 模型列表

#### Scenario: Agent 模型缺少 Tool Calling
- **WHEN** 用户为 Agent 选择不支持 Tool Calling 的模型
- **THEN** 系统阻止该配置用于 Agent，并返回可操作的验证错误

### Requirement: Provider Presentation
系统 SHALL 在 AI Source 卡片与 Provider 选择器中使用一致的 Provider 文字名称，并且不显示供应商 Logo。

#### Scenario: SiliconFlow 托管模型
- **WHEN** SiliconFlow 来源选择 DeepSeek 或 Qwen 模型
- **THEN** 系统以文字显示 SiliconFlow Provider 与具体模型名称

#### Scenario: 未知 Provider
- **WHEN** 来源 Provider 无法识别
- **THEN** 系统显示中性 Provider 文字和来源名称

#### Scenario: 离线显示
- **WHEN** 应用无法联网
- **THEN** 所有 Provider 仍以文字名称正常显示，不依赖远程品牌资源

### Requirement: Secure AI Source Storage
系统 MUST 将 API Key 保留在现有受控设置与 Main 调用边界，不得通过 Knowledge Copilot 设置或日志暴露明文。

#### Scenario: Copilot 选择来源
- **WHEN** Renderer 为某模型角色选择 AI Source
- **THEN** Renderer 仅保存 sourceId 与 modelId，Main 在执行时解析凭据

### Requirement: Existing Source Migration
系统 SHALL 在保留来源身份与凭据的情况下为旧 AI Sources 补充 Provider。

#### Scenario: 迁移已知 endpoint
- **WHEN** 旧来源 endpoint 匹配 OpenAI 或 SiliconFlow 官方地址
- **THEN** 系统分别迁移为 openai 或 siliconflow

#### Scenario: 迁移其他 endpoint
- **WHEN** 旧来源 endpoint 不匹配已知 Provider
- **THEN** 系统迁移为 openai-compatible 并保留原 endpoint
