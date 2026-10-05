# 当前服务端数据库备份与恢复

此阶段完成 OpenSpec 子项 11.3.1、11.4.1、11.6.1，只适用于精确匹配当前 schema 1/2 的服务端数据库。包含账号、密码校验值、初始化关闭状态、当前表中的文件夹和 Markdown，以及迁移/策略元数据。**不是完整产品备份交付**：附件、自动调度、既有数据升级、原地替换与升级中断恢复仍未实现。浏览器 IndexedDB 草稿不在服务器，不能由此恢复；原生客户端数据库不适用。

## 操作边界

维护命令使用同一个服务端可执行文件，独立于 Web 构建、HTTP、公开 Origin 和初始化密钥。仅供可信的本地管理员运行，未开放 Web/Tauri 文件系统接口。错误不回显路径、参数值、密码校验值、正文或凭据。

- `backup <数据目录> <已存在的备份根目录>`：输出 `backup_created <UUIDv7>`，新备份位于根目录下的该 UUIDv7 子目录。
- `verify-backup <备份子目录>`：成功输出 `backup_verified`，不写入备份数据库。
- `restore <备份子目录> <全新目标目录>`：成功输出 `backup_restored`。目标必须不存在，包括已存在但空的目录也拒绝；目标的父目录必须已存在，且目标不能嵌套在源备份目录内。

独立 `backup` 命令取得相同的 `server.lock`，所以**须先停止服务**；锁冲突立即失败。进程内 `backup::create` 可在其他数据库事务运行时生成一致快照，已经做并发测试，但没有自动调度或远程触发入口。命令不初始化缺失的源数据库、不清空旧数据，也不会启动 HTTP 服务。

备份根目录必须在源数据目录外。当前源目录只接受固定的数据库、锁、WAL 和 SHM 文件；发现 `attachments/` 等未知文件/目录就拒绝，避免把未支持的附件遗漏后误报完整备份。新 schema 或未知 schema 对象也拒绝。

## Windows 本地操作示例

先按 [开发文档](development.md) 加载 Rust/MSVC 环境，并构建 `cargo build --locked -p snaptium-server`。下面仅示范已存在的独立开发账号目录；实际路径由操作者确认。本次实现没有执行这些真实数据操作。

```powershell
# 先停止使用 data/dev-identity 的服务，保留原目录及所有 WAL/SHM 文件。
# 检查备份根目录的 Windows ACL，仅授权运行服务和维护的受信账号。
New-Item -ItemType Directory -Path .\data\recovery -Force | Out-Null
& .\target\debug\snaptium-server.exe backup .\data\dev-identity .\data\recovery

# 将下面的 <UUIDv7> 换成上一条命令输出的标识。
& .\target\debug\snaptium-server.exe verify-backup .\data\recovery\<UUIDv7>
& .\target\debug\snaptium-server.exe restore .\data\recovery\<UUIDv7> .\data\restored-identity
```

若任一步退出码非零，不继续切换服务目录。恢复成功后，停止状态下把 `SNAPTIUM_DATA_DIR` 指向 `data/restored-identity`，使用匹配备份的应用版本启动，并验证账号和初始化状态；旧目录原样保留。schema 1 仍不能直接启动 schema-2 身份服务，备份/恢复不会顺带升级它。请勿将示例中的 `<UUIDv7>` 当作字面目录创建。

容器内入口为 `/app/snaptium-server`，具有同样的子命令。将来容器维护应使用相同版本镜像、独立持久化的备份挂载及 UID/GID 10001 权限，并遵守先停服务、保留旧卷、恢复至新目录的流程。当前默认 Compose 没有备份挂载或身份配置；没有提供可直接覆盖 NAS 数据的命令，也未连接 NAS。

## 清单格式与校验

每个完整备份只有两个常规文件：`server.sqlite3` 和 `manifest.json`，不包含 WAL/SHM。清单为 UTF-8 JSON，不超过 4096 字节，禁止重复/未知字段。文件名为固定值，不接受路径穿越、绝对路径或额外归档文件；根目录及直接成员的符号链接被拒绝。祖先目录和文件系统由可信操作者管理，本阶段不声称能抵抗拥有同目录写权限的恶意本地进程。

| 清单字段 | 约束 |
| --- | --- |
| `formatVersion` | 独立备份格式版本，当前为 1 |
| `storageKind` | `server-sqlite`，不接受客户端数据库 |
| `profile` | `core-database-only` |
| `applicationVersion` | 必须与运行维护命令的应用版本完全相同；当前 0.1.0 |
| `schemaVersion` | 1 或 2，且与数据库 `user_version` 一致 |
| `backupId` | 规范小写 UUIDv7 |
| `createdAtUnixSeconds` | 非零 Unix 秒，清单字段而非文件名解析依据 |
| `database.path` | 固定 `server.sqlite3` |
| `database.bytes` | 精确文件长度，512 字节至 64 GiB |
| `database.sha256` | 64 位小写十六进制 SHA-256，必须匹配文件 |
| `attachmentCount` | 必须为 0 |

