# NoteWizard 模块文档：首选项与国际化 (Preferences & i18n)

## 1. 配置模型 (Preferences Schema)
配置文件存储于 `userData/preferences.json`。
- **核心键值**:
  - `noteSavePath`: 工作区物理根路径。
  - `language`: 当前 UI 语言 (e.g., `zh-CN`, `en-US`)。
  - `themeMode`: `light` | `dark` | `system`。
  - `editor`: 字体、字号、换行策略。
  - `encryption`: 含有 `enabled` (Boolean) 和 `recoveryKeyHash`。
- **备份机制**: 导入配置前，系统会自动生成 `preferences_backup.json`，确保配置迁移安全。

## 2. 国际化 (i18n)
- **多语言覆盖**: 目前支持 19 种语言，资源文件位于 `locales/*.json`。
- **动态应用**: 
  - 支持 `data-i18n` 属性自动遍历 DOM 替换文本。
  - 支持渲染进程通过 `t(key)` 实时获取翻译。
  - **重要**: 语言切换会联动更新原生菜单栏 (Application Menu) 与托盘菜单。

## 3. 输入法优化 (IME Optimization)
针对中文、日文等复杂输入法，编辑器层通过 `inputStyle: 'contenteditable'` 确保在 CodeMirror 中输入时不产生断层或乱码。
