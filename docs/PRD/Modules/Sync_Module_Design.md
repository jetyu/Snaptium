# NoteWizard 同步功能详细设计（WebDAV / OSS(S3兼容)）

## 1. 背景与目标

基于当前代码结构（Electron Main + Renderer + VFS 本地数据库目录），新增统一同步能力：

- 支持同步后端：
  - WebDAV
  - OSS（AWS S3 兼容）
- 同步范围：**以工作区根目录下 `Database/` 为备份与同步主目录**。
- UI 目标：
  - 首选项新增“同步”页签，支持后端类型下拉切换（WebDAV / OSS），动态展示对应配置。
  - 提供“测试连接”“手动同步”按钮。
  - 展示“最后一次同步时间 / 同步笔记数量 / 同步状态”。
  - 定时同步下拉：5 / 10 / 15 分钟。
  - 主界面“新建/搜索”旁新增“同步按钮”，可一键手动同步。
- 数据一致性目标：支持客户端常见本地增删改与服务端整合，具备冲突处理与 fallback。
- 可选能力：自动同步（定时 + 事件触发）。

---

## 2. 现状分析（与现有实现对齐）

### 2.1 本地数据结构

当前 VFS 将笔记数据存储在工作区目录下：

- `Database/nodes.jsonl`：节点元数据（笔记/文件夹树）。
- `Database/objects/*.md`：笔记内容对象。
- `Database/meta.json`：工作区元信息。
- `Database/trash`：回收站相关。

### 2.2 设置体系

- Renderer 侧 `settings.store.ts` 维护配置、通过 `settings.service.ts` -> IPC 持久化。
- Main 侧 `settings.service.js` 有默认配置与读写 `preferences.json`。
- 设置弹窗 `SettingsDialog.vue` 采用 tab 结构，扩展同步页签成本低。

### 2.3 主界面入口

- 左侧 `WorkspaceSidebar.vue` 的 header action 区已有“搜索/新建”按钮，可在同区域新增“同步”按钮。

---

## 3. 设计原则

1. **不破坏现有 VFS 边界**：同步模块不直接改业务层对象模型，以“Database 目录快照/对象级同步”完成传输。
2. **最小侵入**：新增独立 `sync` 模块（main + renderer），仅通过 IPC 暴露能力。
3. **可扩展**：Provider 抽象层支持未来新增 OneDrive / Dropbox 等。
4. **可恢复**：任何失败均可回退到“本地优先 + 下次重试”。
5. **可观测**：同步状态、时间、数量、错误原因需可见、可日志追踪。

---

## 4. 功能范围（MVP + 可选增强）

### 4.1 MVP（必须）

1. Provider：WebDAV、S3 兼容 OSS。
2. 手动同步：
   - 首选项按钮触发。
   - 主界面快捷按钮触发。
3. 连接测试：校验凭证 + 目标路径可读写。
4. 状态展示：最后同步时间、笔记数量、状态（成功/失败/进行中/冲突）。
5. 定时同步：5/10/15 分钟轮询。
6. 冲突 fallback：保底不丢数据（保留冲突副本）。

### 4.2 可选增强

1. 自动同步（事件触发）：本地写入后 debounce 触发增量同步。

---

## 5. 架构设计

### 5.1 新增模块分层

#### Main 进程（核心）

- `electron/main/services/sync/`
  - `sync.service.js`：统一编排（计划任务、状态机、冲突处理）。
  - `providers/webdav.provider.js`
  - `providers/s3.provider.js`
  - `manifest.service.js`：本地/远端清单生成与比对。
  - `sync-lock.service.js`：本地锁 + 远端租约锁。
- `electron/main/ipc/modules/sync.js`
  - 暴露 IPC：测试连接、手动同步、读取状态、更新调度。

#### Renderer 进程

- `src/renderer/features/sync/`
  - `services/sync.service.ts`：调用 IPC。
  - `store/sync.store.ts`：同步状态（isSyncing/status/lastSyncAt/count/error）。
  - `composables/useSync.ts`：UI复用逻辑。
- 设置页：新增 `SyncSettings.vue`。
- 主界面：`WorkspaceSidebar.vue` header actions 增加同步按钮。

### 5.2 Provider 抽象接口

