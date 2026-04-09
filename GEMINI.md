# GEMINI.md - NoteWizard Context & Instructions

## Project Overview
NoteWizard is a modern, cross-platform desktop note-taking application built with **Electron**, **Vue 3**, and **CodeMirror 6**. It focuses on a local-first writing experience with Markdown support, integrated AI assistance (RAG), and strong data privacy (AES-256 encryption).

### Key Technologies
- **Frontend**: Vue 3 (Composition API), Pinia (State Management), TypeScript, Vite.
- **Backend (Electron Main)**: Node.js, Electron, LanceDB (Vector database for RAG).
- **Editor**: CodeMirror 6 with custom Markdown extensions.
- **Architecture**: Domain-driven services in the Main process and feature-based modules in the Renderer process.

---

## Architecture & Directory Structure

### 1. Main Process (`electron/main/`)
The Main process acts as the application's "backend," handling system-level operations, file system access, and heavy business logic.
- **`services/`**: Contains core domain services (e.g., `vfs.service.js`, `rag.service.js`, `search.service.js`, `ai-assistant.service.js`). 
- **`ipc/`**: IPC handlers that delegate to the services. Follow the "Thin IPC, Fat Service" pattern.
- **`utils/`**: Shared utilities like text chunkers and i18n helpers.

### 2. Renderer Process (`src/renderer/`)
The Renderer process handles the UI and user interactions.
- **`features/`**: Feature-based modular structure. Each feature (e.g., `search`, `rag`, `ai`) is self-contained:
  - `components/`: UI components.
  - `composables/`: UI state and reactive logic.
  - `services/`: Data orchestration and IPC communication proxies.
  - `store/`: Pinia stores for shared state.
- **`core/`**: Core shared logic like the bridge, editor extensions, and markdown rendering.

---

## Development Conventions

### 1. Service Pattern (Refined)
Always maintain a clear separation between the Main process and Renderer process:
- **Main Process**: Business logic should reside in `electron/main/services/`. IPC handlers in `electron/main/ipc/` should only perform light validation and delegate to these services.
- **Renderer Process**: Use feature-specific services in `src/renderer/features/*/services/` to abstract IPC calls and provide data transformation/formatting logic for the UI.

### 2. Coding Standards
- **TypeScript**: Use strict typing in the Renderer process.
- **IPC Communication**: Use the `electronApi` bridge defined in `src/renderer/core/bridge/`. Never use `ipcRenderer` directly in components.
- **Logging**: Use the centralized `loggerService` for consistent logging across both processes.

---

## Building and Running

### Development
- **Run all (Renderer + Main)**: `npm run dev`
- **Run Renderer only**: `npm run dev:renderer`
- **Run Main only (with hot reload)**: `npm run dev:electron`

### Build & Test
- **Full Build**: `npm run build`
- **Unit Tests**: `npm run test:unit`
- **E2E Tests**: `npm run test:e2e`
- **Create Distribution**: `npm run dist`

---

## Important Files
- `package.json`: Project metadata, dependencies, and scripts.
- `electron/main/index.js`: Main process entry point.
- `src/renderer/main.ts`: Renderer process entry point.
- `docs/PRD/NoteWizard_PRD.md`: Comprehensive product requirements and module details.
- `electron/main/services/vfs.service.js`: The heart of the Virtual File System logic.

开发规约：
# NoteWizard 开发指南（DevGuide）

> 目标：本指南用于团队持续开发，解释目录职责、架构协作方式，以及新增功能的标准落位规范。

---

## 1. 整体架构总览

NoteWizard 采用：

- **Electron + Vue3 + TypeScript**
- **Feature-based 模块化架构**

系统分为三个运行层：

1. Main Process
2. Preload Bridge
3. Renderer Application

对应目录：

- `electron/main`
- `electron/preload`
- `src/renderer`

---

## 2. Electron 三层架构

### Main Process

目录：`electron/main`

职责：

- 窗口生命周期管理
- 系统能力调用
- 文件系统访问
- IPC Handler 注册与执行
- 应用级状态与资源协调

运行环境：Node.js（完整系统权限）

### Preload

目录：`electron/preload`

职责：

- 暴露受控 API
- 隔离 Renderer 与 Node
- 防止 Renderer 直接访问系统能力

核心技术：`contextBridge.exposeInMainWorld`

### Renderer

目录：`src/renderer`

职责：

- UI 组件
- 业务逻辑
- 状态管理
- 页面路由（预留）

