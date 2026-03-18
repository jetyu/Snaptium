# NoteWizard 开发指南（DevGuide）

> 目标：本指南用于团队持续开发，解释目录职责、架构协作方式，以及新增功能的标准落位规范。

------------------------------------------------------------------------

# 1. 整体架构总览

NoteWizard 采用：

Electron + Vue3 + TypeScript

并结合：

Feature-based 模块化架构

系统分为三个运行层：

Main Process\
Preload Bridge\
Renderer Application

对应目录：

electron/main\
electron/preload\
src/renderer

------------------------------------------------------------------------

# 2. Electron 三层架构

## Main Process

目录：

electron/main

职责：

-   窗口生命周期
-   系统能力
-   文件系统访问
-   IPC handler
-   应用状态管理

运行环境：

Node.js

拥有完整系统权限。

------------------------------------------------------------------------

## Preload

目录：

electron/preload

职责：

-   暴露受控 API
-   隔离 Renderer 与 Node
-   防止直接访问系统能力

技术：

contextBridge.exposeInMainWorld

------------------------------------------------------------------------

## Renderer

目录：

src/renderer

职责：

-   UI 组件
-   业务逻辑
-   状态管理
-   页面路由

Renderer 禁止直接访问 Node API。

只能通过：

window.electronAPI

访问系统能力。

------------------------------------------------------------------------

# 3. 架构调用链

标准调用流程：

View / Component\
↓\
Composable\
↓\
Feature Service\
↓\
Electron Bridge\
↓\
Preload API\
↓\
IPC Channel\
↓\
Main Service\
↓\
Node / Filesystem

优势：

-   UI 与系统能力解耦
-   IPC 统一管理
-   安全边界清晰

------------------------------------------------------------------------

# 4. 项目目录结构

    NoteWizard
    │
    ├─ electron
    │   ├─ main
    │   │   ├─ windows
    │   │   ├─ ipc
    │   │   │   └─ modules
    │   │   ├─ services
    │   │   ├─ store
    │   │   ├─ utils
    │   │   └─ constants
    │   │
    │   └─ preload
    │
    ├─ src
    │   └─ renderer
    │       ├─ app
    │       ├─ features
    │       ├─ core
    │       ├─ shared
    │       ├─ router
    │       ├─ store
    │       └─ config
    │
    ├─ tests
    │   ├─ unit
    │   └─ e2e
    │
    └─ docs

------------------------------------------------------------------------

# 5. Main 进程结构

目录：

electron/main

## 主入口

electron/main/index.js

职责：

-   单实例锁
-   App ready
-   创建窗口
-   注册 IPC
-   macOS activate
-   window-all-closed 处理

------------------------------------------------------------------------

## windows

electron/main/windows

示例：

mainWindow.js

负责：

-   创建窗口
-   BrowserWindow 安全配置

contextIsolation: true\
sandbox: true\
nodeIntegration: false

------------------------------------------------------------------------

## ipc

electron/main/ipc

结构：

ipc\
├─ index.js\
└─ modules

职责：

-   统一注册 IPC
-   按业务模块拆分 handler

示例：

ipc/modules/editor.js\
ipc/modules/workspace.js\
ipc/modules/settings.js

------------------------------------------------------------------------

## services

electron/main/services

系统能力封装。

示例：

file.service.js\
workspace.service.js\
settings.service.js

职责：

-   文件 IO
-   数据持久化
-   系统操作

------------------------------------------------------------------------

## store

electron/main/store

Main 进程状态管理。

示例：

app.store.js\
window.store.js\
recentFiles.store.js

------------------------------------------------------------------------

## constants

electron/main/constants

示例：

channels.js\
app.constants.js

------------------------------------------------------------------------

## utils

electron/main/utils

通用工具：

safeDialog.js\
path.js

------------------------------------------------------------------------

# 6. Preload 层

目录：

electron/preload

入口：

index.js

通过：

contextBridge.exposeInMainWorld

暴露 API。

示例：

window.electronAPI.openFile()\
window.electronAPI.saveFile()

原则：

-   只暴露最小 API
-   不包含业务逻辑
-   仅做 IPC 转发

------------------------------------------------------------------------

# 7. Renderer 层结构

目录：

src/renderer

    renderer
    ├─ app
    ├─ features
    ├─ core
    ├─ shared
    ├─ router
    ├─ store
    └─ config

------------------------------------------------------------------------

# 8. core（技术核心层）

src/renderer/core

用于封装底层技术能力。

特点：

-   不依赖 UI
-   不依赖业务
-   可被多个 feature 复用

示例结构：

    core
    ├─ editor
    │   ├─ createCodeEditor.ts
    │   └─ editorExtensions.ts
    │
    ├─ markdown
    │   ├─ markdownService.ts
    │   ├─ markdownPlugins.ts
    │   └─ sanitize.ts
    │
    └─ filesystem

------------------------------------------------------------------------

# 9. features（业务模块）

src/renderer/features

示例：

features/editor\
features/workspace\
features/preview\
features/settings

推荐结构：

    feature-name
    ├─ components
    ├─ composables
    ├─ services
    ├─ store
    ├─ constants
    └─ index.ts

------------------------------------------------------------------------

# 10. shared（共享模块）

src/renderer/shared

    shared
    ├─ components
    ├─ composables
    ├─ utils
    ├─ constants
    └─ types

------------------------------------------------------------------------

# 11. Import 规则

features 可以 import：

-   core
-   shared
-   自身 feature

features 不允许 import 其他 feature。

core 与 shared 不能依赖 features。

------------------------------------------------------------------------

# 12. 测试结构

    tests
    ├─ unit
    └─ e2e

unit：Vitest

e2e：Playwright

------------------------------------------------------------------------

# 13. 已使用工程实践

-   TypeScript
-   ESLint
-   Pinia
-   Vitest
-   Playwright
-   Zod（IPC 校验）
-   sanitize-html（Markdown 安全）

------------------------------------------------------------------------

# 14. 新增功能开发规范

以 tags 模块为例。

创建：

src/renderer/features/tags

结构：

components/TagList.vue\
composables/useTags.ts\
services/tags.service.ts\
store/tags.store.ts\
constants/tags.constants.ts

系统能力：

electron/main/ipc/modules/tags.js

注册：

electron/main/ipc/index.js

Preload：

electron/preload/index.js

Renderer：

services/electronApi.ts

测试：

tests/unit/tags.service.test.ts\
tests/e2e/tags.spec.ts

------------------------------------------------------------------------

# 15. 安全规范

Renderer 禁止直接使用 Node API。

IPC 输入必须通过 Zod 校验。

Markdown 必须 sanitize-html 白名单清洗。

外链必须使用：

target="\_blank"\
rel="noopener noreferrer nofollow"

------------------------------------------------------------------------

# 16. 常用命令

npm install\
npm run dev\
npm run lint\
npm run typecheck\
npm run test:unit\
npm run test:e2e\
npm run build

------------------------------------------------------------------------

# 17. 架构演进方向

未来可扩展模块：

plugins\
ai\
platform

示例：

    renderer
    ├─ app
    ├─ features
    ├─ core
    ├─ shared
    ├─ plugins
    ├─ ai
    └─ platform
