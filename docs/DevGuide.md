# Snaptium 开发规约（DevGuide）

> 定位：本指南用于当前开发阶段，统一项目目录职责、架构边界、类型安全规则，以及新增功能的标准落位方式。
>
> 原则：小步修改、最小必要变更、按修改范围验证，避免过度抽象和无关重构。
>
> 说明：具体 AI 编码行为规范见 `Claude.md`；本文件主要约束 Snaptium 的架构、类型、IPC、i18n 和工程落位规则。

---

# 一、开发强制规范（Mandates）

本项目采用严格的 TypeScript 开发规范。开发时必须优先保证类型安全、架构边界清晰、修改范围可控。

---

## 1. 类型安全与校验（Type Safety）

### 强制要求

* 严禁使用 `@ts-ignore`
* 严禁隐式 `any`
* 原则上禁止使用 `@ts-expect-error`
* 禁止使用 `unknown` 规避类型建模
* 禁止依赖隐式推导替代关键业务类型声明

### `unknown` 使用规则

仅允许在以下边界场景使用 `unknown`：

* IPC 输入参数
* 第三方返回值
* `catch` 异常对象
* 本地存储、文件读取、`JSON.parse` 等不可完全信任的数据入口

使用 `unknown` 后，必须在进入业务逻辑前完成类型收窄。

进入以下内部层级后，应使用明确类型：

* Service 内部
* Composable 内部
* Domain Model
* Feature Module
* Store State
* IPC Handler 的业务处理阶段

只有在收窄逻辑复杂、原因不直观，或涉及外部兼容边界时，才需要补充代码注释说明原因。

### 显式类型定义

以下内容必须具有明确类型声明：

* 导出的函数参数与返回值
* Service 层公开方法的参数与返回值
* IPC 输入输出结构
* Store 状态结构
* API Response 类型定义
* 复杂业务对象变量
* 跨模块复用的数据结构

以下场景可以依赖 TypeScript 推导：

* 局部小函数
* 简单回调
* 简单临时变量
* `computed` / `map` / `filter` 等上下文明确的短逻辑

但不得影响关键业务类型的可读性和稳定性。

### 错误处理

错误对象必须先完成类型收窄。

项目内应优先使用统一错误处理工具，例如 `error.utils.ts` 中的工具函数，对未知错误进行归一化处理。

禁止直接假设 `error` 一定具有 `message` 字段。

允许调用层根据归一化后的错误进行：

* 业务分支
* 日志记录
* 用户提示
* IPC 返回值处理

但不得绕过统一错误处理逻辑直接处理未知错误。

---

## 2. 常量定义规范（Constants Pattern）

字符串枚举类常量推荐使用以下模式，以确保：

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

非字符串枚举类常量不强制使用 `Record<string, string>`。

例如以下类型可以根据实际场景定义：

* 数字阈值
* 超时时间
* 配置对象
* 数组
* 正则
* 尺寸
* Feature 配置

要求：

* 命名必须清晰
* 类型必须明确
* 可使用 `as const` 保持字面量约束
* 不得将无关常量混入同一个文件

不允许在代码中直接使用 `.types.ts` 文件
---

## 3. 架构与复用（Architecture & Reuse）

### 模块复用

实现新功能或修复问题时，必须优先检查并复用已有代码：

* `utils`
* `services`
* `shared`
* `core`
* 当前 Feature 内已有模块

禁止重复实现已有稳定逻辑。

跨 Feature 复用、稳定且非业务专属的公共逻辑，应下沉到 `core` 或 `shared`。

单一 Feature 内部逻辑应优先保留在 Feature 内，避免过度抽象。

### 单向依赖

必须遵循：

```text
Renderer → Bridge → Main
```

严禁：

* 反向调用
* 跨层直接访问
* Renderer 直接访问 Node.js API
* Main 进程依赖 Renderer 业务实现
* 业务流程逻辑重复存在于 Renderer / Main 两侧

