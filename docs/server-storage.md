# 服务端 SQLite 连接基础

`apps/server/src/storage.rs` 是服务端专属模块，不与原生客户端共享数据库、连接池或表模型。本阶段只提供经过测试的连接基础，**尚未接入 HTTP 服务启动**；健康端点仍返回 `foundation/not_configured`，未提供账号或正式笔记保存。

## 连接与实例所有权

调用 `ServerStorage::open` 时传入可信的本地数据目录；目录为空或不可用会拒绝。目录规范化后，先打开固定的 `server.lock` 并取得操作系统排他锁，成功后才接触 `server.sqlite3`。锁冲突即失败，不等待、不改数据库；进程退出后由操作系统释放锁。锁文件保留，运行期间不可删除或替换。该保护仅约束遵守锁协议的应用实例，不阻止管理员或其他 SQLite 工具绕过锁。

连接池最多 4 个连接；每个连接设置 WAL、外键约束、5 秒 busy timeout 和 FULL synchronous，获取连接最多等待 5 秒。SQLx 使用异步接口，目录操作在 blocking 线程执行；关闭时先等待连接池排空，再释放所有权。不得从该模块向 UI 或协议层暴露任意 SQL，也不能泄露可绕过所有权的连接池克隆。

配置参考 [SQLx 0.8.6 连接选项](https://docs.rs/sqlx/0.8.6/sqlx/sqlite/struct.SqliteConnectOptions.html)；排他锁参考 [Rust File::try_lock](https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock)。禁用 SQL 语句日志，对外错误只有稳定代码，不包含路径、SQL 或数据库内容。

此基础版本仅接受 schema version 0 且无用户对象的空数据库。已有数据库先只读检查，非零版本或用户对象会拒绝，绝不自动迁移、清空或降级。账号/笔记 schema、备份恢复及升级检查在后续任务落实，因此当前模块只适用于独立开发测试目录。不要指向真实用户数据。

数据必须存放于支持 SQLite WAL 与操作系统文件锁的本地文件系统，不使用 SMB/NFS 数据目录。NAS 上应使用容器宿主机的本地持久卷，而不是把数据库经网络共享挂载到开发机。NAS 文件系统及容器锁行为仍需实际验证。

## 验证

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --locked -p snaptium-server storage::tests
cargo test --workspace --locked
```

Windows 先加载 [开发文档](development.md) 的 Rust/MSVC 环境。CI 的 Rust job 执行同一套检查。测试使用隔离临时目录，验证所有连接配置、连接池上限、竞争实例拒绝、关闭后重开、已有/未来数据库拒绝和非法路径。本机 Windows 测试不代替 Linux 容器、断电或实际 NAS 文件系统测试。
