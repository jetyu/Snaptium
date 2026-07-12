## 1. 依赖与命名准备

- [x] 1.1 将所需 LangChain JavaScript 依赖加入 `package.json` 和 lockfile。
- [x] 1.2 定义新的 `knowledgeAgent` settings 结构和默认值。
- [x] 1.3 决定并记录 license entitlement 是继续内部映射旧 runtime feature ID，还是完全改名。
- [x] 1.4 决定新的向量索引存储路径/表名，并确保它不依赖旧 RAG 索引数据。

## 2. Main 进程 Knowledge-Agent Services

- [x] 2.1 创建 knowledge-agent index service，负责笔记分块、生成 embeddings、写入 chunks、删除笔记 chunks、清空索引和报告状态。
- [x] 2.2 创建 knowledge-agent retrieval service，负责语义搜索、可选 rerank 和证据评估。
- [x] 2.3 创建 knowledge-agent QA service，负责基于证据回答，以及未配置 chat 模型时的来源 fallback。
- [x] 2.4 使用基于 LangChain 的 task agent service 替换当前手写 agent task loop。
- [x] 2.5 实现已批准的 LangChain tools：`searchKnowledgeBase`、列出最近笔记、读取笔记、生成写入建议、执行写入。
- [x] 2.6 将 LangChain 执行输出归一化为现有 UI 需要的 answer、sources、steps、trace events、pending writes 和 executed writes 结果结构。
- [x] 2.7 如测试基础设施支持，为证据拒绝、本地搜索排除、写入模式行为和结果归一化补充或更新 Main 进程单元测试。

## 3. IPC 与 Bridge 替换

- [x] 3.1 将 `RAG_*` IPC constants 替换为 `KNOWLEDGE_AGENT_*` constants，并使用 `knowledge-agent:*` channel 名称。
- [x] 3.2 用 knowledge-agent IPC module 替换旧 RAG IPC module，并在 IPC 边界校验所有输入。
- [x] 3.3 在 Main IPC registry 中注册新的 knowledge-agent IPC handlers。
- [x] 3.4 将 Preload 中的 `electronAPI.rag` 替换为 `electronAPI.knowledgeAgent`。
- [x] 3.5 将 Renderer bridge 类型和 facade 方法从 `rag` 替换为 `knowledgeAgent`。

## 4. Renderer 重定向

- [x] 4.1 创建 `src/renderer/features/knowledge-agent`，包含 config、initialization、indexing、QA 和 agent-task composables。
- [x] 4.2 在不改变 UI 布局的情况下，将 `SearchView.vue` 从 `features/rag` 重定向到 `features/knowledge-agent`。
- [x] 4.3 将 settings 和初始化调用点从旧 RAG services 重定向到 knowledge-agent services。
- [x] 4.4 在保持已持久化 agent 元数据行为不变的前提下，仅按需重定向 workbench/search history 类型以移除 RAG 命名。

## 5. Settings 与 Locale 清理

- [x] 5.1 将 settings store 更新路径从 `rag` 替换为 `knowledgeAgent`。
- [x] 5.2 将用户可见 RAG 标签的简体中文 locale key 和文案替换为 knowledge-agent 或知识库表述。
- [x] 5.3 仅在 locale 校验需要时，移除或重命名英文和其他 locale 中过期的 RAG keys。
- [x] 5.4 确保旧 `config.rag` 值被忽略，且不会初始化新能力。

## 6. 旧 RAG 删除

- [x] 6.1 在所有 import 完成重定向后删除 `src/renderer/features/rag`。
- [x] 6.2 在替换实现可编译后，删除旧 RAG Main 进程 service、IPC module、prompts、证据 helper 命名和 constants。
- [x] 6.3 删除旧 `rag:*` IPC channels 和旧 bridge namespaces。
- [x] 6.4 如果 README 或 feature 文档描述的是被替换的能力，则移除其中过期的 RAG 引用。
- [x] 6.5 全仓搜索剩余代码层面的 `rag` 或 `RAG` 引用，并删除或说明每个保留项的理由。

## 7. 验证

- [x] 7.1 运行 `npm run build:main`。
- [x] 7.2 运行 `npm run build:preload`。
- [x] 7.3 运行 `npm run typecheck`。
- [x] 7.4 如果实现改动触及已有测试覆盖的逻辑，运行聚焦单元测试或 `npm run test:unit`。
- [x] 7.5 locale key 变更后运行 `npm run check:locale`。


