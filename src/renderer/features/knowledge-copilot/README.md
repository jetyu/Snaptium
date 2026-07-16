# Knowledge Copilot 功能模块

## 目录职责

```text
knowledge-copilot/
├── composables/   # 知识库问答、索引、任务和初始化流程
├── constants/     # 功能内常量
├── services/      # Renderer 侧业务编排和 IPC 调用
├── store/         # Pinia 状态
├── index.ts       # 对外导出
└── README.md
```

## 调用链

```text
组件 → Composable → Store / Service → Bridge → IPC → Main Service
```

Renderer 只通过 `window.electronAPI` 调用主进程能力；文件、索引和模型调用等系统能力由 Main Service 处理。

## 主要模块

- `useKnowledgeCopilotChat.ts`：知识库问答会话。
- `useKnowledgeCopilotIndex.ts`：索引状态与索引操作。
- `useKnowledgeCopilotTask.ts`：智能体任务的执行与恢复。
- `useKnowledgeCopilotConfig.ts`：Knowledge Copilot 配置。
- `useKnowledgeCopilotInitialization.ts`：功能初始化。
- `knowledge-copilot.store.ts`：功能共享状态。
- `knowledge-copilot.service.ts`：Renderer 侧服务接口。

## 类型约定

类型定义应靠近其使用位置；不新增仅用于收纳类型的独立目录。
