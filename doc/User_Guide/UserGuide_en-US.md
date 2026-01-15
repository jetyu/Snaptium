# NoteWizard User Guide

**Language**: [English](./NoteWizard_en-US.md) | [简体中文](./NoteWizard_zh-CN.md)

<div align="center">
  <img src="../../src/assets/logo/app-logo-128.png" alt="NoteWizard Logo" width="96">
  <h3>Modern Cross-Platform Markdown Note-Taking App</h3>
  <p>Simple, Pure, Secure</p>
</div>

---

## 📖 Table of Contents

- [Quick Start](#quick-start)
- [Interface Overview](#interface-overview)
- [Basic Features](#basic-features)
- [Advanced Features](#advanced-features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Preferences Settings](#preferences-settings)
- [FAQ](#faq)

---

## 🚀 Quick Start

### Installing the App

1. **Download the Installer**
   - Visit [GitHub Releases](https://github.com/jetyu/NoteWizard/releases)
   - Choose the installer for your operating system:
     - **Windows**: `NoteWizard_Windows_x64.exe`
     - **macOS**: `NoteWizard-macOS-x64.dmg` (Intel) or `NoteWizard-macOS-arm64.dmg` (Apple Silicon)
     - **Linux**: 
       - Ubuntu/Debian: `NoteWizard-Linux-amd64.deb`
       - Fedora/RHEL: `NoteWizard-Linux-x86_64.rpm`
       - Universal: `NoteWizard-Linux-x86_64.AppImage`

2. **Installation Steps**
   
   **Windows:**
   - Double-click the `.exe` file
   - Follow the installation wizard
   - Optionally choose installation location and create desktop shortcut
   
   **macOS:**
   - Open the `.dmg` file
   - Drag NoteWizard to the Applications folder
   - First launch may require approval in "System Preferences > Security & Privacy"
   
   **Linux:**
   - `.deb`: `sudo dpkg -i NoteWizard_*.deb`
   - `.rpm`: `sudo rpm -i NoteWizard_*.rpm`
   - `.AppImage`: Add execute permission and run `chmod +x NoteWizard_*.AppImage && ./NoteWizard_*.AppImage`

### First Launch

1. **Set Notes Save Path**
   - On first launch, the app will prompt you to choose a notes save location
   - Default path: `Documents/NoteWizard`
   - You can change this path anytime in Preferences

2. **Create Your First Note**
   - Click the "New Note" button in the left toolbar (or press `Ctrl+N`)
   - Enter note title and content
   - Notes are automatically saved

---

## 🖥️ Interface Overview

NoteWizard features a clean three-column layout:
![NoteWizard Interface Preview](../preview/NoteWizard_1.png)

### Left Panel - File Tree

- **Notebook Structure**: Displays hierarchical structure of all notes
- **Search Function**: Quickly find notes
- **Context Menu**: Create, rename, delete files/notebooks
- **Drag & Drop**: Drag files to different notebooks or root directory
- **Multi-Select**: `Ctrl+Click` for individual selection, `Shift+Click` for range selection
- **Auto-Scroll**: Automatically scrolls when dragging near edges

### Middle Panel - Editor

- **Markdown Editor**: Powerful editor based on CodeMirror
- **Syntax Highlighting**: Automatic Markdown syntax recognition
- **Auto-Save**: Content automatically saves without manual operation
- **Line Numbers**: Easy navigation and editing

### Right Panel - Preview

- **Live Rendering**: Instant Markdown rendering display
- **Toggle Display**: Switch preview panel via shortcuts or menu
- **Synchronized Scrolling**: Editor and preview panel scroll together (optional)

---

## 📝 Basic Features

### 1. Create Note

- Click the "New Note" button in the left toolbar

### 2. Create Notebook

- Right-click in file tree → New Notebook
- Enter notebook name
- Notebooks support multi-level nesting

### 3. Edit Note

1. Click the note you want to edit in the left file tree
2. Enter content in the middle editor
3. Supports full Markdown syntax
4. Content automatically saves

### 4. Save Note

- **Auto-Save**: Enabled by default, automatically saves after editing
- **Manual Save**: Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (macOS)
- **Save Location**: Notes save path set in Preferences

### 5. Delete Note

**Delete to Trash:**
- Right-click note → Delete
- Deleted notes move to trash

**Restore from Trash:**
- Edit → Trash (or press `Ctrl+Shift+T`)
- Select note to restore
- Click "Restore" button

**Permanent Delete:**
- Select note in trash
- Click "Permanent Delete" button
- ⚠️ This action cannot be undone

### 6. Rename

- Right-click note/notebook → Rename
- Enter new name and confirm

### 7. Move Note

**Single Note:**
- Drag note to target notebook
- Drag note to root directory (empty area) to move it out of notebook

**Multiple Notes (Multi-Select):**
- `Ctrl+Click` (or `Cmd+Click` on macOS): Select/deselect individual notes
- `Shift+Click`: Select range of notes between last clicked and current clicked
- Drag any selected note to move all selected notes together
- Auto-scroll when dragging near top/bottom edge of file tree

### 8. Search Notes

- Enter keywords in search box at top of left panel
- Supports search by filename
- Real-time display of search results
- Click empty area to clear search

---

## 🎨 Advanced Features

### Markdown Syntax Support

NoteWizard supports full Markdown syntax and extensions:

#### Basic Syntax

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
~~Strikethrough~~

- Unordered list item 1
- Unordered list item 2

1. Ordered list item 1
2. Ordered list item 2

[Link text](https://example.com)
![Image description](image-URL)

> Quote text

`Inline code`

​```javascript
// Code block
function hello() {
  console.log("Hello, NoteWizard!");
}
​```
```

#### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
```

#### Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

### Preview Panel Control

**Open Preview:**
- Shortcut: `Ctrl+Alt+P`
- Menu: View → Preview Panel → Open

**Close Preview:**
- Shortcut: `Ctrl+Alt+Shift+P`
- Menu: View → Preview Panel → Close

**Toggle Preview:**
- Shortcut: `Ctrl+Alt+\`
- Menu: View → Preview Panel → Toggle

### Theme Switching

NoteWizard supports three theme modes:

1. **Light Theme**: Suitable for daytime use
2. **Dark Theme**: Suitable for nighttime use, protects eyes
3. **Follow System**: Automatically follows system theme settings

**Switch Method:**
- Preferences → Appearance → Theme Mode

### Multi-Language Support

NoteWizard supports 19 languages:

- Simplified Chinese (zh-CN)
- Traditional Chinese (zh-TW)
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

**Switch Language:**
- Preferences → General → Language

### Import/Export Notes (In Development)

**Import Notes:**
- File → Open (or `Ctrl+O`)
- Select `.md` file
- Note content loads into editor

**Export Notes:**
- File → Save (or `Ctrl+S`)
- Choose save location
- Note saves as `.md` file

### Preferences Import/Export

**Export Preferences:**
- Preferences → Advanced → Export Preferences
- Save as JSON file
- Can be used for backup or migration

**Import Preferences:**
- Preferences → Advanced → Import Preferences
- Select previously exported JSON file
- System automatically creates backup of current settings

---

## ⌨️ Keyboard Shortcuts

### File Operations

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| New Note | `Ctrl+N` | `Cmd+N` |
| Open File | `Ctrl+O` | `Cmd+O` |
| Save | `Ctrl+S` | `Cmd+S` |
| Preferences | `Ctrl+Shift+P` | `Cmd+Shift+P` |

### Edit Operations

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Undo | `Ctrl+Z` | `Cmd+Z` |
| Redo | `Ctrl+Y` | `Cmd+Shift+Z` |
| Cut | `Ctrl+X` | `Cmd+X` |
| Copy | `Ctrl+C` | `Cmd+C` |
| Paste | `Ctrl+V` | `Cmd+V` |
| Select All | `Ctrl+A` | `Cmd+A` |

### View Operations

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Open Preview | `Ctrl+Alt+P` | `Cmd+Option+P` |
| Close Preview | `Ctrl+Alt+Shift+P` | `Cmd+Option+Shift+P` |
| Toggle Preview | `Ctrl+Alt+\` | `Cmd+Option+\` |

### Other Operations

| Function | Windows/Linux | macOS |
|----------|---------------|-------|
| Open Trash | `Ctrl+Shift+T` | `Cmd+Shift+T` |
| Rename | `F2` | `F2` |
| Delete | `Delete` | `Delete` |
| Multi-Select (Add) | `Ctrl+Click` | `Cmd+Click` |
| Multi-Select (Range) | `Shift+Click` | `Shift+Click` |
| Clear Selection | `Click Empty Area` | `Click Empty Area` |

---

## ⚙️ Preferences Settings

Open Preferences panel via `Ctrl+Shift+P` (or menu: File → Preferences).
![NoteWizard Interface Preview](../preview/NoteWizard_2.png)
![NoteWizard Interface Preview](../preview/NoteWizard_3.png)

### General Settings

**Language**
- Select interface display language
- Requires app restart after change

**Notes Save Path**
- Set default save location for notes
- Click "Choose Folder" button to change
- Recommend choosing easily accessible and backup-friendly location

**Launch on Startup**
- When enabled, NoteWizard runs automatically on system startup
- App minimizes to system tray

### Appearance Settings

**Theme Mode**
- Light: White background, suitable for daytime
- Dark: Black background, suitable for nighttime
- Follow System: Automatically follows system theme

**Editor Font**
- Font Size: 12-24px
- Font Family: Choose preferred font
- Recommend monospace fonts like Consolas, Monaco

**Preview Font**
- Font Size: 12-24px
- Font Family: Choose preferred font
- Recommend readable fonts like Arial, Microsoft YaHei
---

## ❓ FAQ

### 1. Where are notes saved?

Windows: Notes are saved by default in `C:\Users\XXXX\Documents\NoteWizard` directory. You can view or change the save path in Preferences.

### 2. How to backup notes?

**Method 1: Manual Backup**
- Find notes save directory
- Copy entire folder to backup location

**Method 2: Cloud Sync** (In Development)
- Set notes save path to cloud sync folder (like OneDrive, Dropbox, iCloud)
- Notes automatically sync to cloud

### 3. How to sync notes across multiple devices? (In Development)

1. Set notes save path to cloud sync folder
2. Install NoteWizard on other devices
3. Set notes save path to same cloud folder
4. Notes automatically sync

### 4. Can deleted notes be recovered?

Yes. Deleted notes move to trash:
- Open trash: `Ctrl+Shift+T`
- Select note to restore
- Click "Restore" button

⚠️ Cannot recover after permanent deletion from trash.

### 5. How to change interface language?

1. Open Preferences (`Ctrl+Shift+P`)
2. General → Language
3. Select target language
4. Restart app to apply

### 6. What if preview panel doesn't show?

- Press `Ctrl+Alt+P` to open preview panel
- Or via menu: View → Preview Panel → Open

### 7. How to export notes as PDF or other formats? (In Development)

Currently NoteWizard natively supports Markdown format. To export to other formats:
- Use online tools (like Pandoc) for conversion
- Or copy content from preview panel to other applications

### 8. How to uninstall NoteWizard?

**Windows:**
- Control Panel → Programs and Features → Uninstall NoteWizard
- Or use uninstaller in installation directory

**macOS:**
- Drag NoteWizard from Applications folder to Trash

**Linux:**
- `.deb`: `sudo apt remove notewizard`
- `.rpm`: `sudo rpm -e notewizard`
- `.AppImage`: Delete file directly

⚠️ Uninstalling the app does not delete note files.

### 9. How to contact technical support?

- GitHub Issues: https://github.com/jetyu/NoteWizard/issues

### 10. Temporary Emergency Decryption Method
Assuming you have **saved the recovery key**, if you cannot decrypt your data due to **system reinstallation** or **accidental deletion** of the
`C:\Users\<username>\AppData\Roaming\NoteWizard`
directory, you can recover by following these steps:

### Recovery Steps
1. Open the file:
`C:\Users\<username>\Documents\NoteWizard\meta.json`
2. Edit the file using a text editor and add the following field:
`"tempRecoveryKey": "XXXX-XXXX-XXXX-XXXX-XXXX"`

Save the file and restart NoteWizard. The application will use the temporary recovery key to complete decryption. After successful decryption, please immediately export your notes and securely backup your data.

meta.json
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

---

## 📚 More Resources

### Markdown Learning

- [Markdown Official Tutorial](https://www.markdownguide.org/)
- [Markdown Cheat Sheet](https://www.markdownguide.org/cheat-sheet/)
- [GitHub Markdown Guide](https://guides.github.com/features/mastering-markdown/)

### NoteWizard Related

- [GitHub Repository](https://github.com/jetyu/NoteWizard)
- [Issue Reporting](https://github.com/jetyu/NoteWizard/issues)
- [Changelog](https://github.com/jetyu/NoteWizard/releases)

---

## 🎉 Conclusion

Thank you for choosing NoteWizard! We are committed to providing you with a simple, pure, and efficient note-taking experience.

If you encounter any issues or have suggestions during use, please contact us via GitHub Issues.

Happy note-taking! ✨

---

**NoteWizard Team**  
Version: 0.2.0  
Last Updated: 2025-12-18
