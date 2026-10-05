# Web 初始化、登录与会话

当前开发版本可配置独立 SQLite 数据目录，通过浏览器创建首个管理员、登录、检查会话与退出。账号和永久初始化关闭标记持久化在 schema 2；笔记、附件、后续账号管理、设备管理和生产备份恢复尚未开放。默认不配置身份服务时仍是 `foundation/not_configured` 预览，不会冒充可保存笔记的服务。

## 本地开发

先在仓库根目录构建 Web：

```text
pnpm build:web
```

仅首次开发时生成初始化密钥，以下命令不输出密钥，并使用排他创建，文件存在时不会覆盖。`data/` 已被 Git 忽略；不要使用已有 schema 1 或真实用户目录作为测试库。

```text
node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); fs.mkdirSync('data/dev-secrets',{recursive:true}); fs.writeFileSync('data/dev-secrets/bootstrap.key',crypto.randomBytes(32).toString('hex')+'\n',{flag:'wx',mode:0o600});"
```

Windows 应限制该密钥文件的 ACL 为当前操作者可读；`mode: 0o600` 不代替 Windows ACL。在可信本地编辑器中打开文件，将密钥复制到初始化表单，不要发到聊天、日志、截图或版本库。

在加载了 [Rust/MSVC 环境](development.md) 的 CMD 终端配置：

```text
set SNAPTIUM_DATA_DIR=data/dev-identity
set SNAPTIUM_BOOTSTRAP_SECRET_FILE=data/dev-secrets/bootstrap.key
set SNAPTIUM_PUBLIC_ORIGIN=http://127.0.0.1:3000
set SNAPTIUM_ALLOW_HTTP_LOOPBACK=true
set SNAPTIUM_LISTEN=127.0.0.1:3000
cargo run --locked -p snaptium-server
```

打开 `http://127.0.0.1:3000`。创建管理员后会显示登录表单；新密码至少 15 个 Unicode 字符，最多 1,024 个 UTF-8 字节。初始化完成后可以停止服务、取消 `SNAPTIUM_BOOTSTRAP_SECRET_FILE` 配置，再启动；账号仍可登录，初始化不会重开。若初始化响应丢失，点击“重新检查账号状态”；不要清空数据库或重新生成已有密钥来重试。

使用 Vite HMR 时将 `SNAPTIUM_PUBLIC_ORIGIN` 改为 `http://127.0.0.1:5173`，后端仍监听 `127.0.0.1:3000`，前端执行 `pnpm dev:web`；地址中的 `127.0.0.1` 与 `localhost` 不可混用。该模式通过已有 Vite 同源代理访问 API，不增加 CORS。

## 配置边界

| 配置 | 行为 |
| --- | --- |
| `SNAPTIUM_DATA_DIR` | 启用身份服务的可信本地目录；保留 SQLite 文件及实例锁，不使用 SMB/NFS |
| `SNAPTIUM_PUBLIC_ORIGIN` | 启用身份时必填，精确匹配浏览器 origin；小写 ASCII、无路径、尾斜杠、用户信息、查询或片段；省略默认 80/443 端口 |
| `SNAPTIUM_BOOTSTRAP_SECRET_FILE` | 新库必需；内容为 64 位小写十六进制，可带一个 LF/CRLF；最多读取 67 字节，错误不回显内容或路径 |
| `SNAPTIUM_ALLOW_HTTP_LOOPBACK` | 默认 `false`，只接受 `true/false`；HTTP 例外同时要求回环 origin 和回环监听地址 |
| `SNAPTIUM_LISTEN` / `SNAPTIUM_WEB_DIR` | 默认 `127.0.0.1:3000` / `apps/web/dist`；生产反向代理部署可显式设置内部监听与 Web 资源目录 |

身份相关配置只填一部分时启动失败，不悄悄回退到预览。新库缺少初始化权限时不会接收 HTTP 流量；已有 schema 1 或未知/修改的 schema 只读拒绝，不自动迁移、覆盖或降级。兼容限制见 [存储文档](server-storage.md)。

生产 origin 必须为 HTTPS。外部反向代理终止 TLS，应用端口只能由可信代理访问，不能把内部明文端口暴露公网。代理必须保留与公开 origin 一致的 Host；目前不信任 `Forwarded` / `X-Forwarded-*`，代理后的所有用户共享代理 peer 的限流额度。Docker 默认 Compose 仍为基础预览，没有自动启用本页配置；HTTPS、密钥挂载权限与 NAS 容器验证仍属后续部署任务。

