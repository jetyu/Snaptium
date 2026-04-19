# RAG Feature Module

## 架构设计

遵循项目标准的 feature 模块化架构：

```
view → component → composable → service → bridge/api
```

## 目录结构

```
src/renderer/features/rag/
├── README.md                    # 本文件
├── index.ts                     # 模块导出
├── components/                  # RAG UI 组件
│   └── RAGStatusIndicator.vue  # RAG 状态指示器
├── composables/                 # RAG 业务逻辑
│   ├── useRAGIndex.ts          # 索引管理
│   ├── useRAGSearch.ts         # 语义搜索
│   └── useRAGConfig.ts         # 配置管理
├── services/                    # RAG 数据访问层
│   └── rag.service.ts          # RAG 服务接口（类型定义在此）
├── store/                       # RAG 状态管理
│   └── rag.store.ts            # Pinia store（类型定义在此）
└── constants/                   # RAG 常量
    └── rag.constants.ts        # 配置常量

electron/main/services/
├── rag.service.js              # 主进程 RAG 服务
├── embedding.service.js        # 嵌入生成服务
└── vector-store.service.js     # 向量存储服务

electron/main/ipc/modules/
└── rag.js                      # RAG IPC 通道
```

## 类型定义位置

**遵循项目规范：类型定义在使用它们的文件中**

- `rag.store.ts` - 定义 RAG 配置相关类型
- `rag.service.ts` - 定义 RAG 服务接口类型
- 不使用单独的 `types/` 目录

## 职责划分

### 1. Constants Layer (常量层)
- 默认配置值
- 约束条件
- 错误消息
- 事件名称

### 2. Service Layer (服务层)
- **渲染进程服务**：封装 IPC 调用，定义服务接口类型
- **主进程服务**：实现核心业务逻辑

### 3. Composable Layer (组合式函数层)
- 封装可复用的业务逻辑
- 管理组件状态
- 处理副作用

### 4. Store Layer (状态管理层)
- 全局 RAG 状态
- 索引状态
- 配置缓存
- 定义状态相关类型

### 5. Component Layer (组件层)
- UI 展示
- 用户交互

## 数据流

```
用户操作
  ↓
Component (RAGSettings.vue)
  ↓
Composable (useRAGConfig.ts)
  ↓
Store (rag.store.ts)
  ↓
Service (rag.service.ts)
  ↓
Bridge (electronApi.ts)
  ↓
IPC (rag.js)
  ↓
Main Service (rag.service.js)
  ↓
Vector Store (vector-store.service.js)
```

## 设计原则

1. **单一职责**：每个模块只负责一件事
2. **依赖倒置**：高层模块不依赖低层模块
3. **开闭原则**：对扩展开放，对修改关闭
4. **接口隔离**：使用小而专注的接口
5. **可测试性**：每层都可以独立测试
6. **类型就近原则**：类型定义在使用它们的文件中
