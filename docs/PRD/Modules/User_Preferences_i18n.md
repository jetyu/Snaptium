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