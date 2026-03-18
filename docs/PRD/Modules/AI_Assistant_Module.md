# NoteWizard 模块文档：AI 助手与全文搜索 (AI & Search)

## 1. AI 智能助手 (AI Assistant)
提供基于 OpenAI 兼容接口的续写功能。

### 1.1 触发机制
- **自动触发**: 当用户输入长度超过 `minInputLength`（默认 10 字符）且停止输入达 `typingDelay`（默认 2000ms）后自动请求。
- **上下文提取**: 向上通过回溯 3 行或当前行光标前文本作为上下文发送。
- **配置项**: 存储于 `aiSettings`，包括 `apiKey`, `endpoint`, `model`, `systemPrompt`, `enabled` 等。

### 1.2 响应与显示 (Non-Streaming)
- **非流式显示**: v1.x 使用 `stream: false`，获取完整响应后一次性显示。
- **内联建议**: 使用 CodeMirror 的 `markText` 将建议文本设为灰色（`ai-suggestion-inline` 样式）。
- **操作指令**:
  - `Tab` / `Right Arrow`: 采纳当前 AI 建议。
  - `Esc` / `Ctrl+/`: 隐藏/拒绝建议。
  - 光标一旦移动到建议范围外，建议自动消失。

---

## 2. 全文搜索系统 (Full-text Search)
支持大规模笔记库的高效搜索。

### 2.1 搜索算法与性能
- **分批处理**: 全文搜索采用 Batch 模式（每批 50 个节点），通过 `Promise.all` 并发读取内容，避免阻塞渲染进程。
- **混合索引**: 标题搜索基于内存中的 Map 瞬时响应；内容搜索按更新时间倒序进行全文本匹配。
- **频率控制**: 设置 300ms 搜索防抖（Debounce）及 `AbortController` 取消逻辑。

### 2.2 用户界面 (UI)
- **高亮显示**: 标题匹配使用 `<mark>` 标签在树列表中实时高亮；内容匹配提取上下文片段（前后 50 字符）并在状态栏反馈进度。
- **多模式**: 支持“标题”、“内容”或“全部”三种搜索范围。
