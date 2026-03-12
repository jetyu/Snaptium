# NoteWizard 模块文档：系统通用特性 (System General)

## 1. 自动更新机制 (Auto-Updater)
- **底层架构**: 基于 `electron-updater` 实现。
- **运行策略**:
  - **背景静默检查**: 每 4 小时执行一次周期性检查。
  - **强制更新提示**: 发现新版本后，弹出原生对话框。支持“立即下载”与“稍后”。
  - **下载管理**: 借用 `progressBar` 在任务栏同步下载进度。
- **自定义发布页**: 在开发模式下，支持跳转至 GitHub Release 页面。

## 2. 日志与故障追踪 (Logging System)
- **存储方案**: 分布于 `userData/logs/` 目录。
- **分级策略**: `debug`, `info`, `warn`, `error`。
- **维护逻辑**:
  - **自动清理**: 启动时检查并清理过期的旧日志文件。
  - **全量导出**: 支持一键打包整个 `logs` 目录为 `.zip`，方便故障排查。

## 3. 多窗口与实例控制 (Core Management)
- **单实例锁定**: 使用 `app.requestSingleInstanceLock()` 确保全局唯一。
- **外部协议 (Deep Linking)**: (预留) 支持通过自定义协议唤起特定笔记。

## 4. 调试模式
- **开发者工具**: 通过菜单或快捷键开启。
- **控制台扩展**: 在 `debug` 等级下，记录 IPC 通行的详细 Payload。
