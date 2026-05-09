# Snaptium 开发规约（DevGuide）

> 目标：本指南用于团队持续开发，统一解释项目目录职责、架构协作方式，以及新增功能的标准落位规范。

---

# 一、开发强制规范（Mandates）

本项目采用严格的 TypeScript 开发规范，所有代码必须符合以下准则。

---

## 1. 类型安全与校验（Type Safety）

### 强制要求

* 严禁使用 @ts-ignore
* 严禁隐式 any
* 原则上禁止使用 @ts-expect-error
* 禁止使用 unknown 规避类型建模

仅允许在以下边界场景使用 `unknown`：

* IPC 输入参数
* 第三方返回值
* `catch` 异常对象

一旦已经通过边界校验，进入service 内部，composable 内部，domain model，feature module，就应该直接使用：明确类型
并且必须：
* 在同一作用域内立即完成类型收窄
* 必须通过代码注释说明原因

### 显式类型定义

以下内容必须具有明确类型声明：

* 函数参数
* 函数返回值
* 复杂对象变量
* Service 层返回结构
* IPC 输入输出结构
* Store 状态结构
* API Response 类型定义
严禁依赖隐式推导代替关键业务类型声明。

### 错误处理

必须进行类型收窄：
error.utils.ts 里的统一错误进行处理，不得单独处理。

---

## 2. 常量定义规范（Constants Pattern）

所有常量文件必须遵循以下模式，以确保：

* 字面量类型收窄
* 自动推导联合类型
* 结构完整性校验

```ts
export const CONSTANT_NAME = {
  KEY: 'value',
} as const satisfies Record<string, string>

export type ConstantType =
  typeof CONSTANT_NAME[keyof typeof CONSTANT_NAME]
```

---

## 3. 架构与复用（Architecture & Reuse）

### 模块复用

实现新功能或修复问题时，必须优先检查并复用：

* `utils`
* `services`
* `shared`
* `core`

严禁重复实现。

### 单向依赖

必须遵循：

```text
Renderer → Bridge → Main
```

严禁：

* 反向调用
* 跨层直接访问
* 逻辑重复存在于 Renderer / Electron 两侧

### IPC 通道管理

所有 IPC 通道必须统一定义在：

```text
electron/main/constants/ipc.constants.ts
```

严禁分散定义。

---

## 4. 开发流程

### 修复即验证

任何修复完成后，必须执行：

```bash
npm run build:main
```

或对应：

* lint 检查
* typecheck
* 单元测试

### 国际化

禁止硬编码任何用户可见字符串。

必须统一通过：

```text
i18n
```

模块进行管理。

---

# 二、整体架构总览

Snaptium 采用：

* Electron
* Vue 3
* TypeScript
* Feature-based 模块化架构

系统分为三个运行层：

1. Main Process
2. Preload Bridge
3. Renderer Application

对应目录：

```text
electron/main
electron/preload
src/renderer
```

---

# 三、Electron 三层架构

## 1. Main Process

目录：

```text
electron/main
```

职责：

* 窗口生命周期管理
* 系统能力调用
* 文件系统访问
* IPC Handler 注册与执行
* 应用级状态与资源协调

运行环境：

```text
Node.js（完整系统权限）
```

---

## 2. Preload

目录：

```text
electron/preload
```

职责：

* 暴露受控 API
* 隔离 Renderer 与 Node
* 防止 Renderer 直接访问系统能力

核心技术：

```ts
contextBridge.exposeInMainWorld
```

---

## 3. Renderer

目录：

```text
src/renderer
```

职责：

* UI 组件
* 业务逻辑
* 状态管理
* 页面路由（预留）

约束：

Renderer 禁止直接访问 Node API，必须通过：

```ts
window.electronAPI
```

调用系统能力。

---

# 四、双层 Service 架构

本项目采用双层 Service 架构。

## Electron Service

职责：

* 提供原子能力
* 不包含业务流程
* 能力提供者（Execution Layer）

## Renderer Service

职责：

* 编排业务流程
* 可组合多个能力
* 能力编排者（Orchestration Layer）

### 强制要求

* 严禁假分层
* Renderer Service 不得仅调用 `electronApi`
* 严禁职责混淆
* 严禁重复实现

