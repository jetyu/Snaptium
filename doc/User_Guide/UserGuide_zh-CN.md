# NoteWizard 使用指南

**语言**: [简体中文](./NoteWizard_zh-CN.md) | [English](./NoteWizard_en-US.md)

<div align="center">
  <img src="../../src/assets/logo/app-logo-128.png" alt="NoteWizard Logo" width="96">
  <h3>现代化跨平台 Markdown 笔记应用</h3>
  <p>简单、纯粹、安全</p>
</div>

---

## 📖 目录

- [快速开始](#快速开始)
- [界面介绍](#界面介绍)
- [基础功能](#基础功能)
- [高级功能](#高级功能)
- [快捷键](#快捷键)
- [首选项设置](#首选项设置)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 安装应用

1. **下载安装包**
   - 访问 [GitHub Releases](https://github.com/jetyu/NoteWizard/releases)
   - 根据您的操作系统选择对应的安装包：
     - **Windows**: `NoteWizard_Windows_x64.exe`
     - **macOS**: `NoteWizard-macOS-x64.dmg` (Intel) 或 `NoteWizard-macOS-arm64.dmg` (Apple Silicon)
     - **Linux**: 
       - Ubuntu/Debian: `NoteWizard-Linux-amd64.deb`
       - Fedora/RHEL: `NoteWizard-Linux-x86_64.rpm`
       - 通用: `NoteWizard-Linux-x86_64.AppImage`

2. **安装步骤**
   
   **Windows:**
   - 双击 `.exe` 文件
   - 按照安装向导提示完成安装
   - 可选择安装位置和创建桌面快捷方式
   
   **macOS:**
   - 打开 `.dmg` 文件
   - 将 NoteWizard 拖拽到 Applications 笔记本
   - 首次运行可能需要在"系统偏好设置 > 安全性与隐私"中允许
   
   **Linux:**
   - `.deb`: `sudo dpkg -i NoteWizard_*.deb`
   - `.rpm`: `sudo rpm -i NoteWizard_*.rpm`
   - `.AppImage`: 添加执行权限后直接运行 `chmod +x NoteWizard_*.AppImage && ./NoteWizard_*.AppImage`

### 首次启动

1. **设置笔记保存路径**
   - 首次启动时，应用会提示您选择笔记保存位置
   - 默认路径：`文档/NoteWizard`
   - 您可以随时在首选项中更改此路径

2. **创建第一个笔记**
   - 点击左侧工具栏的"新建笔记"按钮（或按 `Ctrl+N`）
   - 输入笔记标题和内容
   - 笔记会自动保存

---

## 🖥️ 界面介绍

NoteWizard 采用三栏式布局，简洁高效：
![NoteWizard 界面预览](../Quick_Start/QuickStart_zhCN.webp)

### 左侧面板 - 文件树

- **笔记本结构**: 显示所有笔记的层级结构
- **搜索功能**: 快速查找笔记
- **右键菜单**: 新建、重命名、删除文件/笔记本
- **拖拽排序**: 支持拖拽文件到不同笔记本或根目录
- **多选功能**: `Ctrl+点击` 单个选择，`Shift+点击` 范围选择
- **自动滚动**: 拖拽到边缘时自动滚动

### 中间面板 - 编辑器

- **Markdown 编辑器**: 基于 CodeMirror 的强大编辑器
- **语法高亮**: 自动识别 Markdown 语法
- **自动保存**: 编辑内容自动保存，无需手动操作
- **行号显示**: 方便定位和编辑

### 右侧面板 - 预览

- **实时渲染**: 即时显示 Markdown 渲染效果
- **可切换显示**: 通过快捷键或菜单切换预览面板
- **同步滚动**: 编辑器和预览面板同步滚动（可选）

### 属性面板
- **信息展示**: 显示当前文档的字符数、行数和列数

---

## 📝 基础功能

### 1. 创建笔记

- 点击左侧工具栏的"新建笔记"按钮

### 2. 创建笔记本

- 在文件树中右键 → 新建笔记本
- 输入笔记本名称
- 笔记本支持多级嵌套

### 3. 编辑笔记

1. 在左侧文件树中点击要编辑的笔记
2. 在中间编辑器中输入内容
3. 支持完整的 Markdown 语法
4. 内容会自动保存

### 4. 保存笔记

- **自动保存**: 默认开启，编辑后自动保存
- **手动保存**: 按 `Ctrl+S` (Windows/Linux) 或 `Cmd+S` (macOS)
- **保存位置**: 在首选项中设置的笔记保存路径

### 5. 删除笔记

**删除到回收站:**
- 右键笔记 → 删除
- 删除的笔记会移动到回收站

**从回收站恢复:**
- 编辑 → 回收站 (或按 `Ctrl+Shift+T`)
- 选择要恢复的笔记
- 点击"恢复"按钮

**永久删除:**
- 在回收站中选择笔记
- 点击"永久删除"按钮
- ⚠️ 此操作不可恢复

### 6. 重命名

- 右键笔记/笔记本 → 重命名
- 输入新名称并确认

### 7. 移动笔记

**单个笔记:**
- 拖拽笔记到目标笔记本
- 拖拽笔记到根目录（空白区域）可将其移出笔记本

**多个笔记（多选）:**
- `Ctrl+点击`（macOS 为 `Cmd+点击`）：选中/取消选中单个笔记
- `Shift+点击`：选中上次点击和当前点击之间的所有笔记
- 拖拽任意一个选中的笔记，所有选中的笔记会一起移动
- 拖拽到文件树顶部/底部边缘时会自动滚动

### 8. 搜索笔记

- 在左侧面板顶部的搜索框中输入关键词
- 支持按文件名搜索
- 实时显示搜索结果
- 点击空白区域清除搜索

---

## 🎨 高级功能

### Markdown 语法支持

NoteWizard 支持完整的 Markdown 语法和扩展语法：

#### 基础语法

```markdown
# 一级标题
## 二级标题
### 三级标题

**粗体文本**
*斜体文本*
~~删除线~~

- 无序列表项 1
- 无序列表项 2

1. 有序列表项 1
2. 有序列表项 2

[链接文本](https://example.com)
![图片描述](图片URL)

> 引用文本

`行内代码`

​```javascript
// 代码块
function hello() {
  console.log("Hello, NoteWizard!");
}
​```
```

#### 表格

```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |
```

#### 任务列表

```markdown
- [x] 已完成的任务
- [ ] 未完成的任务
- [ ] 另一个任务
```

### 预览面板控制

**打开预览:**
- 快捷键: `Ctrl+Alt+P`
- 菜单: 视图 → 预览面板 → 打开

**关闭预览:**
- 快捷键: `Ctrl+Alt+Shift+P`
- 菜单: 视图 → 预览面板 → 关闭

**切换预览:**
- 快捷键: `Ctrl+Alt+\`
- 菜单: 视图 → 预览面板 → 切换

### 主题切换

NoteWizard 支持三种主题模式：

1. **浅色主题**: 适合白天使用
2. **深色主题**: 适合夜间使用，保护眼睛
3. **跟随系统**: 自动跟随系统主题设置

**切换方式:**
- 首选项 → 外观 → 主题模式

### 多语言支持

NoteWizard 支持 19 种语言：

- 简体中文 (zh-CN)
- 繁体中文 (zh-TW)
- English (en)
- 日本語 (ja)
- 한국어 (ko)
- Français (fr)
- Deutsch (de)
- Español (es)
- Português (pt)
- Русский (ru)
- Italiano (it)
- Nederlands (nl)
- Polski (pl)
- Türkçe (tr)
- العربية (ar)
- ไทย (th)
- Tiếng Việt (vi)
- Bahasa Indonesia (id)
- हिन्दी (hi)

**切换语言:**
- 首选项 → 通用 → 语言

### 导入/导出笔记

**导入笔记:**
- 文件 → 打开 (或 `Ctrl+O`)
- 选择 `.md` 文件
- 笔记内容会加载到编辑器

**导出笔记:**
- 选择保存位置
- 笔记会保存为 `.md` 文件 或者 nwp文件

### 首选项导入/导出

**导出首选项:**
- 首选项 → 高级 → 导出首选项
- 保存为 JSON 文件
- 可用于备份或迁移设置

**导入首选项:**
- 首选项 → 高级 → 导入首选项
- 选择之前导出的 JSON 文件
- 系统会自动创建当前设置的备份

---

## ⌨️ 快捷键

### 文件操作

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 新建笔记 | `Ctrl+N` | `Cmd+N` |
| 打开文件 | `Ctrl+O` | `Cmd+O` |
| 保存 | `Ctrl+S` | `Cmd+S` |
| 首选项 | `Ctrl+Shift+P` | `Cmd+Shift+P` |

### 编辑操作

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 撤销 | `Ctrl+Z` | `Cmd+Z` |
| 重做 | `Ctrl+Y` | `Cmd+Shift+Z` |
| 剪切 | `Ctrl+X` | `Cmd+X` |
| 复制 | `Ctrl+C` | `Cmd+C` |
| 粘贴 | `Ctrl+V` | `Cmd+V` |
| 全选 | `Ctrl+A` | `Cmd+A` |

### 视图操作

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 打开预览 | `Ctrl+Alt+P` | `Cmd+Option+P` |
| 关闭预览 | `Ctrl+Alt+Shift+P` | `Cmd+Option+Shift+P` |
| 切换预览 | `Ctrl+Alt+\` | `Cmd+Option+\` |

### 其他操作

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 打开回收站 | `Ctrl+Shift+T` | `Cmd+Shift+T` |
| 重命名 | `F2` | `F2` |
| 删除 | `Delete` | `Delete` |
| 多选（添加） | `Ctrl+点击` | `Cmd+点击` |
| 多选（范围） | `Shift+点击` | `Shift+点击` |
| 清除选择 | `点击空白区域` | `点击空白区域` |

---

## ⚙️ 首选项设置

通过 `Ctrl+Shift+P` (或菜单: 文件 → 首选项) 打开首选项面板。
![NoteWizard 界面预览](../preview/NoteWizard_2.png)
![NoteWizard 界面预览](../preview/NoteWizard_3.png)

### 通用设置

**语言**
- 选择界面显示语言
- 更改后需要重启应用

**笔记保存路径**
- 设置笔记的默认保存位置
- 点击"选择笔记本"按钮更改
- 建议选择易于访问和备份的位置

**开机自启动**
- 开启后，系统启动时自动运行 NoteWizard
- 应用会最小化到系统托盘

### 外观设置

**主题模式**
- 浅色: 白色背景，适合白天
- 深色: 黑色背景，适合夜间
- 跟随系统: 自动跟随系统主题

**编辑器字体**
- 字体大小: 12-24px
- 字体系列: 选择喜欢的字体
- 推荐使用等宽字体，如 Consolas、Monaco

**预览字体**
- 字体大小: 12-24px
- 字体系列: 选择喜欢的字体
- 推荐使用易读字体，如 Arial、微软雅黑
---

## ❓ 常见问题

### 1. 笔记保存在哪里？

Windows: 笔记默认保存在 `C:\Users\XXXX\Documents\NoteWizard` 目录。您可以在首选项中查看或更改保存路径。

### 2. 如何备份笔记？

**方法一：手动备份**
- 找到笔记保存目录
- 复制整个笔记本到备份位置

**方法二：使用云同步**(正在开发中)
- 将笔记保存路径设置到云盘同步笔记本（如 OneDrive、Dropbox、iCloud）
- 笔记会自动同步到云端

### 3. 如何在多台设备间同步笔记？(正在开发中)

1. 将笔记保存路径设置到云盘同步笔记本
2. 在其他设备上安装 NoteWizard
3. 将笔记保存路径设置为同一个云盘笔记本
4. 笔记会自动同步

### 4. 删除的笔记可以恢复吗？

可以。删除的笔记会移动到回收站：
- 打开回收站: `Ctrl+Shift+T`
- 选择要恢复的笔记
- 点击"恢复"按钮

⚠️ 从回收站永久删除后无法恢复。

### 5. 如何更改界面语言？

1. 打开首选项 (`Ctrl+Shift+P`)
2. 通用 → 语言
3. 选择目标语言
4. 重启应用生效

### 6. 预览面板不显示怎么办？

- 按 `Ctrl+Alt+P` 打开预览面板
- 或通过菜单: 视图 → 预览面板 → 打开

### 7. 如何导出笔记为 PDF 或其他格式？(正在开发中)

目前 NoteWizard 原生支持 Markdown 格式。如需导出为其他格式：
- 使用在线工具（如 Pandoc）转换
- 或从预览面板复制内容到其他应用

### 8. 如何卸载 NoteWizard？

**Windows:**
- 控制面板 → 程序和功能 → 卸载 NoteWizard
- 或使用安装目录中的卸载程序

**macOS:**
- 将 Applications 笔记本中的 NoteWizard 拖到废纸篓

**Linux:**
- `.deb`: `sudo apt remove notewizard`
- `.rpm`: `sudo rpm -e notewizard`
- `.AppImage`: 直接删除文件

⚠️ 卸载应用不会删除笔记文件。

### 9. 如何联系技术支持？

- GitHub Issues: https://github.com/jetyu/NoteWizard/issues

### 10. 临时紧急解密笔记方法
在**已保存恢复密钥**的前提下，若因**重装系统**或**误删** `C:\Users\<用户名>\AppData\Roaming\NoteWizard` 目录导致数据无法解密，可按以下步骤进行恢复：

#### 恢复步骤
1. 打开文件：
`C:\Users\<用户名>\Documents\NoteWizard\meta.json`
2. 使用文本编辑器编辑该文件，新增以下字段：
`"tempRecoveryKey": "XXXX-XXXX-XXXX-XXXX-XXXX"`

保存文件并重启 NoteWizard。应用将使用临时恢复密钥完成解密。解密成功后请立即导出笔记并妥善备份数据。

**meta.json 示例**
```json
{
  "workspaceId": "15bd8fc0-f360-4d8a-8ee4-f70ce645c2c3",
  "version": 1,
  "createdAt": 1768483861965,
  "lastOpenedAt": 1768483861965,
  "tempRecoveryKey": "XXXX-XXXX-XXXX-XXXX-XXXX",
  "encrypted": true
}
```

### Markdown 学习

- [Markdown 官方教程](https://markdown.com.cn/)
- [Markdown 语法速查](https://markdown.com.cn/cheat-sheet.html)
- [GitHub Markdown 指南](https://guides.github.com/features/mastering-markdown/)

### NoteWizard 相关

- [GitHub 仓库](https://github.com/jetyu/NoteWizard)
- [问题反馈](https://github.com/jetyu/NoteWizard/issues)
- [更新日志](https://github.com/jetyu/NoteWizard/releases)

---

## 🎉 结语

感谢您选择 NoteWizard！我们致力于为您提供简单、纯粹、高效的笔记体验。

如果您在使用过程中遇到任何问题或有任何建议，欢迎通过 GitHub Issues 与我们联系。

祝您使用愉快！✨

---

**NoteWizard Team**  
版本: 0.2.0  
最后更新: 2025-12-18
