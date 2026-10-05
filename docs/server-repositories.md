# 服务端读取数据访问层

`apps/server/src/repository.rs` 提供借用 `ServerStorage` 的 `ReadRepository`，不复制连接池，也不与原生数据库或共享 wire 类型混用。当前仅提供笔记读取和文件夹分页；尚未接入 HTTP，不提供账号认证或业务写入。

## 输入与账号隔离

`EntityId` 只接受长度 36、规范小写连字符格式、RFC 4122 variant 的 UUIDv7；`OwnerId` 是独立类型，避免把笔记 ID 误用为 owner。构造一个合法 owner **不等于通过认证**：未来 HTTP handler 必须从已验证会话获得 owner，禁止直接信任请求中的账号 ID。

所有查询绑定 SQL 参数并在同一查询中限制 owner。读取其他账号的笔记与读取不存在的笔记都返回 `None`，不先做全局存在性查询。回收站笔记可按 ID 读取并带有独立状态；这一底层接口不代替未来列表/回收站 API 的过滤规则。

文件夹分页要求每页 1–100 项，按规范 UUID 排序，使用 `id > after` 的 keyset 边界，一次最多查询页大小加一行，用于判定是否有下一页。该边界不是同步 change-log 游标，不保证多次请求期间数据库的固定快照；游标自身也不授予访问权限。分页方式参考 [SQLite 滚动窗口查询](https://www.sqlite.org/rowvalue.html#scrolling_window_queries)。

## 数据与日志边界

读取结果是服务端专属记录，不派生 `Serialize` 或 `Debug`，避免误用为 API 响应或把笔记内容写入日志。数据库 ID、关联文件夹 ID 和正修订号会再次校验；非法行返回固定 `invalid_stored_data`，不静默跳过、不修复或删除。数据库故障使用 `repository_unavailable`，不携带 SQL、账号、路径或原始错误。

修订号使用 `NonZeroU64`，从 SQLite 正整数无损转换；未来 wire 层必须编码成十进制字符串，不能传递 JavaScript 不安全整数。Markdown 在读取时保持原样，不重新序列化、不执行 HTML、不宣称在此完成内容清洗。渲染和写入边界仍需受控 Markdown 规则；标题/正文大小、时间格式与请求 DTO 验证留在对应写入及协议任务。

目前不提供创建、更新、移动或删除函数，以免绕过修订前置条件、历史保存、配额及变更记录。任务 4.3 整体仍待完成；这也不代表任务 5.6 的全部 HTTP 授权已完成。

## 验证

```text
cargo test --locked -p snaptium-server repository::tests
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
```

Windows 使用 [开发文档](development.md) 的 Rust/MSVC 和工作区临时目录环境。Rust CI 执行完整 workspace 测试。隔离数据库测试覆盖非法 ID/分页大小、跨账号笔记与文件夹隔离、分页顺序/无重复、源码原样读取、最大 SQLite 修订、回收站状态、关闭重开后内容保留以及非法存储行的无内容错误。
