# NoteWizard 模块文档：系统集成与通信 (System Integration)

## 1. IPC 通信桥梁 (Bridge)
NoteWizard 采用强隔离的 `contextBridge` 方案，通过 `preload.js` 向渲染进程暴露受限的 API。
- **主进程功能映射**:
  - `fs`: 异步与同步的文件系统操作（readFile, writeFile, exists, etc.）。
  - `path`: 跨平台路径处理。
  - `dialog`: 调用原生的保存、打开与消息框。
  - `shell`: 外部链接打开与文件管理器定位。
- **2.0 迁移要求**: v2.0 必须维持 `window.electronAPI` 命名空间及其内部方法签名的一致性，确保旧有的 VFS 逻辑无需修改即可运行。

## 2. 托盘管理 (System Tray)
- **常驻入口**: 即使窗口关闭，应用也可在系统托盘保留。
- **核心功能**:
  - 单击/双击：切换主窗口显示/隐藏。
  - 右键菜单：包含“快速笔记”、“最近文件”、“首选项”与“退出”。
- **状态同步**: 托盘图标会根据“自动更新完成”或“加密状态”显示不同的提示或小红点。

## 3. 启动与初始化 (Startup)
1. **单实例锁定**: 确保同一时间仅运行一个 NoteWizard 实例。
2. **UserData 校验**: 启动时检查 `preferences.json` 是否存在，若缺失则从 `defaults.js` 初始化。
3. **窗口恢复**: 记录并恢复上次关闭时的窗口坐标与缩放比例。