```ts
interface SyncProvider {
  testConnection(config): Promise<{ ok: boolean; message?: string }>;
  list(remotePrefix: string): Promise<RemoteObjectMeta[]>;
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, content: Buffer, meta?: Record<string,string>): Promise<void>;
  deleteObject(key: string): Promise<void>;
  stat?(key: string): Promise<RemoteObjectMeta | null>;
}
```

---

## 6. 数据模型与配置设计

### 6.1 AppSettings 扩展

```ts
sync: {
  enabled: boolean;
  provider: 'webdav' | 's3';
  intervalMinutes: 5 | 10 | 15;
  autoSync: boolean;
  remotePath: string;
  webdav?: {
    endpoint: string;
    username: string;
    password: string;
  };
  s3?: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
  };
  lastSyncAt?: number;
  lastSyncStatus?: 'idle' | 'running' | 'success' | 'failed' | 'conflict' | 'degraded';
  lastSyncNoteCount?: number;
  lastSyncMessage?: string;
}
```

### 6.2 远端目录规范

统一以 `remotePath/Database` 存储（后续新增子目录按白名单纳入）：

- `remotePath/Database/nodes.jsonl`
- `remotePath/Database/meta.json`
- `remotePath/Database/objects/...`
- `remotePath/Database/trash/...`
- `remotePath/Database/.sync/manifest.json`
- `remotePath/Database/.sync/lock.json`

### 6.3 Manifest 内容（建议）

```json
{
  "schemaVersion": 1,
  "workspaceId": "uuid",
  "deviceId": "uuid",
  "generation": 42,
  "lastSyncBy": "device-uuid",
  "syncSessionId": "uuid",
  "generatedAt": 1710000000000,
  "files": {
    "objects/xxx.md": {"sha256": "...", "size": 123, "mtime": 1710000000000},
    "nodes.jsonl": {"sha256": "...", "size": 456, "mtime": 1710000000000}
  },
  "tombstones": {
    "objects/deleted.md": {"deletedAt": 1710000000000, "deletedBy": "device-uuid"}
  }
}
```

---

## 7. 同步算法（核心）

采用 **Manifest 对账 + 文件级增量双向同步**。

### 7.1 步骤总览

1. 获取同步锁（本地互斥 + 远端租约锁）。
2. 扫描本地 `Database` 生成 `localManifest`。
3. 拉取远端 `manifest` 与必要元数据，形成 `remoteManifest`。
4. 三方对比（base 可用上次同步快照；如 base 缺失进入 Bootstrap）。
5. 执行变更（先拉后推，减少误覆盖）。
6. 两阶段提交（对象变更 -> manifest commit）。
7. 更新本地 `baseManifest`、状态并释放锁。

### 7.2 Bootstrap（首次接入 / 重装系统）

触发条件：

- 本地不存在 `baseManifest`
- 首次配置同步账号
- 重装系统后重新安装

三态决策：

1. 本地空 + 远端有：默认下载恢复本地（需二次确认）。
2. 本地有 + 远端空：默认上传初始化远端（需二次确认）。
3. 本地有 + 远端有 + 无 base：进入“安全比较模式”（禁删，只拉取与冲突标记）。

关键规则：

- 无 base 时禁止删除本地/远端数据。
- 首次握手成功后再写入新的 `baseManifest` 和 `generation`。

### 7.3 Diff 算法确定性

```ts
type DiffResult = {
  toUpload: string[]
  toDownload: string[]
  toDeleteRemote: string[]
  toDeleteLocal: string[]
  conflicts: string[]
}
```

核心判定：

- `localExists / remoteExists / baseExists`
- `localChanged = localHash !== baseHash`
- `remoteChanged = remoteHash !== baseHash`

规则：

1. 新增
   - `!base && local && !remote -> toUpload`
   - `!base && !local && remote -> toDownload`
2. 单边修改
   - `base && localChanged && !remoteChanged -> toUpload`
   - `base && !localChanged && remoteChanged -> toDownload`
3. 双边修改
   - 都变且 hash 相同 -> skip
   - 都变且 hash 不同 -> conflict
4. 删除
   - `base && !local && remote && !remoteChanged -> toDeleteRemote`
   - `base && local && !remote && !localChanged -> toDeleteLocal`
5. 删除 + 修改 -> conflict
6. tombstone 优先：文件缺失但 tombstone 存在，按删除语义处理，避免误复活。

### 7.4 冲突策略（fallback）

