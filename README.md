<div align="center">

**Language / 语言:** [English](README.md) | [简体中文](README_CN.md)

</div>

<div align="center">
  <img src="src/assets/logo/app-logo-128.png" alt="NoteWizard Logo" width="72">
  <h2> NoteWizard </h2>
  <p>A modern cross-platform note-taking desktop application built with Electron, featuring local data storage for complete security and control.</p>
  
[![GitHub Release](https://img.shields.io/github/v/release/jetyu/NoteWizard?style=flat-square)](https://github.com/jetyu/NoteWizard/releases/latest)
[![GitHub pre-release](https://img.shields.io/github/v/release/jetyu/NoteWizard?include_prereleases&style=flat-square&label=pre-release)](https://github.com/jetyu/NoteWizard/releases)
[![Build Status](https://github.com/jetyu/NoteWizard/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/jetyu/NoteWizard/actions/workflows/build.yml)
[![Downloads](https://img.shields.io/github/downloads/jetyu/NoteWizard/total?style=flat-square&logo=github)](https://github.com/jetyu/NoteWizard/releases/)
![GitHub license](https://img.shields.io/github/license/jetyu/NoteWizard?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/jetyu/NoteWizard)
![GitHub issues](https://img.shields.io/github/issues/jetyu/NoteWizard)

</div>

## Features
- **Minimalist Interface**: Simple, pure, and ad-free
- **Cross-Platform**: Supports Windows, macOS, and Linux
- **Easy Migration**: Supports complete NoteWizard proprietary format (.nwp) for full import/export, as well as Markdown (.md) format import/export
- **Local Encrypted Storage**: All note data can be encrypte(AES-256-GCM algorithm) and stored under the user's local control.
- **Markdown Support**: Real-time preview of Markdown rendering
- **AI-Powered Writing Assistant**: AI-powered writing assistance to make your writing easier (Off by default)
- **Internationalization**: Supports 19 languages and regional settings worldwide

## Screenshots
**NoteWizard Quick Start**  
> Tips: software is continuously updated to enhance performance and user experience. Listed features are for reference only and may evolve with technological advancements and user needs.

![NoteWizard Quick Start](./doc/getstarted/v0.2.6.webp)

## Supported Platforms

Current supported operating systems and architectures:
| Platform | Supported Versions | Architecture | Package Format | Notes |
|----------|-------------------|--------------|----------------|-------|
| **Windows** | Windows 10 and above | x64 | `.exe` | Windows XP ~ 8.1 not supported |
| **macOS** | macOS Big Sur (11.0) and above | x64 / arm64 | `.dmg`, `.zip` | Supports Intel and Apple Silicon |
| **Linux** | Ubuntu 18.04 / Debian 10 / Fedora 32 and above | x64 | `.deb`, `.rpm`, `.AppImage` | Compatible with mainstream Linux distributions |

>  **Note:** Please download the appropriate package for your platform and ensure your system meets the minimum version requirements.

## Download & Installation
Built automatically using `Workflows`, click to download the latest package for your platform:

### Windows

[![NoteWizard-Windows-x64.exe](https://img.shields.io/badge/NoteWizard--Windows--x64.exe-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Windows-x64.exe)

### macOS

**Intel Chip**

[![NoteWizard-macOS-x64.dmg](https://img.shields.io/badge/NoteWizard--macOS--x64.dmg-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-x64.dmg)
[![NoteWizard-macOS-x64.zip](https://img.shields.io/badge/NoteWizard--macOS--x64.zip-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-x64.zip)

**Apple Silicon**

[![NoteWizard-macOS-arm64.dmg](https://img.shields.io/badge/NoteWizard--macOS--arm64.dmg-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-arm64.dmg)
[![NoteWizard-macOS-arm64.zip](https://img.shields.io/badge/NoteWizard--macOS--arm64.zip-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-arm64.zip)


### Linux

**DEB Package (Debian/Ubuntu)**  
[![NoteWizard-Linux-x64.deb](https://img.shields.io/badge/NoteWizard--Linux--x64.deb-FCC624?style=flat-square&logo=debian&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.deb)

**RPM Package (Fedora/RHEL)**  
[![NoteWizard-Linux-x64.rpm](https://img.shields.io/badge/NoteWizard--Linux--x64.rpm-FCC624?style=flat-square&logo=redhat&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.rpm)

**AppImage (Universal)**  
[![NoteWizard-Linux-x64.AppImage](https://img.shields.io/badge/NoteWizard--Linux--x64.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.AppImage)


>   [View All Releases](https://github.com/jetyu/NoteWizard/releases/latest)


## Quick Start

### Requirements

- Node.js (v20 or higher)
- npm (v10 or higher)
- Git (for cloning the repository)

## Main Dependencies

- **Electron** - Build cross-platform desktop apps with JavaScript, HTML, and CSS
- **CodeMirror** - Feature-rich code editor
- **Marked** - Markdown parser and compiler

## Contributing

We welcome and appreciate all contributions! Whether it's reporting bugs, discussing features, or submitting code, your support drives the project forward.

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

Thanks to the following open source projects:
- [Electron](https://www.electronjs.org/)
- [CodeMirror](https://codemirror.net/)
- [Marked](https://marked.js.org/)

---

### Star History
[![Star History Chart](https://api.star-history.com/svg?repos=jetyu/NoteWizard)](https://star-history.com/#jetyu/NoteWizard)  
