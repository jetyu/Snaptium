# NoteWizard 模块文档：编辑器 (Editor)

## 1. 核心引擎
- **CodeMirror 5**: 采用 CodeMirror 5 作为底盘（v1.x），支持 Markdown 语法高亮。
- **配置项**:
  - `lineNumbers`: 开启行号。
  - `lineWrapping`: 自动换行。
  - `inputStyle`: `contenteditable`（优化中文输入法兼容性）。

## 2. 只读模式与预览保护 (Read-Only Mode)
- **定位**: 旨在作为一种 **UX 保护机制**。
- **功能逻辑**:
  - 当切换到“只读模式”（树状图显示🔐图标）时，CodeMirror 实例的 `readOnly` 属性被激活。
  - **初衷**: 防止用户在翻阅、搜索或演示笔记时，因误触键盘而意外修改、删除重要的笔记内容。
- **视觉反馈**: 锁定状态的笔记在侧边栏会有明显图标标记，编辑器区域将禁止任何文本输入。

## 3. 工具栏与快捷键
- **Markdown 格式化**: 支持加粗 (`Ctrl+B`)、斜体 (`Ctrl+I`)、引用、列表、代码块、表格、链接与图片。
- **快捷键**: 
  - `Ctrl+S`: 强制保存。
  - `Tab`: 应用 AI 建议或缩进。

- **加注**: 采用 **线性插值 (Linear Interpolation)** 算法实现双向滚动同步。通过缓存预览区域带有 `data-source-line` 属性的 DOM 偏移量，实现编辑器与预览区的对齐。

## 5. 媒体与数据保护
- **图片粘贴**: 支持图片粘贴与拖拽，图片保存至 `Database/images/[contentId]/` 下。必须在选中具体笔记节点后方可操作。
- **自动创建 (Auto-Untitled)**: 当编辑器有内容但未选中节点时，自动在根目录创建“未命名笔记”并写入内容。
- **立即保存 (Force Save)**: 支持 `Ctrl+S`。在窗口关闭或切换笔记时，会触发 `forceFlushAutoSave` 逻辑，确保数据落盘。