64 GiB 是当前维护实现的操作上限，不是账号容量政策，也不是已测量的大数据库性能承诺。哈希通过有界缓冲流式计算，不把整个数据库加载到内存。SHA-256 检测损坏，**不是签名或加密**；可同时修改数据库与清单的攻击者并不会被哈希认证。因此需要受控权限、可信来源、加密存储/传输和异机副本。备份含密码校验值及笔记，应按敏感数据管理。

数据库通过参数绑定的 `VACUUM INTO` 生成一致逻辑快照，纳入已提交 WAL 数据，不纳入尚未提交的事务。它不是活动文件复制，也不是逐页增量 Backup API，不能承诺字节级复制、低 CPU 或超大库低延迟。SQLite 将此列为在线备份的替代机制，参见 [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html) 和 [SQLite Backup API](https://www.sqlite.org/backup.html)。

快照与恢复副本以只读 immutable 连接检查：先拒绝不支持的 schema，再比较迁移记录与精确 schema 对象，执行 `integrity_check(1)` 和外键检查。在解码迁移记录与收集 schema 对象前限制元数据长度和对象数量，防止异常的存储内容进入无界 Rust 字符串/集合。不将 immutable 连接用于活动 WAL 数据库。即使重新计算了哈希，额外表、被改迁移记录、未来版本和外键破坏仍会被拒绝。

## 中断与持久化

生成备份时先完成数据库快照、校验和文件刷新，再写入并刷新 `manifest.partial`，以不会覆盖既有文件的硬链接原子发布 `manifest.json`，最后移除临时清单。没有完整清单或仍含临时/额外文件的备份不可使用；失败的 UUID 目录保留，不自动删除，重试创建新的 UUID 目录。

恢复先完整验证源备份，再排他创建新目标，持久化 `restore.in-progress` 标记并取得目标锁。只复制已验证的离线备份，重新核对副本长度/哈希/完整性/schema，再通过同目录硬链接发布 `server.sqlite3`，完成后移除临时文件和标记。文件系统必须支持同目录硬链接。服务启动发现标记就拒绝，既不创建空库，也不打开半恢复数据；失败目标保留，**不要手动删除标记后强行启动**，应检查原因并恢复至另一个全新目录。

文件使用 `sync_all`；Unix 新目录 0700、新文件 0600，并同步目录元数据。Windows 使用继承 ACL，不自动重设用户目录权限，且没有跨平台标准库目录 fsync 保证；文件刷新不等于已经证明断电安全。Linux/Windows 硬件断电、NAS 实际文件系统和容器 UID/锁/权限仍需发布前验证。使用支持 SQLite WAL、OS 锁与硬链接的本地磁盘，不在 SMB/NFS 上运行数据库。

## 迁移与回滚状态

现有 schema 1→2 自动升级仍拒绝。本阶段仅提供恢复原语，尚未将其接入既有数据的前向迁移，更未完成任务 11.5/11.6 的升级中断演练。后续每次实际迁移必须先生成并验证恢复点，固定对应镜像摘要，再在没有流量时执行可回滚的升级流程。

当前可执行的人工回退方式为：停服务→用对应旧版本镜像/可执行文件验证备份→恢复到全新目录→切换同版本应用到新目录→验证后再接收流量。不执行 down migration，不把旧镜像直接指向新 schema，不删除旧目录。初版 Web 会话只在内存中，重启/恢复需要重新登录；原生设备凭据和同步基线恢复规则尚未实现。

## 验证

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --locked -p snaptium-server backup::tests
cargo test --locked -p snaptium-server --test maintenance
cargo test --workspace --locked
```

CI 执行同一套 Rust 检查；Windows 可在依赖已缓存时追加 `--offline`。测试仅使用临时目录和测试凭据，不操作实际开发账号库或 NAS。覆盖 schema 1/2 还原、原始 Markdown、初始化关闭状态、WAL 与未提交事务、并发原子更新、损坏/缺失/超长/重复/未知清单、路径逃逸、校验值/数据库不匹配、哈希匹配仍不兼容的 schema/外键、已有目标保护、恢复中断阶段拒绝、独立命令登录恢复与错误不回显。Unix CI 另外检查符号链接拒绝及 0700/0600；这些 Unix 专项未在当前 Windows 主机执行。