允许共享：

* 类型
* DTO
* Schema
* 常量
* 纯函数工具

对于安全边界：

* Renderer 可以做用户体验层校验
* Main / IPC Handler 必须做可信边界校验

### IPC 通道管理

所有 IPC 通道必须统一定义在：

```text
electron/main/constants/ipc.constants.ts
```

禁止分散定义 IPC channel 字符串。

IPC 输入必须在边界进行校验。涉及外部输入、文件路径、配置写入、系统能力调用时，必须通过 Zod 或等价方式校验。

---

## 4. 开发流程

### 修改原则

每次修改必须遵循：

* 只修改与任务直接相关的文件
* 不做无关重构
* 不顺手格式化无关文件
* 不新增未被请求的功能
* 不引入无必要的抽象层
* 优先匹配现有代码风格

如果发现无关问题，应先记录或说明，不要擅自修改。

### 修复即验证

任何修复完成后，必须执行与修改范围对应的最小验证命令。

推荐规则：

* 修改 Main 进程：`npm run build:main`
* 修改 Preload：`npm run build:preload`
* 修改 Renderer / shared TypeScript：`npm run typecheck`
* 修改 lint 敏感代码：`npm run lint`
* 修改核心逻辑且已有测试：运行相关单元测试或 `npm run test:unit`
* 修改构建 / 发布配置：运行对应构建命令

如果无法执行验证，必须说明原因，并明确应由人工执行的验证命令。

### 国际化

禁止硬编码任何用户可见字符串。

用户可见文本必须统一通过 i18n 模块管理。

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

Main Process 可以访问系统能力，但必须通过受控 IPC 暴露给 Renderer。

---

## 2. Preload

目录：

```text
electron/preload
```

职责：

* 暴露受控 API
* 隔离 Renderer 与 Node.js
* 防止 Renderer 直接访问系统能力
* 作为 Renderer 与 Main 之间的安全桥接层

核心技术：

```ts
contextBridge.exposeInMainWorld
```

原则：

* 只暴露最小必要 API
* 不包含业务逻辑
* 不直接实现复杂流程
* 仅做参数转发、类型边界和能力暴露

---

## 3. Renderer

目录：

```text
src/renderer
```

职责：

* UI 组件
* 用户交互
* 业务编排
* 状态管理
* 页面路由（预留）

约束：

Renderer 禁止直接访问 Node.js API，必须通过：

```ts
window.electronAPI
```

调用系统能力。

---

# 四、双层 Service 架构

本项目采用双层 Service 架构。

---

## 1. Electron Service

Electron Service 位于 Main 进程。

职责：

* 提供系统原子能力
* 封装文件系统、窗口、配置、更新、系统 API 等能力
* 执行可信边界后的实际操作
* 返回明确类型结果

原则：

* 不包含 Renderer UI 逻辑
* 不依赖 Renderer 状态
* 不处理界面展示文案
* 不重复 Renderer 业务编排

Electron Service 是能力提供者（Execution Layer）。

---

## 2. Renderer Service

Renderer Service 位于 Renderer 层。

职责：

* 编排业务流程
* 组合多个系统能力
* 做数据转换
* 做错误归一化
* 协调 Store / Composable / UI 之间的业务逻辑
* 屏蔽 IPC 细节

Renderer Service 是能力编排者（Orchestration Layer）。

原则：

* 不直接访问 Node.js API
* 不重复 Main 进程系统能力
* 不承担 UI 组件渲染职责
* 不跨 Feature 访问内部实现

不应创建只转发 `electronApi` 的假 Service。

如果 Renderer Service 暂时只是薄封装，必须有明确目的，例如：

* 统一类型
* 统一错误处理
* 屏蔽 IPC 细节
* 为后续业务编排预留稳定边界

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
* 业务编排和系统执行分离
* 更容易测试和维护

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
└─ docs
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