约束：Renderer 禁止直接访问 Node API，只能通过 `window.electronAPI` 调用系统能力。

本项目采用双层 Service 架构：

- Electron Service：只提供原子能力（无业务流程）
- Renderer Service：负责编排业务流程（可组合多个能力）

严禁职责混淆。


---

## 3. 架构调用链

标准调用流程：

`View/Component -> Composable -> Feature Service -> Electron Bridge -> Preload API -> IPC Channel -> Main Service -> Node/Filesystem`

优势：

- UI 与系统能力解耦
- IPC 统一管理
- 安全边界清晰

---

## 4. 项目目录结构

```text
NoteWizard
│
├─ electron
│  ├─ main
│  │  ├─ windows
│  │  ├─ ipc
│  │  │  └─ modules
│  │  ├─ services
│  │  ├─ store（预留）
│  │  ├─ utils
│  │  └─ constants
│  │
│  └─ preload
│
├─ src
│  └─ renderer
│     ├─ app
│     ├─ features
│     ├─ core
│     └─ config
│
├─ tests
│  ├─ unit
│  └─ e2e
│
└─ docs（可选）
```

---

## 5. Main 进程结构

目录：`electron/main`

### 主入口

文件：`electron/main/index.js`

职责：

- 单实例锁
- App ready 初始化
- 创建窗口
- 注册 IPC
- macOS `activate`
- `window-all-closed` 处理

### windows

目录：`electron/main/windows`

示例：`mainWindow.js`

负责：

- 创建窗口
- BrowserWindow 安全配置

