# 本地开发与验证

当前交付为 Web-first 工程基础：Vue Web 页面、共享 UI/i18n、健康响应边界校验、Milkdown Markdown 编辑预览、IndexedDB 预览草稿、Axum 路由与同镜像 Docker 构建配置。没有账号、SQLite 或服务端笔记保存能力；浏览器草稿可显式恢复为副本，但不能作为真实笔记的唯一备份。产品名暂沿用仓库名 Snaptium；正式标识与分发名称仍由任务 1.1 确定。

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

## 服务端基础（待本地 Rust 验证）

工具链固定为 Rust 1.94.0，包含 rustfmt 和 clippy。目前仅加入 `apps/server/` 与 `crates/protocol/`；其他共享模块及 Windows 工程在相应任务中加入，避免创建空实现。

```text
pnpm build:web
cargo generate-lockfile
cargo fmt --all
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo run --locked -p snaptium-server
```

服务默认绑定 `127.0.0.1:3000`，从 `apps/web/dist` 读取构建资源。`SNAPTIUM_LISTEN` 可指定合法 socket 地址；`SNAPTIUM_WEB_DIR` 可指定 Web 构建目录。缺失 index.html 时启动失败。

基础端点：`/api/v1/health` 返回明确的 foundation/not_configured 状态；`/.well-known/notes` 不宣告可用笔记同步协议或能力。`/`、`/notes`、`/settings` 返回同一 Web 入口，`/assets` 提供静态文件。未知 API、WS 与静态路径返回 404，不被 SPA fallback 吞掉。

生产响应设置 CSP、nosniff、no-referrer、no-store 和生成的请求标识。开发模式 Vite 的 HMR 策略不代表生产 CSP。结构化业务错误与完整请求日志策略在任务 2.5 中继续完善。

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

当前本机未找到 Rust 或 Docker，不能据此宣称 Rust 编译、容器运行或多架构构建已通过。Cargo.lock 尚待 Rust 环境生成并提交，因此 Rust/Docker 依赖构建暂不完全可复现；任务 2.3 保持未完成，CI 暂先生成锁文件，后续改为直接使用提交的锁文件。

## 实施状态与下一阶段

基础阶段交付任务 2.1–2.5 和 12.1–12.4 的部分内容，已完成的 Web 子项为 2.2.1、2.3.1、2.4.1；编辑器阶段完成任务 1.6、7.2，草稿阶段完成预览子项 7.5.1。包含 Windows、完整协议、存储和运维的其余总任务保持未完成。Web、编辑器与草稿验证已进入 CI；Rust、Docker job 已配置但运行结果待实际验证。草稿存储与失败处理见 [Web 本地草稿](web-drafts.md)。

本机验证：`pnpm check` 已通过，包含类型检查、零警告 lint、50 项契约/真实 Milkdown 引擎/草稿存储与组件测试和生产构建；离线冻结锁文件安装也已通过。编辑器按需加载。当前无可用浏览器连接，尚未完成真实浏览器视觉、中文 IME、刷新草稿恢复、键盘与响应式回归验证，任务 1.3 保持未完成。

Markdown 子集与首批序列化 fixtures 已落实。下一阶段需要具备 Rust 验证环境，才能实现并验证 SQLite 与账号初始化/登录，随后打通笔记创建、编辑、保存和重载。Windows 与 Android 不在当前实施范围。