主入口应保持清晰，不应承载具体业务逻辑。

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

职责：

* 创建窗口
* 管理 BrowserWindow 生命周期
* 配置窗口安全项
* 管理窗口相关事件

默认安全项：

```ts
contextIsolation: true
sandbox: true
nodeIntegration: false
```

---

## ipc

目录：

```text
electron/main/ipc
```

推荐结构：

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
* 在 IPC 边界完成输入校验
* 调用 Main Service 执行系统能力
* 返回明确类型结果

---

## services

目录：

```text
electron/main/services
```

职责：

* 文件 IO
* 数据持久化
* 系统操作
* 更新能力
* 应用配置
* 其他 Main 进程系统能力

示例：

* `file.service.ts`
* `vfs.service.ts`
* `settings.service.ts`

---

## store（预留）

目录：

```text
electron/main/store
```

用于 Main 进程状态管理。

示例：

* `app.store.ts`
* `window.store.ts`
* `recentFiles.store.ts`

---

## constants

目录：

```text
electron/main/constants
```

示例：

* `ipc.constants.ts`
* `vfs.constants.ts`

职责：

* 统一定义 IPC Channel
* 统一定义 Main 进程常量
* 避免魔法字符串分散出现

---

## utils

目录：

```text
electron/main/utils
```

职责：

* Main 进程通用工具
* 错误归一化
* 格式化工具
* 与业务无关的纯工具函数

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
* 不直接访问 Renderer 状态
* 不自行处理复杂业务流程
* 仅作为安全桥接层

示例：

```ts
window.electronAPI.openFile()
window.electronAPI.saveFile()
```

当新增系统能力时，应同步检查：

* Main IPC Channel
* Main IPC Handler
* Main Service
* Preload API 暴露
* Renderer Bridge 类型定义

---

# 九、Renderer 层结构

Renderer 目录：

```text
src/renderer
```

推荐结构：

```text
renderer
├─ app
├─ features
├─ core
└─ config
```

---

## app

职责：

* 应用入口
* 全局 Provider
* 全局样式
* 应用级初始化
* 全局路由或布局（如有）

---

## features

职责：

* 业务模块
* 页面局部状态
* Feature 内部组件
* Feature 内部 service / composable / store

Feature 应保持自治，不应随意访问其他 Feature 内部实现。

---

## core

职责：

* 技术核心能力
* 可跨 Feature 复用的稳定逻辑
* 与具体业务弱绑定或无关的基础能力

特点：

* 不依赖 UI
* 不依赖具体 Feature
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

## config

职责：

* Renderer 配置
* 运行时配置
* 功能开关
* 非敏感静态配置

---

# 十、features（业务模块）

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

目录职责：

* `components`：Feature 内部 UI 组件
* `composables`：Feature 内部组合逻辑
* `services`：Feature 业务编排逻辑
* `store`：Feature 状态管理
* `constants`：Feature 内部常量
* `index.ts`：Feature 对外出口

原则：

* Feature 内部可以自由组织
* Feature 对外暴露应收敛到稳定出口
* 不要跨 Feature 引用对方内部文件
* 公共能力优先沉淀到 `core` 或 `shared`

---

# 十一、Import 规则

## features 可以 import

* `core`
* `shared`
* 自身 Feature 内部模块
* 明确导出的稳定公共接口

## features 不建议直接 import

* 其他 Feature 的内部 `components`
* 其他 Feature 的内部 `composables`
* 其他 Feature 的内部 `services`
* 其他 Feature 的 private utils
* 其他 Feature 的内部 store 实现

Feature 之间原则上不直接依赖彼此内部实现。

允许通过以下方式协作：

* `core`
* `shared`
* 明确导出的公共接口
* App 层组合
* Store / Service 的稳定公开 API

## core

`core` 不得依赖 `features`。

`core` 可以依赖：

* 纯工具
* 第三方基础库
* 类型定义
* 与 UI 无关的稳定基础能力

