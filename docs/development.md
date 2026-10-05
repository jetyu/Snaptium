# 本地开发与验证

当前交付为 Web-first 工程基础：Vue Web 页面、共享 UI/i18n、健康响应边界校验、Milkdown Markdown 编辑预览、IndexedDB 预览草稿、Axum 路由、独立 SQLite 连接模块与同镜像 Docker 构建配置。没有账号或服务端笔记保存能力，SQLite 尚未接入 HTTP 启动；浏览器草稿可显式恢复为副本，但不能作为真实笔记的唯一备份。产品名暂沿用仓库名 Snaptium；正式标识与分发名称仍由任务 1.1 确定。

## Web 开发

需要 Node 22.22.1 和 pnpm 11.17.0。Windows PowerShell 使用 `pnpm.cmd` 避免本机脚本执行策略限制。

```text
pnpm install --frozen-lockfile
pnpm dev:web
```

打开 `http://127.0.0.1:5173`。没有服务端时页面显示服务不可用；不会伪造连接成功。Vite 将 `/api` 和 `/.well-known` 转发到 `127.0.0.1:3000`。

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:editor
pnpm test:drafts
pnpm build:web
```

或执行 `pnpm check`。TypeScript 启用严格检查，Vue SFC 另用 vue-tsc 检查；Vite 构建不代替类型检查，参见 [Vue TypeScript 文档](https://vuejs.org/guide/typescript/overview)。测试验证共享 JSON fixture、非法健康响应、失败重试、请求取消、Markdown 往返、安全 URL、源码保留与 composition 保护。编辑器按需加载，详细格式规则见 [Markdown 格式与编辑器边界](markdown-format.md)。

## 本机 SDK 路径（2026-10-05 核验）

本机 SDK 根目录为 `D:\DevTools\SDK`，以下为开发机路径，不是项目或 CI 的硬编码依赖。未修改全局 PATH。

| 工具 | 路径与核验结果 |
| --- | --- |
| Rust 环境入口 | `D:\DevTools\SDK\Rust\rust-env.cmd`，初始化当前 CMD 的 Rust、MSVC 与临时目录环境 |
| Rust 工具链 | `D:\DevTools\SDK\Rust\rustup\toolchains\1.94.0-x86_64-pc-windows-msvc\bin`；rustc、Cargo 均为 1.94.0，rustfmt 为 1.8.0-stable，clippy 为 0.1.94 |
| Cargo / rustup 数据 | `D:\DevTools\SDK\Rust\cargo` / `D:\DevTools\SDK\Rust\rustup`；由入口脚本设置 `CARGO_HOME` / `RUSTUP_HOME` |
| MSVC 环境入口 | `D:\DevTools\SDK\MSVC\Common7\Tools\VsDevCmd.bat`；Rust 入口脚本自动调用，选择 x64 主机与目标 |
| MSVC 编译器与链接器 | `D:\DevTools\SDK\MSVC\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64`；已确认 `cl.exe` 和 `link.exe` 可定位 |
| Node / pnpm 入口 | `D:\DevTools\SDK\Nodejs\node.exe` / `D:\DevTools\SDK\Nodejs\pnpm.CMD` |
| Docker | SDK 目录内未找到 Docker 或 Podman 可执行文件；不能据此排除其他目录或远程环境的安装 |

PowerShell 中可使用完整 CMD 路径运行，环境仅作用于该子进程；下一次独立命令需要再次调用入口脚本：

```powershell
& C:\Windows\System32\cmd.exe /d /c "call D:\DevTools\SDK\Rust\rust-env.cmd && rustc --version && cargo --version"
& C:\Windows\System32\cmd.exe /d /c "call D:\DevTools\SDK\Rust\rust-env.cmd && cargo test --workspace --locked"
```

已有 CMD 终端执行 `call D:\DevTools\SDK\Rust\rust-env.cmd` 后，可直接执行 Cargo 命令。也可以启动已有的 `D:\DevTools\SDK\Rust\rust-shell.cmd`。Windows SDK 和必要系统组件并非全部位于 SDK 根目录，换机需重新准备；详见本机 `D:\DevTools\SDK\Rust\README.md`。

若受限终端出现 `LNK1104` 且错误路径位于 SDK 的 `temp` 目录，使用工作区内的临时目录；这只修改当前子进程环境，不修改 SDK 脚本或系统设置：

```powershell
New-Item -ItemType Directory -Path .\target\tmp -Force | Out-Null
& C:\Windows\System32\cmd.exe /d /c "call D:\DevTools\SDK\Rust\rust-env.cmd && set TEMP=D:\DevTools\Workspace\Snaptium\target\tmp&& set TMP=D:\DevTools\Workspace\Snaptium\target\tmp&& cargo test --workspace --locked --offline"
```

`--offline` 仅适用于依赖已下载的情况；首次获取依赖仍需网络。

已加载上述环境并执行本项目 Rust 格式检查、clippy 和测试；容器构建与 NAS 部署尚未验证。

## 服务端基础

工具链固定为 Rust 1.94.0，包含 rustfmt 和 clippy。目前仅加入 `apps/server/` 与 `crates/protocol/`；其他共享模块及 Windows 工程在相应任务中加入，避免创建空实现。

```text
pnpm build:web
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo test --locked -p snaptium-server storage::tests
cargo run --locked -p snaptium-server
```

服务默认绑定 `127.0.0.1:3000`，从 `apps/web/dist` 读取构建资源。`SNAPTIUM_LISTEN` 可指定合法 socket 地址；`SNAPTIUM_WEB_DIR` 可指定 Web 构建目录。缺失 index.html 时启动失败。

基础端点：`/api/v1/health` 返回明确的 foundation/not_configured 状态；`/.well-known/notes` 不宣告可用笔记同步协议或能力。`/`、`/notes`、`/settings` 返回同一 Web 入口，`/assets` 提供静态文件。未知 API、WS 与静态路径返回 404，不被 SPA fallback 吞掉。

生产响应设置 CSP、nosniff、no-referrer、no-store 和生成的请求标识。开发模式 Vite 的 HMR 策略不代表生产 CSP。结构化业务错误与完整请求日志策略在任务 2.5 中继续完善。

新增服务端 SQLite 连接模块已进行隔离目录测试，包含 WAL、外键、FULL synchronous、连接池上限与跨进程所有权锁。该模块尚未接入 HTTP 启动，不创建业务表、不执行迁移，也不改变健康端点的存储状态，参见 [服务端存储基础](server-storage.md)。

## Docker 开发部署（待本地容器验证）

```text
docker compose -f deploy/docker/compose.yaml config --quiet
docker compose -f deploy/docker/compose.yaml up --build --detach
```

访问 `http://127.0.0.1:3000`。镜像构建 Vue 和 Axum，并以 UID/GID 10001 运行；Compose 只绑定回环地址，配置只读根文件系统、最小权限和持久卷 `/data`。当前未启用数据存储，因此该卷尚不承载笔记。不要将当前开发配置直接暴露公网；后续部署任务会落实初始化、TLS 代理、备份与迁移恢复。

