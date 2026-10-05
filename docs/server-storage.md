# 服务端 SQLite 连接基础

`apps/server/src/storage.rs` 是服务端专属模块，不与原生客户端共享数据库、连接池或表模型。本阶段提供经过测试的连接与初始 schema，**尚未接入 HTTP 服务启动**；健康端点仍返回 `foundation/not_configured`，未提供 Web 登录或正式笔记保存。Rust 凭据与初始化模块见 [服务端身份基础](server-identity.md)。

## 连接与实例所有权

调用 `ServerStorage::open` 时传入可信的本地数据目录；目录为空或不可用会拒绝。目录规范化后，先打开固定的 `server.lock` 并取得操作系统排他锁，成功后才接触 `server.sqlite3`。锁冲突即失败，不等待、不改数据库；进程退出后由操作系统释放锁。锁文件保留，运行期间不可删除或替换。该保护仅约束遵守锁协议的应用实例，不阻止管理员或其他 SQLite 工具绕过锁。

连接池最多 4 个连接；每个连接设置 WAL、外键约束、5 秒 busy timeout 和 FULL synchronous，获取连接最多等待 5 秒。SQLx 使用异步接口，目录操作在 blocking 线程执行；关闭时先尽力完成 WAL checkpoint，再等待连接池排空，最后释放所有权。checkpoint 失败时已提交数据保留在 WAL，不删除 WAL 文件，也不以 checkpoint 代替一致备份。不得从该模块向 UI 或协议层暴露任意 SQL，也不能泄露可绕过所有权的连接池克隆。

配置参考 [SQLx 0.8.6 连接选项](https://docs.rs/sqlx/0.8.6/sqlx/sqlite/struct.SqliteConnectOptions.html)；排他锁参考 [Rust File::try_lock](https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock)。禁用 SQL 语句日志，对外错误只有稳定代码，不包含路径、SQL 或数据库内容。

`open` 接受 schema version 0 且无用户对象的空数据库，或精确匹配受支持 schema 1/2 的数据库。已有数据库先只读检查版本、迁移记录，并将实际 schema 对象与隔离内存数据库中执行同一 SQL 后的对象逐项比较；未知版本、未知对象、修改的列/约束或迁移记录均拒绝。迁移 SQL 统一使用 LF，避免 Windows/Linux 换行差异影响兼容判断。没有自动升级、清空或降级逻辑。

显式调用 `open_initialized` 才会对空库执行 `migrations/0001_core.sql`。表、默认策略、迁移记录和 `user_version = 1` 在同一事务中提交，语句失败显式回滚，再次初始化可重试；schema 1 重开只验证，不重写数据。此版本不升级已有用户数据；未来增加迁移前必须落实并验证一致备份和恢复流程。当前仍仅用于独立开发测试目录，不能作为生产存储交付。

身份模块使用 `open_identity`，仅对空库在同一事务内执行上述 SQL 和 `migrations/0002_identity.sql`，新增持久化的 `bootstrap_state` 并设 `user_version = 2`。schema 2 重开同时验证两份迁移记录与对象定义；已有 schema 1 在只读探测阶段拒绝，不改变其日志模式，也不自动升级。`open_initialized` 仍支持重开已验证的 schema 1/2，不降级 schema 2。

schema 1 包含 `users`、单层 `folders`、`notes`、`server_policy`、`schema_metadata`。默认策略为附件 20 MiB、账号 5 GiB（管理员可调整）、每篇最近 100 个历史版本、公开注册关闭、同步删除记录不自动清理。这些策略已持久化，但上传限额、累计容量检查、历史裁剪、管理员调整 API 与 HTTP 账号认证尚未实现，不能把默认值视作已生效的业务限制。ID/时间/Markdown 的严格边界校验在领域、协议及 repository 任务中落实，数据库表不作为 wire 类型。

笔记文件夹外键包含 `owner_id`，阻止跨账号关联。删除含笔记的文件夹会被数据库拒绝，后续 repository 必须在事务内先移至虚拟“未分类”（`folder_id = NULL`），再删除文件夹，并同时落实修订和变更流。当前测试只验证底层约束及内容保留，不代表文件夹 API 已实现。会话、设备、附件、历史、变更流和幂等结果表留待各业务任务，任务 4.2 整体未完成。

数据必须存放于支持 SQLite WAL 与操作系统文件锁的本地文件系统，不使用 SMB/NFS 数据目录。NAS 上应使用容器宿主机的本地持久卷，而不是把数据库经网络共享挂载到开发机。NAS 文件系统及容器锁行为仍需实际验证。

## 验证

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --locked -p snaptium-server storage::tests
cargo test --locked -p snaptium-server schema::tests
cargo test --workspace --locked
```

Windows 先加载 [开发文档](development.md) 的 Rust/MSVC 环境。CI 的 Rust job 执行同一套检查。测试使用隔离临时目录，验证连接配置、连接池上限、竞争实例拒绝、关闭重开、已有/未来数据库拒绝、非法路径、初始化失败回滚及重试、策略默认值、schema 修改拒绝、文件夹跨账号关联拒绝和笔记保留。本机 Windows 测试不代替 Linux 容器、断电或实际 NAS 文件系统测试。
