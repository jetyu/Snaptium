# NoteWizard 产品需求文档 (PRD)

## 1. 项目概述
NoteWizard 是一款基于 Electron 开发的现代化、跨平台桌面级笔记应用。它专注于提供极致的本地化写作体验，强调数据隐私与安全，支持 Markdown 语法，并集成 AI 辅助创作能力。

## 2. 核心功能模块

### 2.1 编辑器 (Editor)
*详见：[编辑器模块详解](./Modules/Editor_Module.md)*
- **底层引擎**: 基于 CodeMirror 6 实现。
- **预览保护**: 支持“只读模式”，防止用户在查阅时意外修改内容。
- **实时预览**: 左右分栏设计，支持同步滚动。

### 2.2 文件与工作区管理 (Workspace)
*详见：[工作区模块详解](./Modules/Workspace_Module.md)*
- **多层级树状结构**: 支持无限层级的“笔记本”与“笔记”组织。笔记实际是存储在PC或MAC上的md文件。
- **虚拟文件系统 (VFS)**: 基于 JSON 维护元数据，物理文件解耦存储。
- **搜索系统**: 支持按标题和内容全文检索。

### 2.3 安全与隐私 (Security)
*详见：[安全模块详解](./Modules/Security_Module.md)*
- **全局加密**: 基于 AES-256-GCM 算法的数据库全量加密。
- **恢复密钥体系**: 采用 12 段恢复密钥作为找回数据的唯一凭据，结合系统级 `safeStorage` 保护。

### 2.4 AI 智能辅助 (AI Assistant)
*详见：[AI 助手模块详解](./Modules/AI_Assistant_Module.md)*
- **AI 续写**: 提供上下文相关的内联写作建议。
- **高度配置化**: 支持自定义端点与 API Key。

### 2.5 导入与导出 (Import & Export)
*详见：[导入导出模块详解](./Modules/Import_Export_Module.md)*
- **.nwp 归档**: 持全量备份与跨设备迁移。
- **Markdown 兼容**: 支持与外部 Markdown 编辑器的数据互通。

### 2.6 数据架构与迁移 (Data Architecture & Migration)
*详见：[数据架构详解](./Modules/Data_Architecture_Migration.md)*
- **核心协议**: 明确 `nodes.jsonl` 与 `Database` 目录的标准。
- **兼容性保障**: 记录 1.x 到 2.x 的无缝平移逻辑。

### 2.7 UI/UX 框架与大纲 (UI Framework)
*详见：[UI/UX 框架详解](./Modules/UI_UX_Framework.md)*
- **大纲导航**: 实时标题提取与同步滚动。
- **布局管理**: 可调节面板与回收站 (Trash) 机制。

### 2.8 首选项与国际化 (Preferences & i18n)
*详见：[首选项模块详解](./Modules/User_Preferences_i18n.md)*
- **多语言支持**: 覆盖 19 种语言。
- **配置同步**: 自动备份与导入导出功能。

### 2.9 系统集成 (System Integration)
*详见：[系统集成详解](./Modules/System_Integration.md)*
- **IPC 桥接**: 强隔离的 `window.electronAPI` 规范。
- **托盘与菜单**: 系统级常驻与全局快捷键映射。

## 3. 技术架构总结
- **框架**: 项目使用 TypeScript, Electron 41, Vue 3, 和 CodeMirror 6
- **核心库**:
  - CodeMirror (编辑器)
  - Markdown-it (解析渲染)
  - Electron-Log (日志)
  - Electron-Updater (更新)
- **数据模型**: 分离物理存储与逻辑描述，支持快照式自动保存。