- `objects/*.md`：本地优先，远端副本保存为 `objects/<id>.cft.<timestamp>.md`。
- `nodes.jsonl`：按 `node.id` 字段级 merge，`updatedAt` 仅作次级参考。
- 合并失败进入 `conflict` 状态并保留双份数据。

### 7.5 删除与 tombstone 策略

- 删除基于 base 判定，避免误删新增数据。
- 远端删除优先转 `trash`（不支持原子移动时复制+删除）。
- 所有删除写入 tombstone，默认保留 30 天。

### 7.6 两阶段提交与恢复

- Phase A：对象层变更并记录 pending 会话。
- Phase B：全部成功后原子更新远端 manifest（commit point）。
- 仅 Phase B 成功后更新本地 `baseManifest`。
- 若中断，下次读取 pending 会话进行重放或回滚。

### 7.7 远端租约锁（多设备并发）

`lock.json` 字段：`ownerDeviceId` / `acquiredAt` / `expiresAt` / `heartbeatAt`。

- 同步期间 heartbeat 续约。
- 锁过期可抢占，抢占写日志并 UI 提示。

---

## 8. UI/交互设计

### 8.1 首选项-同步页

新增 tab：`pref.pane.sync`。

1. Provider 下拉框：WebDAV / OSS(S3兼容)
2. 动态表单：
   - WebDAV: endpoint / username / password / remotePath
   - S3: endpoint / region / bucket / accessKeyId / secretAccessKey / remotePath / forcePathStyle
3. 操作按钮：测试连接 / 手动同步
4. 状态区：最后同步时间 / 同步笔记数量 / 状态 + message
5. 定时同步：5 / 10 / 15 分钟

### 8.2 主界面快捷同步

`WorkspaceSidebar.vue` header actions 新增同步按钮：

- 点击触发手动同步
- 同步中 loading + disabled
- 失败 toast 显示错误摘要
- tooltip 显示同步后端、最后同步时间、数量、状态

---

## 9. IPC 与接口设计

建议新增 `IPC_CHANNELS`：

- `SYNC_TEST_CONNECTION`
- `SYNC_RUN_MANUAL`
- `SYNC_GET_STATUS`
- `SYNC_UPDATE_SETTINGS`
- `SYNC_SCHEDULE_REFRESH`

统一返回：

```ts
type SyncResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};
```

---

## 10. 自动同步方案（可选）

### 10.1 定时同步（第一阶段）

- Main 进程 `setInterval` 读取 `intervalMinutes`
- 应用启动 / 配置变更时刷新定时器
- 若已有同步任务进行中则跳过本次 tick

### 10.2 事件触发同步（第二阶段）

- VFS 写入后触发 `sync.service.enqueue('local-change')`
- 15~30 秒防抖
- 与定时任务共用锁机制

---

## 11. 一致性、完整性与容错

1. 原子写：复用 temp + rename。
2. 幂等重试：指数退避最多 3 次。
3. 校验：上传后可选 ETag/hash 校验。
4. 中断恢复：manifest + pending 会话恢复。
5. 日志：记录耗时、变更数、冲突数、deviceId、syncSessionId。
6. 远端 manifest 丢失/损坏进入 `degraded`：禁删、保守同步、用户提示。

---

## 12. 非用户笔记数据备份范围

1. 当前版本保证 `Database` 主目录可同步。
2. `Database/trash` 纳入同步。
3. `Database/history` 默认不纳入同步。
4. 后续新增目录采用白名单 + 配置化。

---

## 13. 分阶段实施计划

### Phase 1（基础能力）

- 配置模型扩展 + 设置持久化
- Sync IPC + sync.service 框架
- WebDAV / S3 testConnection
- 同步设置页 UI（下拉/动态字段/测试连接/手动同步/状态）
- Bootstrap 首次接入与重装恢复流程

### Phase 2（可用同步）

- Manifest + 双向增量
- 确定性 Diff + 冲突 fallback
- tombstone 删除语义与保留期
- 远端租约锁（多设备并发）
- 主界面快捷同步按钮
- 定时同步（5/10/15）

### Phase 3（增强）

- 事件触发自动同步（防抖）
- 两阶段提交恢复优化
- 冲突可视化（冲突列表/一键处理）

---

## 14. 验收标准（DoD）