```text
docker compose -f deploy/docker/compose.yaml down
```

停止服务保留命名卷。CI 配置检查同源 Web/健康端点及未知 API 的 404。

已生成根目录 `Cargo.lock`，Rust CI 和 Docker 构建均使用 `--locked`，不再在 CI 临时生成锁文件。本机 Windows Rust 验证已通过；本机没有 Docker，容器运行及多架构构建仍待验证。完整 Windows/Tauri 质量配置未完成，任务 2.3 保持未完成。

可用的远程验证环境（用户提供的终端输出，非本机直接检查）：NAS `HomeLink`，iStoreOS 24.10.8（2026073111），`x86_64` / `linux/amd64`，Docker Client/Engine 27.3.1（API 1.47），Compose v2.39.1。后续可在该 NAS 验证 amd64 镜像；尚未连接或部署，需要先确认地址、独立测试目录和空闲端口，不改现有容器/数据。这不构成 arm64 或应用部署验证。

## 实施状态与下一阶段

基础阶段交付任务 2.1–2.5 和 12.1–12.4 的部分内容，已完成的 Web 子项为 2.2.1、2.3.1、2.4.1；编辑器阶段完成任务 1.6、7.2，草稿阶段完成预览子项 7.5.1。Rust 质量子项 2.3.2 和 SQLite 连接子项 4.1.1 已完成。包含 Windows、完整协议、业务存储和运维的其余总任务保持未完成。所有本地验证命令已纳入 CI，但本次未运行远程 CI 或 Docker。草稿存储与失败处理见 [Web 本地草稿](web-drafts.md)。

本机验证：`pnpm check` 已通过，包含类型检查、零警告 lint、50 项契约/真实 Milkdown 引擎/草稿存储与组件测试和生产构建；离线冻结锁文件安装也已通过。编辑器按需加载。当前无可用浏览器连接，尚未完成真实浏览器视觉、中文 IME、刷新草稿恢复、键盘与响应式回归验证，任务 1.3 保持未完成。

本机 Rust 验证：格式检查、零警告 clippy 与锁定依赖的离线测试通过，共 9 项测试（其中 1 项为跨进程测试辅助入口）。未运行 NAS 容器验证。

首版组织方式已确定为文件夹，标签延后。下一阶段仍需确定任务 1.2 的容量、保留和注册策略，再落实业务 schema、迁移/恢复保护与服务启动接入，随后实现账号初始化/登录并打通笔记创建、编辑、保存和重载。文件夹层级及删除行为在对应操作实现前明确。Windows 与 Android 不在当前实施范围。