## API 与安全行为

| 端点 | 请求与结果 |
| --- | --- |
| `GET /api/v1/auth/session` | 返回匿名状态及是否需要初始化，或账号 ID、管理员标记与同步器 CSRF token；从不返回密码校验串或会话 Cookie 值 |
| `POST /api/v1/auth/bootstrap` | JSON `login/password/initializationSecret`；一次性创建管理员，成功 204，不自动登录 |
| `POST /api/v1/auth/login` | JSON `login/password`；校验成功设置新 Cookie 并返回认证状态，轮换并废止浏览器携带的旧会话 |
| `POST /api/v1/auth/logout` | JSON `{}`，需要当前会话与 `X-CSRF-Token`；成功 204，撤销服务端会话并清除 Cookie |

所有身份写请求需要精确匹配配置的 Origin 和 Host、`Content-Type: application/json`、`X-Snaptium-Request: web-v1`；存在 Fetch Metadata 时只允许 `same-origin`。登录与初始化也受 Origin/自定义头防护，不能使用跨站简单表单请求。退出额外校验与当前会话绑定的 CSRF token；SameSite 只是附加防线。原生访问凭据不受这些接口签发，参见 [OWASP CSRF 指南](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。

生产 Cookie 为 `__Host-snaptium_session`，含 Secure、HttpOnly、SameSite=Strict、Path=/，无 Domain。显式回环 HTTP 开发使用不同的 `snaptium_dev_session` 名称，不能把开发例外用于 NAS 明文远程访问。会话 token 为操作系统随机源生成的 256 位值，服务端只保留 SHA-256 摘要；CSRF token 与会话独立生成且只在内存/受控 JSON 传输中使用。该属性选择参考 [OWASP 会话管理指南](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。

会话绝对有效期为 8 小时，不滑动续期；进程最多 1,024 个会话，每账号最多 8 个，满额拒绝新增而不驱逐其他用户。重启使所有 Web 会话失效，不影响账号或初始化关闭状态；持久化会话、密码修改后统一撤销及完整设备撤销仍待后续任务。读取会话时重新查询账号是否存在及当前管理员标记，不以客户端自报 ID 或旧管理员状态授权。

初始化、登录与退出共用固定 60 秒窗口，每 TCP peer IP 最多 10 次、进程最多 60 次；拒绝的安全边界或格式请求也计入额度，转发头不能绕过限流。来源表有容量上限并清除过期条目；超过额度返回 429、`authentication_rejected` 和 `Retry-After: 60`。请求体最多 4 KiB，读取最多 5 秒；未知字段、压缩请求体、歧义 Cookie/头被拒绝。原有 Argon2 两项进程并发限制继续生效。这些是开发版保守策略，不是目标 NAS 的性能承诺。

页面密码和密钥为掩码输入，操作结束或卸载后清空；没有把密码、Cookie 或 CSRF token 保存到 localStorage/IndexedDB，没有跨 origin 重定向跟随。请求失败不显示服务端原始错误详情；响应 JSON 读取和契约验证有 4 KiB 上限。身份响应设置 no-store 和请求关联 ID，不记录请求正文、Cookie 或凭据。完整安全事件审计、反向代理脱敏、浏览器兼容与威胁评审尚未完成。

## 用户安全说明

自托管不等于端到端加密：服务操作者能够读取服务器上的笔记内容、账号数据及备份。HTTPS 保护传输，Argon2id 保护密码校验串，但它们不使笔记对服务器管理员不可见。请只使用受信任的服务器，限制主机和备份访问；不要将本开发版本用于唯一的真实数据副本。

登录后的下方编辑器仍是独立的浏览器预览草稿，不属于当前账号，也不会提交服务器。退出不会删除这些预览草稿；共享浏览器中的草稿不能视为私密账号数据。真正的账号草稿隔离和笔记保存将在笔记任务中实现。

## 验证

```text
pnpm test:identity
pnpm check
cargo test --locked -p snaptium-server configuration::tests
cargo test --locked -p snaptium-server web_identity::tests
cargo test --locked -p snaptium-server --test startup
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
```

CI 的 Web/Rust job 覆盖这些测试，包括真实进程与 TCP listener 的初始化、登录、强制重启、旧会话失效、账号保留和退出。尚未验证真实浏览器 HTTPS Cookie、中文 IME、Linux 容器和 NAS；自动测试不代替生产部署验收。
