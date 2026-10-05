# 服务端密码与管理员初始化基础

`apps/server/src/identity.rs` 提供 Rust 身份核心：首个管理员创建及凭据校验，本模块自身不签发会话。`web_identity.rs` 已将它接入可显式配置的 Axum/Web 初始化、登录与会话流程；未配置时仍为 `foundation/not_configured`。操作步骤、安全边界和部署限制见 [Web 身份访问](web-identity.md)。

## 输入与密码处理

账号标识 `LoginName` 只接受 3–64 个 ASCII 小写字母、数字及 `._-`，不自动裁剪、折叠大小写或进行 Unicode 归一化。它是登录标识，不是未来的用户显示名称。新密码至少 15 个 Unicode 字符，最多 1,024 个 UTF-8 字节；允许空格和 Unicode，不增加必须包含特定字符类别的规则，不静默截断。校验既有密码时接受 1–1,024 字节，错误密码与不存在账号均返回 `authentication_rejected`。

密码使用 Argon2id v=19，参数为 `m=19456 KiB, t=2, p=1`，输出 32 字节；每次创建使用操作系统随机源生成独立的 16 字节盐。数据库只保存包含算法、版本、成本和盐的 PHC 校验串，不保存明文密码。这采用 [OWASP 密码存储指南](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) 的最低 Argon2id 成本建议；目标 NAS 的性能测量及后续成本升级仍待实现。

校验串最多 256 字节，验证前只允许上述精确版本、成本、盐和输出长度，未知或超大成本会被拒绝，不能利用数据库中的成本字段申请任意内存。[Argon2 Rust 文档](https://docs.rs/argon2/0.5.3/argon2/) 说明验证读取 PHC 内的参数，因此不能只依赖创建实例时的默认参数。

哈希和校验在 `spawn_blocking` 执行，整个进程最多同时接纳两项，不排无限等待队列；容量不足返回 `identity_busy`。许可由 blocking 闭包持有，调用方取消也不会提前释放仍在计算的容量；这一点基于 [Tokio blocking 任务不能在开始后中止的行为](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)。不存在账号也执行同一成本的 Argon2 工作，但不承诺严格时间恒定。该并发限制不是 HTTP 登录频率限制。

公开密码/初始化密钥新类型及服务端私有身份模型不实现 `Debug` 或 `Serialize`；PHC 串只在私有缓冲区和数据库校验字段中使用，不作为响应返回。本模块没有凭据日志，数据库语句日志禁用，对外错误不携带原始数据库错误。私有密码/密钥缓冲区采用 `Zeroizing` 尽力擦除，但这不保证第三方库、数据库驱动的所有中间副本或 Argon2 工作内存被清零。HTTP 边界已提供内容无关错误；完整代理日志与安全事件脱敏仍须另行实现并测试。

## 一次性管理员初始化

`BootstrapSecret` 接受由 32 个安全随机字节编码的 64 位小写十六进制字符串。边界校验只能检查格式，不能证明熵；不要将测试中的固定值用于真实部署。`bootstrap_admin` 的 `authority` 必须来自可信服务端配置，`candidate` 来自经校验的初始化请求，绝不能同时从请求取值。密钥不写入数据库，匹配使用固定长度的常量时间比较。

密码哈希在写事务外执行；事务中的第一条语句竞争初始化标记，仅在尚未关闭且没有账号时允许创建首个管理员。关闭标记和管理员账号在同一事务提交，使用策略中的默认账号配额，并生成 UUIDv7 标识。并发请求只有一个成功；插入失败会回滚标记，可重试。成功标记持久化后，重启或删除全部账号也不会重新开放初始化。此保证约束应用流程，不防止受信任的宿主机管理员直接篡改数据库。

`verify_credentials` 返回仅含经过校验的账号 ID 与管理员标记的服务端对象，不能直接作为客户端提交的身份。Web 会话、退出、CSRF 与保守限流由独立 HTTP 模块处理；公开注册不提供，管理员创建后续账号、密码更新、泄露密码检查及完整安全审计尚未完成。

## 数据库兼容与运行限制

显式调用 `ServerStorage::open_identity` 才会初始化空数据库为 schema 2：`0001_core.sql` 与 `0002_identity.sql`、默认策略和记录在同一事务提交。`schema_metadata.version = 1` 记录的是不可变的第一份迁移；第二份记录保存在 `bootstrap_state.migration_sql`，数据库当前版本以 `PRAGMA user_version = 2` 为准。精确 schema 检查同时验证两份迁移及对象定义。

普通身份服务启动时已有 schema 1 在只读检查阶段被拒绝，不改为 WAL、不清空、不自动升级；schema 2 可重开，未知版本或修改的迁移记录被拒绝。schema 1 仍可通过 `open_initialized` 读取。已提供单独的 [恢复点保护离线迁移](server-migrations.md)，支持 1→2：已有账号须有管理员，迁移永久关闭初始化；空库迁移后仍需初始化权限。不要删除旧库或中断标记来绕过拒绝。后续 schema、附件与完整部署升级仍待 OpenSpec 11.3–11.6，当前只能在独立开发测试目录使用，尚不是生产账号服务。

## 验证

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --locked -p snaptium-server identity::tests
cargo test --workspace --locked
```

Windows 先加载 [开发环境](development.md)。CI 的 Rust job 覆盖上述检查。隔离目录测试验证输入边界、独立盐、版本化校验串、错误/不存在账号、恶意成本拒绝、并发容量、竞争初始化、失败回滚可重试、重启及账号删除后保持关闭、旧 schema 的文件与日志模式不变、修改记录及未来版本拒绝。HTTP 安全与真实进程重启测试见 Web 身份文档；尚未执行 NAS 容器或真实浏览器登录验证。
