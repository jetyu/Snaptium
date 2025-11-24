<div align="center">

**Language / 语言:** [English](README.md) | [简体中文](README_CN.md)

</div>

<div align="center">
  <img src="src/assets/logo/app-logo-128.png" alt="NoteWizard Logo" width="72">
  <h2> NoteWizard </h2>
  <p>一款基于Electron开发的现代化跨平台桌面级笔记应用，数据本地存储，让数据始终安全可控。</p>
  
[![GitHub Release](https://img.shields.io/github/v/release/jetyu/NoteWizard?style=flat-square)](https://github.com/jetyu/NoteWizard/releases/latest)
[![GitHub pre-release](https://img.shields.io/github/v/release/jetyu/NoteWizard?include_prereleases&style=flat-square&label=pre-release)](https://github.com/jetyu/NoteWizard/releases)
[![Build Status](https://github.com/jetyu/NoteWizard/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/jetyu/NoteWizard/actions/workflows/build.yml)
[![Downloads](https://img.shields.io/github/downloads/jetyu/NoteWizard/total?style=flat-square&logo=github)](https://github.com/jetyu/NoteWizard/releases/)
![GitHub license](https://img.shields.io/github/license/jetyu/NoteWizard?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/jetyu/NoteWizard)
![GitHub issues](https://img.shields.io/github/issues/jetyu/NoteWizard)

</div>

## 功能特点
- **极简界面**：简单纯粹无广告
- **跨平台**：支持 Windows、macOS 和 Linux 系统
- **便捷迁移**：支持NoteWizard专有格式(.nwp)完整导入导出，也支持Markdown(.md)格式导入导出
- **本地加密存储**：所有笔记数据可加密(AES-256-GCM算法)保存在本地，安全可控
- **Markdown支持**：实时预览 Markdown 渲染效果
- **AI智能辅助写作**：AI智能辅助写作，让您的写作更轻松(默认关闭)
- **国际化**：支持全球19种语言及地区设置

## 界面预览
**NoteWizard 快速上手**  
> 提示: 本软件持续更新，以优化性能和用户体验。列出的功能仅供参考，可能随技术进步和需求变化而调整。

![NoteWizard 快速上手](./doc/getstarted/v0.2.6_zhCN.webp)

## 支持平台

本项目当前支持以下操作系统与架构：
| 操作系统 | 支持版本 | 架构 | 安装包格式 | 备注 |
|------|-------------|------|-----------|------|
| **Windows** | Windows 10 及以上 | x64 | `.exe` | 不支持 Windows XP ~ 8.1|
| **macOS** | macOS Big Sur (11.0) 及以上 | x64,arm64 | `.dmg`, `.zip` | 支持 Intel 和 Apple Silicon |
| **Linux** | Ubuntu 18.04 / Debian 10 / Fedora 32 及以上 | x64 | `.deb`,`.rpm`,`.AppImage` | 兼容支持主流Linux发行版  |

>  **提示：** 请根据对应平台下载相应安装包，并确保系统满足最低版本要求。

## 下载安装
使用 `Workflows` 自动构建操作系统平台最新安装包，点击对应平台的安装包下载：

### Windows操作系统

[![NoteWizard-Windows-x64.exe](https://img.shields.io/badge/NoteWizard--Windows--x64.exe-0078D4?style=flat-square&logo=windows&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Windows-x64.exe)

### macOS操作系统

**Intel Chip**

[![NoteWizard-macOS-x64.dmg](https://img.shields.io/badge/NoteWizard--macOS--x64.dmg-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-x64.dmg)
[![NoteWizard-macOS-x64.zip](https://img.shields.io/badge/NoteWizard--macOS--x64.zip-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-x64.zip)

**Apple Silicon**

[![NoteWizard-macOS-arm64.dmg](https://img.shields.io/badge/NoteWizard--macOS--arm64.dmg-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-arm64.dmg)
[![NoteWizard-macOS-arm64.zip](https://img.shields.io/badge/NoteWizard--macOS--arm64.zip-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-macOS-arm64.zip)


### Linux操作系统

**DEB 包 (Debian/Ubuntu)**  
[![NoteWizard-Linux-x64.deb](https://img.shields.io/badge/NoteWizard--Linux--x64.deb-FCC624?style=flat-square&logo=debian&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.deb)

**RPM 包 (Fedora/RHEL)**  
[![NoteWizard-Linux-x64.rpm](https://img.shields.io/badge/NoteWizard--Linux--x64.rpm-FCC624?style=flat-square&logo=redhat&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.rpm)

**AppImage (通用格式)**  
[![NoteWizard-Linux-x64.AppImage](https://img.shields.io/badge/NoteWizard--Linux--x64.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/jetyu/NoteWizard/releases/latest/download/NoteWizard-Linux-x64.AppImage)


>   [查看全部版本](https://github.com/jetyu/NoteWizard/releases)


## 快速开始

### 环境要求

- Node.js (v20 或更高版本)
- npm (v10 或更高版本)
- Git (用于克隆仓库)

## 主要依赖

- **Electron** - 使用 JavaScript, HTML 和 CSS 构建跨平台桌面应用
- **CodeMirror** - 功能丰富的代码编辑器
- **Marked** - Markdown 解析器和编译器

## 参与贡献

我们非常欢迎和感谢所有贡献！无论是报告 Bug、讨论功能，还是提交代码，您的支持都是项目前进的动力。

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/新功能`)
3. 提交更改 (`git commit -m '添加新功能'`)
4. 推送到分支 (`git push origin feature/新功能`)
5. 提交 Pull Request

## 开源协议

本项目采用 MIT 开源协议，详情请参阅 `LICENSE` 文件。

## 致谢

感谢以下开源项目的支持：
- [Electron](https://www.electronjs.org/)
- [CodeMirror](https://codemirror.net/)
- [Marked](https://marked.js.org/)

---

### 成长轨迹
[![Star History Chart](https://api.star-history.com/svg?repos=jetyu/NoteWizard)](https://star-history.com/#jetyu/NoteWizard)  
