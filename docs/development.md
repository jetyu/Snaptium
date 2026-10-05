# 本地开发与验证

当前交付为 Web-first 开发基础：Vue 共享 UI/i18n、Milkdown Markdown 编辑预览、IndexedDB 预览草稿、Axum 路由与同镜像 Docker 构建配置。显式配置身份服务后，可使用 SQLite 持久化管理员账号，通过 Web 初始化、登录和退出，具备有界内存会话、CSRF 与保守限流。尚无服务端笔记保存能力；浏览器预览草稿不属于登录账号，可显式恢复为副本，但不能作为真实笔记的唯一备份。产品名暂沿用仓库名 Snaptium；正式标识与分发名称仍由任务 1.1 确定。

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
pnpm test:identity
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
cargo test --locked -p snaptium-server schema::tests
cargo test --locked -p snaptium-server repository::tests
cargo test --locked -p snaptium-server identity::tests
cargo test --locked -p snaptium-server configuration::tests
cargo test --locked -p snaptium-server web_identity::tests
cargo test --locked -p snaptium-server --test startup
cargo test --locked -p snaptium-server backup::tests
cargo test --locked -p snaptium-server --test maintenance
cargo run --locked -p snaptium-server
```

服务默认绑定 `127.0.0.1:3000`，从 `apps/web/dist` 读取构建资源。`SNAPTIUM_LISTEN` 可指定合法 socket 地址；`SNAPTIUM_WEB_DIR` 可指定 Web 构建目录。缺失 index.html 时启动失败。

基础端点：没有身份配置时 `/api/v1/health` 为 foundation/not_configured；启用后为 identity/ready，状态区分 initialization_required 与 ok，但不表示笔记 API 已可用。`/.well-known/notes` 仅在启用身份时声明 web_identity 能力，始终不宣告可用同步协议。`/`、`/notes`、`/settings` 返回同一 Web 入口，`/assets` 提供静态文件。未知 API、WS 与静态路径返回 404，不被 SPA fallback 吞掉。

生产响应设置 CSP、nosniff、no-referrer、no-store 和生成的请求标识。开发模式 Vite 的 HMR 策略不代表生产 CSP。结构化业务错误与完整请求日志策略在任务 2.5 中继续完善。

服务端 SQLite 模块已接入显式配置的身份服务启动与关闭，包含 WAL、外键、FULL synchronous、连接池上限、跨进程所有权锁及显式空库 schema 初始化；schema 不兼容时不接受流量。关闭等待服务请求结束及连接池关闭，Linux 同时处理 SIGTERM，参见 [服务端存储基础](server-storage.md)。

Rust 身份核心使用 schema 2；已有 schema 1 只读拒绝升级。`SNAPTIUM_DATA_DIR` 启用身份服务，要求 `SNAPTIUM_PUBLIC_ORIGIN`，新库还需受控的 `SNAPTIUM_BOOTSTRAP_SECRET_FILE`。Web 初始化、登录、Secure/HttpOnly/SameSite 会话、CSRF、限流与退出已接入；生产要求 HTTPS，显式 HTTP 例外仅限回环开发。完整操作步骤见 [Web 初始化、登录与会话](web-identity.md)，密码核心见 [服务端身份基础](server-identity.md)。

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

本机验证：`pnpm check` 已通过，包含类型检查、零警告 lint、59 项契约/真实 Milkdown 引擎/草稿存储/身份访问与组件测试和生产构建；先前离线冻结锁文件安装也已通过。编辑器按需加载。当前无可用浏览器连接，尚未完成真实浏览器 HTTPS Cookie、视觉、中文 IME、刷新草稿恢复、键盘与响应式回归验证，任务 1.3 保持未完成。

本机 Rust 验证：格式检查、零警告 clippy 与锁定依赖的离线测试通过，共 47 项测试（其中 1 项为跨进程测试辅助入口）。覆盖 schema/锁、owner-scoped 查询、版本化密码、容量限制、初始化竞争/回滚、配置拒绝、Origin/CSRF/Cookie 边界、限流、会话轮换与过期；真实 TCP/服务进程测试验证强制重启后账号保留、旧 Web 会话失效、初始化保持关闭且可重新登录退出。备份专项验证当前 schema 1/2、WAL 与并发快照、严格清单/哈希/schema/外键检查、已有目标保护和中断标记；独立维护进程完成备份→校验→新目录恢复→密码登录验证。Unix 权限/符号链接专项交给 CI，本机未运行 NAS 容器验证。

读取 repository 子项 4.3.1 已落实，详见 [服务端读取数据访问层](server-repositories.md)。读取笔记接口仍未开放 HTTP；身份接口已开放，但没有笔记写入，不接受浏览器自报 owner 作为认证。管理员创建后续账号、密码更新、完整安全审计、原生设备凭据与持久化会话仍待对应任务。

任务 1.2 已确认：单层文件夹（删除时保留笔记并移至未分类）、附件 20 MiB、可调整的默认账号容量 5 GiB、每篇最近 100 个历史版本、同步删除记录不自动清理、关闭公开注册由管理员创建账号。初始账号/文件夹/笔记 schema 与策略元数据已验证，但没有正式业务写入 API。当前数据库备份、完整性校验和全新目录恢复子项 11.3.1、11.4.1、11.6.1 已实现，见 [维护命令与恢复边界](server-backup.md)；附件备份、自动调度与真实前向迁移仍待完成，schema 1 不自动升级。下一阶段接入经过验证恢复点保护的存储扩展，再增加经过会话认证的 owner-scoped 笔记保存与重载，并遵守修订、历史及变更流事务规则。Windows 与 Android 不在当前实施范围。
