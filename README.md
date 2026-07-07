# Snaptium

<div align="center">

**Language / 语言：** [English](README.md) | [简体中文](README_CN.md)

</div>

<div align="center">
  <img src="electron/assets/logo/app-logo-128.png" alt="Snaptium Logo" width="88">

# Snaptium
**Tips:NoteWizard has been fully upgraded to Snaptium. If you need to use the previous NoteWizard version, please download it from [here](https://github.com/jetyu/Snaptium/releases/tag/v1.2.1).**

[Official Website](https://snaptium.com) [Official Docs](https://snaptium.com/docs) [Download](https://snaptium.com/#download)
### Local-first Markdown Intelligent Writing & Knowledge Management Workspace

A modern cross-platform Markdown intelligent workspace built with Electron + Vue 3.  
Focused on deep writing, knowledge management, and a local-first experience, supporting AI-assisted writing, knowledge bases, end-to-end encrypted sync, and multi-device collaboration.

[![Snaptium Release](https://github.com/jetyu/Snaptium/actions/workflows/build.yml/badge.svg?event=push)](https://github.com/jetyu/Snaptium/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/jetyu/Snaptium?style=flat&logo=github)](https://github.com/jetyu/Snaptium/releases/latest)
![GitHub Pre-release](https://img.shields.io/github/v/release/jetyu/Snaptium?include_prereleases&label=pre-release&logo=github)
[![Downloads](https://img.shields.io/github/downloads/jetyu/Snaptium/total?style=flat&logo=github)](https://github.com/jetyu/Snaptium/releases)
![GitHub Repo stars](https://img.shields.io/github/stars/jetyu/Snaptium?style=flat)
![GitHub forks](https://img.shields.io/github/forks/jetyu/Snaptium?style=flat)

![Platform](https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux-blue?style=flat)
![Electron](https://img.shields.io/badge/Electron-41.2.1-47848F?style=flat&logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3.5.32-42b883?style=flat&logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?style=flat&logo=typescript&logoColor=white)

[![Open Issues](https://img.shields.io/github/issues/jetyu/Snaptium?style=flat&color=orange)]()
[![Closed Issues](https://img.shields.io/github/issues-closed/jetyu/Snaptium?style=flat&color=brightgreen)]()
[![License](https://img.shields.io/github/license/jetyu/Snaptium?style=flat)](https://github.com/jetyu/Snaptium/blob/main/LICENSE)
 
</div>

# ✨ Project Positioning

Snaptium is not just another Markdown note-taking tool.  
It is an intelligent writing space built around "long-term writing, knowledge accumulation, and local AI workflows."

The project emphasizes:

- **Local First**
- **Data Sovereignty**
- **Long-term Sustainable Storage**
- **AI-Assisted, Not AI-Locked**
- **Offline Usability**
- **Consistent Multi-platform Experience**

---

# 🚀 Core Features

## 📝 Markdown Intelligent Writing

- Modern editor based on CodeMirror
- Real-time Markdown rendering preview
- Synchronized scrolling between editor and preview
- Math formula (KaTeX) support
- Code highlighting support
- Task lists / Tables / Footnotes / Markup syntax support
- Dark mode and immersive writing experience

---

## 🤖 AI Intelligent Assistance

Supports integration with multiple AI services for:

- AI-assisted writing
- Content polishing
- Intelligent Q&A
- Document summarization
- Ask Knowledge Copilot (RAG)
- Semantic search

Supports custom models and APIs:

- OpenAI
- OpenRouter
- DeepSeek
- Gemini
- Claude
- Ollama (Local models)
- Third-party services compatible with OpenAI API

> By default, AI features are disabled. All AI capabilities are manually configured by the user.

---

## 🔒 Local-first & Privacy Security

Snaptium is designed with a Local First architecture:

- Local storage by default
- No mandatory login
- No dependence on centralized servers
- Full user control over data

Supports:

- AES-256-GCM local encryption
- Workspace Password
- Recovery Key
- End-to-End Encrypted Sync (E2EE)
Even when using object storage for sync, only encrypted data is stored in the cloud.

---

## ☁️ Cloud Sync Support

Supports multiple synchronization methods:

- S3 Compatible Object Storage
- Cloudflare R2
- WebDAV
- MinIO
- NAS Private Storage

Supports full self-hosting and private synchronization.

---

## 🧠 Local Knowledge Base (RAG)

Built-in vector knowledge base capabilities:

- Document Chunking
- Vector Embedding
- Semantic Search
- Local Knowledge Indexing
- AI-based Q&A based on knowledge base

Integrated with:

- LanceDB
- Apache Arrow

Future support for local Embedding models and offline AI workflows.

---

## 🌍 Internationalization

Supports 18 languages and regional settings.

Currently supported:

- Simplified Chinese
- English
- Japanese
- Korean
- German
- French
- Spanish
- Russian
- More languages are being added...

---

# 🖼️ Preview

## Edit Mode

![Snaptium Edit Mode](./docs/Screenshots/v2/en-US/EditorDemo.png)

## Preview Only

![Snaptium Preview](./docs/Screenshots/v2/en-US/PreviewOnly.png)

## Smart Writing （Click to play）
<video src="https://github.com/user-attachments/assets/9dd6fa86-5c0c-4a3e-93ed-f11acaa73ae2"></video>

## Knowledge Base （Click to play）
<video src="https://github.com/user-attachments/assets/62be0260-8d7f-438c-a8d1-1d3101b3ae4d.mp4"></video>


# 🧩 Tech Stack

## Frontend

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue I18n
- CodeMirror 6

## Desktop

- Electron
- Electron Builder
- Electron Updater

## Markdown Ecosystem

- markdown-it
- KaTeX
- highlight.js

## AI / Data Capabilities

- LanceDB
- Apache Arrow
- AWS SDK S3
- WebDAV

---

# 💻 Supported Platforms

| OS | Supported Version | Architecture | Installation Format |
|------|------|------|------|
| Windows | Windows 10 and above | x64 | `.exe` |
| macOS | macOS 11+ | arm64 | `.dmg` |
| Linux | Ubuntu / Debian / Fedora, etc. | x64 | `.deb` `.rpm` `.AppImage` |

> Please download the appropriate installer for your platform.

---

# 📦 Download

## Windows

[![Snaptium-Windows-x64.exe](https://img.shields.io/badge/Snaptium--Windows--x64.exe-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/jetyu/Snaptium/releases/latest/download/Snaptium-Windows-x64.exe)

---

## macOS

### Apple Silicon

[![Snaptium-macOS-arm64.dmg](https://img.shields.io/badge/Snaptium--macOS--arm64.dmg-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/Snaptium/releases/latest/download/Snaptium-macOS-arm64.dmg)

---

## Linux

### Debian / Ubuntu

[![Snaptium-Linux-x64.deb](https://img.shields.io/badge/Snaptium--Linux--x64.deb-FCC624?style=flat-square&logo=debian&logoColor=black)](https://github.com/jetyu/Snaptium/releases/latest/download/Snaptium-Linux-x64.deb)

### Fedora / RHEL

[![Snaptium-Linux-x64.rpm](https://img.shields.io/badge/Snaptium--Linux--x64.rpm-FCC624?style=flat-square&logo=redhat&logoColor=black)](https://github.com/jetyu/Snaptium/releases/latest/download/Snaptium-Linux-x64.rpm)

### AppImage

[![Snaptium-Linux-x64.AppImage](https://img.shields.io/badge/Snaptium--Linux--x64.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/jetyu/Snaptium/releases/latest/download/Snaptium-Linux-x64.AppImage)

---

> [View All Releases](https://github.com/jetyu/Snaptium/releases)

---

# 🛠️ Local Development

## Install Dependencies

```bash
npm install
```

## Start Development Environment

```bash
npm run dev
```

## Build Application

```bash
npm run dist
```

---

# 📚 Docs & Wiki

- Wiki: https://github.com/jetyu/Snaptium/wiki
- Docs: https://github.com/jetyu/Snaptium/tree/feature/snaptive/docs

---

# 📌 Roadmap

Future plans include:

- Integration of local AI models
- AI Agent workflows
- Multi-workspace management
- Collaborative editing
- Plugin system
- Mobile support
- More complete offline knowledge base capabilities

---

# 📄 License

This project is licensed under the Apache License 2.0.

For details, please refer to:

```text
LICENSE
```

---

# ❤️ Acknowledgments

Thanks to the following excellent open-source projects:

- Electron
- Vue
- CodeMirror
- markdown-it
- KaTeX
- LanceDB
- Apache Arrow

And to all developers and users who have submitted Issues, PRs, and suggestions for Snaptium.

Special thanks to [SiliconFlow](https://siliconFlow.com) for providing AI model service support for Snaptium.
<img width="240" src="https://s2.loli.net/2025/09/10/KWPOA5XhIGmYTV9.png" />
---

# ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jetyu/Snaptium&type=Date)](https://star-history.com/#jetyu/Snaptium&Date)