1. WebDAV 与 S3 连接测试可通过，并给出明确失败原因。
2. 本地新增/修改/删除后，手动同步可正确反映到远端。
3. 双端并发修改同一笔记时，不发生数据丢失，冲突可追溯。
4. UI 正确展示最后同步时间、数量、状态。
5. 定时同步 5/10/15 分钟生效并可动态切换。
6. 主界面同步按钮可无需打开首选项触发同步。
7. 重装系统后可通过 Bootstrap 流程安全恢复，不发生误删。

---

## 15. 风险与规避

1. S3 兼容实现差异：统一最小能力集 + provider 适配层。
2. 大工作区扫描性能：manifest 缓存 + 增量 hash。
3. `nodes.jsonl` 合并边界复杂：字段级 merge + 冲突保底。
4. 多设备并发覆盖：远端租约锁 + generation + 审计日志。

---

## 16. 实现约束附录（AI/研发统一执行）

> 目的：将设计文档从“方案描述”提升为“可直接编码规格”，降低多实现分歧。

### 16.1 `nodes.jsonl` 字段级合并决策矩阵

| 字段 | 冲突场景 | 决策规则 | 备注 |
|---|---|---|---|
| `name` | 双端都改且不同 | 本地优先，并生成冲突副本提示 | 保证当前编辑连续性 |
| `parentId` | 双端都改且不同 | 若目标父节点不存在，先挂根目录并标记 `needsRepair=true` | 防止孤儿节点 |
| `trashed` | 一端 true 一端 false | `true` 优先 | 防止误复活 |
| `locked` | 一端 true 一端 false | `true` 优先 | 安全优先 |
| `order` | 双端都改 | 先比较 `updatedAt`；相等时按 `deviceId` 字典序稳定决策 | 保证确定性 |
| `updatedAt` | 时钟偏差 | 仅作次级参考，不作为唯一胜负条件 | 避免时钟漂移问题 |

### 16.2 pending 会话文件规范

路径：`remotePath/Database/.sync/pending/<syncSessionId>.json`

```json
{
  "sessionId": "uuid",
  "deviceId": "uuid",
  "generation": 42,
  "startedAt": 1710000000000,
  "phase": "preparing",
  "operations": {
    "upload": ["objects/a.md"],
    "download": ["objects/b.md"],
    "deleteRemote": ["objects/c.md"],
    "deleteLocal": []
  },
  "retries": 0,
  "lastError": null
}
```

状态转移：

- `preparing -> applying -> committing -> done`
- 任意阶段失败：`-> failed`（允许重试）
- 启动恢复：读取所有 `failed/committing` 会话，按 `startedAt` 升序恢复

### 16.3 远端租约锁参数（默认值）

- `leaseTTL = 90s`
- `heartbeatInterval = 30s`
- `gracePeriod = 10s`

抢占条件：`now > expiresAt + gracePeriod`。

抢占流程：

1. 记录日志（旧 owner、新 owner、时间戳）。
2. 强制刷新远端 manifest。
3. 重新 diff 后再继续同步。

### 16.4 同步统计字段口径（UI 统一）

状态模型补充：

```ts
syncStatus: {
  lastSyncChangedNoteCount: number;
  lastSyncScannedFileCount: number;
  lastSyncConflictCount: number;
}
```

显示口径：

- UI 主显示“同步笔记数量” = `lastSyncChangedNoteCount`
- Tooltip 额外显示扫描总文件数与冲突数

### 16.5 错误码标准化

错误码枚举（Main -> Renderer 统一）：

- `SYNC_AUTH_FAILED`
- `SYNC_NETWORK_TIMEOUT`
- `SYNC_REMOTE_LOCKED`
- `SYNC_MANIFEST_CORRUPTED`
- `SYNC_CONFLICT_DETECTED`
- `SYNC_PROVIDER_NOT_SUPPORTED`
- `SYNC_BOOTSTRAP_REQUIRED`

约束：

1. Main 进程返回结构化错误：`{ code, message, detail? }`
2. Renderer 仅做错误码到 i18n 文案映射
3. 日志保留原始异常栈与 `syncSessionId`

### 16.6 最小实现验收清单（编码前自检）

- [ ] 无 baseManifest 时，删除操作被硬性禁止。
- [ ] Bootstrap 三态流程具备二次确认。
- [ ] 两阶段提交成功后才更新本地 baseManifest。
- [ ] tombstone 生效且具备保留期清理。
- [ ] 租约锁 heartbeat 与抢占机制可验证。
- [ ] `nodes.jsonl` 字段级合并具备确定性输出。
- [ ] UI 统计口径与错误码映射一致。