---

# 五、标准架构调用链

```text
View / Component
→ Composable
→ Feature Service
→ Electron Bridge
→ Preload API
→ IPC Channel
→ Main Service
→ Node / Filesystem
```

优势：

* UI 与系统能力解耦
* IPC 统一管理
* 安全边界清晰

---

# 六、项目目录结构

```text
Snaptium
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

# 七、Main 进程结构

## 主入口

文件：

```text
electron/main/index.ts
```

职责：

* 单实例锁
* App Ready 初始化
* 创建窗口
* 注册 IPC
* macOS `activate`
* `window-all-closed` 处理

---

## windows

目录：

```text
electron/main/windows
```

示例：

```text
mainWindow.ts
```

负责：

* 创建窗口
* BrowserWindow 安全配置

默认安全项：

```ts
contextIsolation: true
sandbox: true
nodeIntegration: false
```

---

## ipc

```text
ipc
├─ index.ts
└─ modules/
   ├─ editor.ts
   ├─ settings.ts
   └─ ...
```

职责：

* 统一注册 IPC
* 按业务模块拆分 Handler

---

## services

系统能力封装。

示例：

* `file.service.ts`
* `vfs.service.ts`
* `settings.service.ts`

职责：

* 文件 IO
* 数据持久化
* 系统操作

---

## store（预留）

用于 Main 进程状态管理。

示例：

* `app.store.ts`
* `window.store.ts`
* `recentFiles.store.ts`

---

## constants

示例：

* `ipc.constants.ts`
* `vfs.constants.ts`

---

## utils

通用工具：

* `i18n.ts`
* `formatTools.ts`

---

# 八、Preload 层

源码入口：

```text
electron/preload/src/initPreloadCore.ts
```

构建产物：

```text
electron/preload/index.js
```

原则：

* 只暴露最小 API
* 不包含业务逻辑
* 仅做 IPC 转发

示例：

```ts
window.electronAPI.openFile()
window.electronAPI.saveFile()
```

---

# 九、Renderer 层结构

```text
renderer
├─ app
├─ features
├─ core
└─ config
```

---

# 十、core（技术核心层）

特点：

* 不依赖 UI
* 不依赖具体业务
* 可被多个 Feature 复用

示例：

```text
core
├─ editor
│  ├─ createCodeEditor.ts
│  └─ editorExtensions.ts
│
├─ markdown
│  ├─ markdownRenderer.ts
│  ├─ markdownPlugins.ts
│  └─ sanitize.ts
│
└─ filesystem
```

---

# 十一、features（业务模块）

示例：

* `features/editor`
* `features/workspace`
* `features/preview`
* `features/settings`

推荐结构：

```text
feature-name
├─ components
├─ composables
├─ services
├─ store
├─ constants
└─ index.ts
```

---

# 十二、Import 规则

## features 可以 import

* core
* 自身 feature

## features 不建议直接 import

* 其他 feature

避免耦合扩散。

## core

* 不依赖 features

---

# 十三、测试结构

```text
tests
├─ unit
└─ e2e
```

* unit：Vitest
* e2e：Playwright

---

# 十四、已使用工程实践

* TypeScript
* ESLint
* Pinia
* Vitest
* Playwright
* Zod（IPC 校验）
* DOMPurify（Markdown 安全）

---

# 十五、新增功能开发规范

以 `tags` 模块为例。

创建目录：

```text
src/renderer/features/tags
```

结构：

* `components/TagList.vue`
* `composables/useTags.ts`
* `services/tags.service.ts`
* `store/tags.store.ts`
* `constants/tags.constants.ts`

若需要系统能力：

* 新增 `electron/main/ipc/modules/tags.ts`
* 注册 `electron/main/ipc/index.ts`
* 暴露 `electron/preload/src/initPreloadCore.ts`
* 增加 `src/renderer/core/bridge/electronApi.ts`

测试：

* `tests/unit/tags.service.test.ts`
* `tests/e2e/tags.spec.ts`

---

# 十六、安全规范

* Renderer 禁止直接使用 Node API
* IPC 输入必须通过 Zod 校验
* Markdown 必须执行 DOMPurify 白名单清洗
* 外链必须设置：

  * `target="_blank"`
  * `rel="noopener noreferrer nofollow"`

---

# 十七、多国语言规范

## 强制要求

* 不允许语言硬编码
* 所有界面显示内容必须从语言包中获取
* 不允许自行实现 i18n

目前统一使用：

```text
i18n
```

管理多语言。

当前支持：

* 中文
* 英文

后续可继续扩展。

### 文件命名规则

```text
zh-CN.json
en-US.json
```

示例：

```json
{
  "appName": "Snaptium",
  "workspace": "Workspace",
  "outline": "Outline",
  "collapsePanel": "Collapse Panel",
  "newNote": "New Note"
}
```

---

# 十八、常用命令

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

# 十九、架构演进方向

未来可扩展模块：

* plugins
* ai
* platform

示例：

```text
renderer
├─ app
├─ features
├─ core
├─ plugins
└─ platform
```

---

# 二十、实现后检查清单

## 1. 类型与编译（必须）

* [ ] TypeScript 类型检查通过
* [ ] 无 `any`
* [ ] 必须有明确类型
* [ ] 如使用 `unknown` 必须说明原因
* [ ] ESLint 校验通过
* [ ] 无编译错误 / 警告
* [ ] 无未使用变量
* [ ] 无死代码

---

## 2. 代码规范与结构（重点）

* [ ] 符合项目开发规范
* [ ] 命名统一
* [ ] 无重复代码
* [ ] 公共逻辑已下沉到 `core`
* [ ] 无循环依赖
* [ ] 模块职责清晰

---

## 3. Electron 安全（重点）

* [ ] `nodeIntegration = false`
* [ ] `contextIsolation = true`
* [ ] `sandbox` 按需开启
* [ ] 使用 `preload + contextBridge`
* [ ] 禁止任意导航（`will-navigate`）
* [ ] 限制新窗口（`setWindowOpenHandler`）
* [ ] 配置 CSP
* [ ] IPC 参数校验
* [ ] 使用统一错误模块处理异常

---

## 4. 运行时稳定性（重点）

* [ ] 全局异常捕获
* [ ] 处理 `unhandledRejection`
* [ ] 边界值处理完整
* [ ] 关键流程有 fallback
* [ ] 异步逻辑无竞态问题

---

## 5. 性能检查（重点）

* [ ] 无不必要重复渲染
* [ ] 无未清理监听器 / 定时器
* [ ] IPC 无大对象频繁传输
* [ ] 主进程无阻塞
* [ ] 启动时间合理

---

## 6. 内存与资源管理（重点）

* [ ] 事件监听已移除
* [ ] BrowserWindow 正确销毁
* [ ] 无内存泄漏风险
* [ ] 缓存策略合理
* [ ] 生产环境关闭 DevTools

---

## 7. 日志与可观测性（标准）

* [ ] 统一日志方案
* [ ] 错误日志包含上下文
* [ ] 关键行为有日志记录
* [ ] 日志路径规范
* [ ] 日志滚动 / 清理策略存在

---

## 8. 构建与发布（可选）

* [ ] 区分 dev / prod 配置
* [ ] 移除调试代码
* [ ] 启用压缩与 tree-shaking
* [ ] 安装包体积合理
* [ ] 应用签名（如需要）

---

## 9. 依赖安全（标准）

* [ ] `npm audit` 无高危漏洞
* [ ] lock 文件存在
* [ ] 无不必要重依赖
* [ ] 依赖来源可信

---

## 10. 测试（建议）

* [ ] 核心逻辑具备单元测试
* [ ] 关键流程覆盖测试
* [ ] 异常路径覆盖
* [ ] IPC 通信可测试

---

## 11. 用户体验（UX）（建议）

* [ ] 加载态完整
* [ ] 空状态完整
* [ ] 错误提示清晰
* [ ] 无明显卡顿 / 假死
* [ ] UI 交互符合预期

---

## 12. 最终发布确认（可选）

* [ ] 版本号正确
* [ ] Changelog 已更新
* [ ] 构建产物验证通过
* [ ] 安装 / 升级流程验证通过
