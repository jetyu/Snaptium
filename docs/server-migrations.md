# 服务端离线迁移与恢复点

已实现 OpenSpec 子项 4.2.2、11.5.1、11.6.2：显式、离线、有恢复点保护的 schema 1→2 迁移。只新增已有的 `bootstrap_state` 定义及迁移记录，不更改账号身份、密码校验值、管理员权限、配额、文件夹、Markdown、修订号、时间或回收站状态。不是完整升级系统：笔记历史/变更流的新 schema、附件协调、自动部署升级和硬件断电验证仍待实现。

普通 HTTP 启动继续拒绝 schema 1，不自动迁移。当前开发目录若已经是 schema 2，无需执行迁移，更不应为了测试而修改真实数据。

## 维护命令

```text
snaptium-server migrate <已存在的数据目录> <已存在的备份根目录>
```

先停止使用该目录的服务，保留数据库、锁和 WAL/SHM；不要删除锁文件。命令独占 `server.lock`，不需要 Web 资源、HTTP 配置或初始化密钥，也不会启动 HTTP。备份根目录必须位于数据目录外、仅向可信操作者开放，并使用支持锁、SQLite WAL 和同目录硬链接的本地文件系统；Windows ACL、Unix 权限及备份限制见 [数据库备份](server-backup.md)。

唯一成功升级输出为：

```text
recovery_point_created <UUIDv7>
schema_migrated 1 2
```

第一行只在新恢复点已创建并重新验证后输出，先于任何迁移 SQL；请记录 UUID 和命令中使用的备份根目录。已经是精确 schema 2 时输出 `schema_already_current`，不生成新备份、不创建标记，也不改初始化状态。错误只有稳定代码，不回显路径、SQL、账号、密码或笔记。

Windows 示例，实际路径必须由操作者确认，本次实现未运行真实数据迁移：

```powershell
# 先停止服务，按开发文档构建当前可执行文件并检查目录权限。
New-Item -ItemType Directory -Path .\data\recovery -Force | Out-Null
& .\target\debug\snaptium-server.exe migrate .\data\schema-one-test .\data\recovery
```

容器内同一入口 `/app/snaptium-server` 接受该子命令，但当前 Compose 没有升级/备份挂载或自动升级脚本。没有在 NAS 上执行上述操作，也没有把 Windows 测试结果当作 NAS 升级验证。

## 顺序与账号策略

1. 检查源目录/数据库已存在，取得所有权，拒绝不兼容的版本、schema、迁移记录、完整性或外键错误。
2. schema 1 若已有账号，则必须已有至少一名管理员；否则报 `migration_administrator_required`，不自动提升账号，也不开始迁移。没有账号时才允许迁移后通过初始化权限创建首个管理员。
3. 在目录外新建一致备份并完整重新校验；不能传入任意陈旧备份来跳过这一步。备份不可用或不完整时，不执行迁移 SQL。
4. 持久化 `migration.in-progress`，记录恢复点 UUID、应用版本及源/目标 schema；备份根目录由操作者保留，不记录绝对路径或凭据。
5. 使用 `BEGIN IMMEDIATE`，在同一连接和事务内重查源 schema/账号策略，执行不可变的 `0002_identity.sql`、持久化初始化关闭状态和迁移 SQL，并设置 `user_version = 2`。精确 schema、完整性及外键检查通过后才提交。
6. 提交后再次校验，成功后才清理中断标记、同步目录并关闭连接池，随后报告成功。

`BEGIN IMMEDIATE` 立即申请写事务；迁移中的 DDL、元数据和版本标记共同提交，参见 [SQLite 事务](https://www.sqlite.org/lang_transaction.html) 与 [SQLx 0.8.6 begin_with](https://docs.rs/sqlx/0.8.6/sqlx/struct.Pool.html#method.begin_with)。备份复制和哈希工作不在写事务内；操作系统所有权锁覆盖整个流程。

已有账号的 schema 1 初始化状态设置为永久关闭；空 schema 1 设置为尚未初始化，之后启动仍要求受控初始化密钥。schema 2 重复执行是 no-op，即使其账号已被删除也不会重新开放已经关闭的初始化入口。旧库中不符合后续账号输入边界的数据不会被此步骤自动修正；本阶段不提供账号修复、权限提升或任意 SQL 接口。

## 中断与回滚

| 中断位置 | 数据库逻辑状态 | 处理 |
| --- | --- | --- |
| 恢复点尚未就绪 | 未执行迁移 SQL | 保留源；排除备份错误后重试 |
| 标记已持久化，事务尚未开始 | schema 1 | 拒绝启动，从记录的恢复点还原至新目录 |
| DDL 或版本更新后、提交前 | SQLite 回滚至 schema 1 | 保留标记并拒绝启动，不绕过恢复流程 |
| 提交后、完成检查/清理前 | 可能已经是 schema 2 | 仍拒绝启动，不凭版本号猜测成功 |
| 完成检查且清理成功 | 已验证 schema 2 | 可按身份配置启动；保留恢复点 |

正常存储及 HTTP 启动只检查标记是否存在，不信任或自动修复标记内容；即使文件为空、损坏或是符号链接，也拒绝打开数据库。中断标记存在时重复 `migrate` 同样拒绝，不自动重跑已部分执行的 SQL。提交/检查前的失败保留标记；若最终标记清理或目录刷新报告 I/O 错误，也不要仅凭标记消失继续部署，应确认恢复点并按回滚流程处理。

回滚必须保留失败目录及 WAL 文件，**不删除标记强行启动，不执行 down migration**：

```powershell
# 使用已记录、经过确认的恢复点 UUID，停止服务并保留失败目录。
& .\target\debug\snaptium-server.exe verify-backup .\data\recovery\<UUIDv7>
& .\target\debug\snaptium-server.exe restore .\data\recovery\<UUIDv7> .\data\restored-before-migration
```

将恢复出的目录交给与恢复点匹配的原应用版本/固定摘要镜像，核验数据后再决定是否部署。schema 1 的恢复点仍是 schema 1，不会因恢复自动成为身份服务；排除失败原因后，可在恢复的新目录重新执行显式迁移，生成另一个新的恢复点。schema 2 内存 Web 会话在重启后失效，需要重新登录。原生设备凭据/同步基线仍未实现，不提供其恢复承诺。

所有备份保留，不自动清理或覆写；保留旧镜像的不可变摘要及配置，配置秘密不写入备份清单。Windows 当前仅刷新文件，没有标准库目录 fsync 保证；强制进程退出测试不等价于硬件断电。SQLite 事务、NAS 文件系统与实际容器权限/信号行为还需目标平台验证。

## 验证

```text
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --locked -p snaptium-server migration::tests
cargo test --locked -p snaptium-server --test maintenance
cargo test --workspace --locked
```

CI Rust job 执行完整检查。本机缓存齐全时可追加 `--offline`，Windows 环境入口见 [开发文档](development.md)。测试只有隔离临时目录及测试凭据，覆盖原始 Markdown/大修订号/配额/密码校验值保留、空库和管理员策略、schema 2 重试不重开初始化、不可用恢复点、锁冲突、缺失/空/未来数据库拒绝，以及提交前后失败和强制进程退出后的恢复重试。故障钩子仅编译进单元测试程序，不通过生产环境变量、HTTP 或命令参数开放。真实服务端可执行文件测试验证离线迁移命令、一次性恢复点、恢复旧 schema 和中断标记导致的 HTTP 启动拒绝。