---

# 十二、测试结构

测试目录：

```text
tests
├─ unit
└─ e2e
```

测试框架：

* unit：Vitest
* e2e：Playwright

开发阶段测试原则：

* 纯业务逻辑、数据转换、校验逻辑优先补充 unit test
* 关键用户流程、跨模块流程、回归风险高的流程补充 e2e test
* 文案、样式、简单配置变更通常不强制新增测试
* 修改已有测试覆盖的逻辑时，应运行对应测试
* 新增核心逻辑时，应优先考虑补充单元测试

---

# 十三、已使用工程实践

当前项目主要使用：

* TypeScript
* ESLint
* Vue 3
* Pinia
* Vitest
* Playwright
* Zod（IPC 校验）
* DOMPurify（Markdown 安全）

使用新依赖前应先确认：

* 项目中是否已有等价能力
* 是否可以通过现有工具实现
* 是否会显著增加包体积或维护成本
* 是否真的属于当前任务范围

---

# 十四、新增功能开发规范

以 `tags` 模块为例。

创建目录：

```text
src/renderer/features/tags
```

推荐结构：

```text
tags
├─ components
│  └─ TagList.vue
├─ composables
│  └─ useTags.ts
├─ services
│  └─ tags.service.ts
├─ store
│  └─ tags.store.ts
├─ constants
│  └─ tags.constants.ts
└─ index.ts
```

如果只涉及 Renderer 业务逻辑，优先在 Feature 内完成。

如果需要系统能力，例如文件系统、系统设置、窗口、更新、原生能力，则需要补充 Main / Preload / Bridge 链路：

* 新增或复用 `electron/main/constants/ipc.constants.ts` 中的 IPC Channel
* 新增或修改 `electron/main/ipc/modules/*.ts`
* 注册 `electron/main/ipc/index.ts`
* 新增或复用 `electron/main/services/*.ts`
* 暴露 `electron/preload/src/initPreloadCore.ts`
* 更新 Renderer 侧 `electronApi` 类型或 Bridge 定义
* 在 Renderer Feature Service 中进行业务编排

测试建议：

* 纯逻辑放入 unit test
* 关键流程放入 e2e test
* 简单 UI 文案或样式变更不强制新增测试

---

# 十五、安全规范

开发阶段必须遵守以下安全边界：

* Renderer 禁止直接使用 Node.js API
* Renderer 必须通过 `window.electronAPI` 调用系统能力
* Preload 只暴露最小必要 API
* IPC 输入必须通过 Zod 或等价方式校验
* Main 进程必须重新校验不可信输入
* Markdown 渲染必须执行 DOMPurify 白名单清洗
* 外链必须设置安全属性

外链要求：

```html
target="_blank"
rel="noopener noreferrer nofollow"
```

涉及以下能力时必须特别谨慎：

* 文件路径
* 文件写入
* 外部 URL
* Shell / 系统命令
* 自动更新
* 本地数据库
* 用户隐私数据
* 同步和网络请求

---

# 十六、多国语言规范

## 强制要求

* 不允许硬编码用户可见文本
* 所有界面显示内容必须从语言包中获取
* 不允许自行实现新的 i18n 系统
* 新增或修改 UI 文案时，应保持语言包 key 结构一致

当前统一使用：

```text
i18n
```

管理多语言。

语言文件位于：

```text
electron/assets/locales
```

新增或修改用户可见文本时：
* 只需要补全zh-CN.json 的 key
* 临时 fallback 可以使用英文或默认语言

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

# 十七、常用命令

安装依赖：

```bash
npm install
```

开发运行：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

Lint：

```bash
npm run lint
```

单元测试：

```bash
npm run test:unit
```

E2E 测试：

```bash
npm run test:e2e
```

完整构建：

```bash
npm run build
```

Main 进程构建：

```bash
npm run build:main
```

Preload 构建：

```bash
npm run build:preload
```