默认安全项：

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`

### ipc

目录：`electron/main/ipc`

结构：

```text
ipc
├─ index.js
├─ editor.js
└─ modules/
```

职责：

- 统一注册 IPC
- 按业务模块拆分 handler

建议扩展示例：

- `ipc/modules/workspace.js`
- `ipc/modules/settings.js`

### services

目录：`electron/main/services`

系统能力封装。

示例：

- `file.service.js`
- `workspace.service.js`
- `settings.service.js`

职责：

- 文件 IO
- 数据持久化
- 系统操作

### store（预留）

目录：`electron/main/store`

用途：Main 进程状态管理（后续可扩展）。

示例：

- `app.store.js`
- `window.store.js`
- `recentFiles.store.js`

### constants

目录：`electron/main/constants`

示例：

- `channels.js`
- `app.constants.js`（后续新增）

### utils

目录：`electron/main/utils`

通用工具：

- `safeDialog.js`
- `path.js`（后续新增）

---

## 6. Preload 层

目录：`electron/preload`

入口：`index.js`

通过 `contextBridge.exposeInMainWorld` 暴露 API。

示例：

- `window.electronAPI.openFile()`
- `window.electronAPI.saveFile()`

原则：

- 只暴露最小 API
- 不包含业务逻辑
- 仅做 IPC 转发

---

## 7. Renderer 层结构

目录：`src/renderer`

```text
renderer
├─ app
├─ features
├─ core
└─ config
```

---

## 8. core（技术核心层）

目录：`src/renderer/core`

用于封装底层技术能力。

特点：

- 不依赖 UI
- 不依赖具体业务
- 可被多个 feature 复用

示例结构：

```text
core
├─ editor
│  ├─ createCodeEditor.ts
│  └─ editorExtensions.ts（后续新增）
│
├─ markdown
│  ├─ markdownService.ts
│  ├─ markdownPlugins.ts（后续新增）
│  └─ sanitize.ts（后续可拆分）
│
└─ filesystem（后续新增）
```

---

## 9. features（业务模块）

目录：`src/renderer/features`

示例：

- `features/editor`
- `features/workspace`
- `features/preview`
- `features/settings`

推荐结构：

```text
feature-name
├─ components
├─ composables
├─ services
├─ store
├─ constants
└─ index.ts（或 index.js 过渡）
```

---

## 11. Import 规则

features 可以 import：

- core
- 自身 feature

features **不建议**直接 import 其他 feature（避免耦合扩散）。

core 不依赖 features。

---

## 12. 测试结构

```text
tests
├─ unit
└─ e2e
```

- unit：Vitest
- e2e：Playwright

---

## 13. 已使用工程实践

- TypeScript
- ESLint
- Pinia
- Vitest
- Playwright
- Zod（IPC 校验）
- sanitize-html（Markdown 安全）

---

## 14. 新增功能开发规范

以 `tags` 模块为例。

创建目录：`src/renderer/features/tags`

结构：

- `components/TagList.vue`
- `composables/useTags.ts`
- `services/tags.service.ts`
- `store/tags.store.ts`
- `constants/tags.constants.ts`

若需要系统能力：

- 在 `electron/main/ipc/modules/tags.js` 增加 handler
- 在 `electron/main/ipc/index.js` 注册
- 在 `electron/preload/index.js` 暴露白名单 API
- 在 `src/renderer/services/electronApi.ts` 增加前端调用封装

测试：

- `tests/unit/tags.service.test.ts`
- `tests/e2e/tags.spec.ts`

---

## 15. 安全规范

- Renderer 禁止直接使用 Node API
- IPC 输入必须通过 Zod 校验
- Markdown 必须执行 sanitize-html 白名单清洗
- 外链必须设置：
  - `target="_blank"`
  - `rel="noopener noreferrer nofollow"`

---

## 16. 常用命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

---

## 17. 架构演进方向

未来可扩展模块：

- `plugins`
- `ai`
- `platform`

示例：

```text
renderer
├─ app
├─ features
├─ core
├─ plugins
└─ platform
```
## 18. 多国语言
不允许语言硬编码，所有界面显示内容必须从语言包中获取。
目前已经通过i18n，实现多语言
目前可以只支持中文和英文，后续可以扩展。不允许自行实现i18n
语言文件命名规则：
zh-CN.json
en-US.json

示例：

```json
{
  "appName": "NoteWizard",
  "workspace": "Workspace",
  "outline": "Outline",
  "collapsePanel": "Collapse Panel",
  "newNote": "New Note"
}
```

## 19. 实现后检查清单
### 1. 类型与编译（必须）

- [ ] TypeScript 类型检查通过（无 `any` 滥用）
- [ ] ESLint / Prettier 校验通过
- [ ] 无编译错误 / 警告
- [ ] 无未使用变量 / 无死代码

---

### 2. 代码规范与结构（重点）

- [ ] 符合项目开发规范
- [ ] 命名统一（变量 / 方法 / 文件）
- [ ] 无重复代码（已抽象复用，以及SVG文件等等）
- [ ] 公共逻辑已下沉到 `core` 层
- [ ] 无循环依赖
- [ ] 模块职责清晰（无“上帝模块”）
---

### 3. Electron 安全（重点）

- [ ] `nodeIntegration = false`
- [ ] `contextIsolation = true`
- [ ] `sandbox` 按需开启
- [ ] 使用 `preload + contextBridge` 暴露 API
- [ ] 禁止任意导航（`will-navigate`）
- [ ] 限制新窗口（`setWindowOpenHandler`）
- [ ] 配置 CSP（Content Security Policy）
- [ ] IPC 通信参数校验（防注入）

---

### 4. 运行时稳定性（重点）

- [ ] 全局异常捕获（main / renderer / preload）
- [ ] 处理 `unhandledRejection`
- [ ] 边界值处理（null / undefined / 空数据）
- [ ] 关键流程有 fallback 方案
- [ ] 异步逻辑无竞态问题

---

### 5. 性能检查（重点）

- [ ] 无不必要的 Vue 组件重复渲染
- [ ] 无未清理的监听器 / 定时器
- [ ] IPC 通信无大对象频繁传输
- [ ] 主进程无阻塞（避免同步 IO）
- [ ] 启动时间合理（冷启动 / 热启动）

---

### 6. 内存与资源管理（重点）

- [ ] 事件监听已正确移除
- [ ] BrowserWindow 正确销毁
- [ ] 无内存泄漏风险
- [ ] 缓存策略合理（无无限增长）
- [ ] 生产环境关闭 DevTools

---

### 7. 日志与可观测性（标准）

- [ ] 统一日志方案（info / warn / error）
- [ ] 错误日志包含上下文信息
- [ ] 关键行为有日志记录
- [ ] 日志路径规范
- [ ] 日志滚动 / 清理策略存在

---

### 8. 构建与发布（可选）

- [ ] 区分 dev / prod 配置
- [ ] 移除调试代码（console / mock）
- [ ] 启用压缩与 tree-shaking
- [ ] 安装包体积合理
- [ ] 已配置应用签名（如需要）

---

## 9. 依赖安全（标准）

- [ ] 执行 `npm audit` 无高危漏洞
- [ ] 依赖版本锁定（lock 文件存在）
- [ ] 无不必要或过重依赖
- [ ] 依赖来源可信

---

## 10. 测试（建议）

- [ ] 核心逻辑具备单元测试
- [ ] 关键流程覆盖测试
- [ ] 异常路径测试覆盖
- [ ] IPC 通信可测试

---

## 11. 用户体验（UX）（建议）

- [ ] 加载态处理完整
- [ ] 空状态处理完整
- [ ] 错误提示清晰友好
- [ ] 无明显卡顿 / 假死
- [ ] UI 交互符合预期

---

## 12. 最终发布确认（可选）

- [ ] 版本号正确
- [ ] Changelog 已更新
- [ ] 构建产物验证可运行
- [ ] 安装 / 升级流程验证通过

---


---

## 20. Service 分层强约束（必须遵守）

本项目采用双层 Service 架构：

- Electron Service：能力提供者（Execution Layer）
- Renderer Service：能力编排者（Orchestration Layer）

严禁职责混淆。

---

### 20.1 Renderer Service（编排层）

必须满足以下至少两项，否则视为违规：

- 包含业务流程控制（if / fallback / 分支）
- 包含数据处理（slice / map / format）
- 组合多个能力调用（如 search + AI）
- 包含策略逻辑（topK / 模型选择）

#### ❌ 禁止写法（假分层）

```ts
async search(query) {
  return electronApi.rag.search(query)
}
```

说明：

- 仅做 API 转发，没有业务逻辑
- 属于“假分层”，禁止提交

---

#### ✅ 合法示例

```ts
async generateRagAnswer(query) {
  const docs = await electronApi.rag.search(query)

  const topDocs = docs.slice(0, 5)

  if (!hasModel()) {
    return topDocs
  }

  const prompt = buildPrompt(query, topDocs)

  return await electronApi.aiChat.generate({ prompt })
}
```

---

### 20.2 Electron Service（执行层）

必须满足：

- 单一职责（只做一件事）
- 不包含业务流程（禁止 if/编排）
- 不依赖 UI / Renderer 状态
- 不实现 fallback 逻辑

---

#### ❌ 禁止写法（业务下沉）

```ts
async generateAnswer(query) {
  const docs = await search(query)

  if (!model) return docs

  return ai.generate(...)
}
```

---

#### ✅ 合法示例

```ts
async search(query) {
  const embedding = await embed(query)
  return vectorDB.search(embedding)
}
```

---

## 21. Electron API 设计规范

### 21.1 必须为“原子能力”

允许：

- rag.search
- ai.generate
- embedding.embed

禁止：

- rag.generateAnswer
- rag.ask
- ai.ragChat

说明：

复合逻辑属于 Renderer Service，不允许下沉到 Electron。

---

## 22. RAG 架构规范

### 22.1 RAG 流程必须在 Renderer 编排

标准流程：

query → search → topK → prompt → LLM → fallback

职责划分：

- search：Electron
- prompt：Renderer
- fallback：Renderer

---

### 22.2 必须支持降级

当未配置 AI 模型时：

```ts
return searchResults
```

禁止：

- 抛异常
- 返回空数据
- 强依赖 AI

---

### 22.3 Prompt 构建位置

必须在 Renderer Service 中实现。

禁止写在：

- Electron Service
- IPC handler

---

## 23. AI 调用规范

### 23.1 必须通过统一入口

Renderer 层必须通过：

```ts
ai.service.ts
```

统一调用 AI。

---

### 23.2 禁止直接调用

禁止：

- electronApi.aiChat
- electronApi.aiAssistant

必须封装后再使用。

---

### 23.3 统一接口

```ts
aiService.generate({
  mode: 'chat' | 'completion' | 'rag',
  prompt,
})
```

---

## 24. 反例（必须避免）

### ❌ 假分层

```ts
async search(q) {
  return electronApi.rag.search(q)
}
```

---

### ❌ 业务逻辑写入 Electron

```ts
async generateAnswer() {
  if (!model) return []
}
```

---

### ❌ API 黑盒设计

```ts
electronApi.rag.ask()
```

---

## 25. Code Review 强制检查

提交 PR 前必须检查：

- [ ] Renderer Service 不得仅调用 electronApi（禁止假分层）
- [ ] 是否存在业务逻辑写在 Electron Service 中
- [ ] 是否存在重复实现（Renderer / Electron 各一份逻辑）
- [ ] 是否实现 fallback（特别是 AI / RAG）
- [ ] 是否存在 API 黑盒（复合能力下沉）

---

## 26. 核心原则总结

> Renderer Service 负责“怎么组合能力”，  
> Electron Service 只负责“提供能力”，不允许反向越界。
