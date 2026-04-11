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

- Electron Service：只提供原子能力（无业务流程）,能力提供者（Execution Layer）
- Renderer Service：负责编排业务流程（可组合多个能力）,能力编排者（Orchestration Layer）不得仅调用 electronApi（禁止假分层）

严禁职责混淆。

不得存在重复实现（Renderer / Electron 各一份逻辑）
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

### 9. 依赖安全（标准）

- [ ] 执行 `npm audit` 无高危漏洞
- [ ] 依赖版本锁定（lock 文件存在）
- [ ] 无不必要或过重依赖
- [ ] 依赖来源可信

---

### 10. 测试（建议）

- [ ] 核心逻辑具备单元测试
- [ ] 关键流程覆盖测试
- [ ] 异常路径测试覆盖
- [ ] IPC 通信可测试

---

### 11. 用户体验（UX）（建议）

- [ ] 加载态处理完整
- [ ] 空状态处理完整
- [ ] 错误提示清晰友好
- [ ] 无明显卡顿 / 假死
- [ ] UI 交互符合预期

---

### 12. 最终发布确认（可选）

- [ ] 版本号正确
- [ ] Changelog 已更新
- [ ] 构建产物验证可运行
- [ ] 安装 / 升级流程验证通过

---





