# NoteWizard 模块文档：数据架构与迁移 (Data Architecture & Migration)

## 1. 核心存储规范 (The Source of Truth)
NoteWizard 采用“逻辑层与物理层分离”的存储架构。所有用户数据均位于工作区根目录下的 `Database` 文件夹内。

### 目录结构预览
```text
Workspace/
└── Database/
    ├── nodes.jsonl         # 核心元数据：记录笔记层级、标题、关联 ID 等
    ├── meta.json           # 数据库元信息：工作区 ID、加密状态标号
    ├── objects/            # 笔记内容库：以 contentId 命名的 .md 文件
    ├── trash/              # 回收站库：暂存已删除的 .md 内容
    └── images/             # 媒体资源库：各笔记关联的图片文件
```

## 2. 元数据协议 (nodes.jsonl)
每一行是一个独立的 JSON 对象，代表一个节点（文件或文件夹）。
- **id**: (UUID) 节点的唯一逻辑标识符。
- **type**: `folder` | `file`。
- **name**: 笔记或文件夹的显示名称。
- **parentId**: 父节点的 ID（根目录为 `null`）。
- **contentId**: (UUID) 仅文件节点拥有，指向 `objects/` 目录下的物理文件名。
- **order**: 排序权重（基于时间戳）。
- **locked**: (Boolean) 是否处于“预览保护/只读模式”。
- **trashed**: (Boolean) 是否在回收站中。

## 3. 加密协议 (Encryption Format)
加密笔记在物理磁盘上以特定前缀标记，格式必须严苛遵循：
`ENCRYPTED:v1:salt:iv:authTag:data`
- **Prefix**: `ENCRYPTED`
- **Version**: `v1`
- **Salt/IV/AuthTag**: Base64 编码的加密元数据，用于 AES-256-GCM 解密。

## 4. 2.0 兼容性与无缝切换
### 数据继承逻辑 (Seamless Inheritance)
v2.0 (Vue + CM6) 版本将 100% 沿用上述结构。切换逻辑如下：
1. **统一路径管理**: v2.0 启动时将从同一 `preferences.json` (或系统默认路径) 读取 `noteSavePath`。
2. **初始化**: 调用 `vfs.js` 扫描 `nodes.jsonl` 构建内存 Map。
3. **加密适配**: 使用相同的 `encryption-ipc.js` 解密算法，确保用户在 v1.x 中设置的“恢复密钥”在 v2.0 中依然有效。

### 切换风险控制 (Risk Mitigation)
- **原子化写入 (Atomic Write)**: 
  1. 向 `.tmp` 写入新数据。
  2. **校验**: 回读新文件确保磁盘写入完整。
  3. **备份**: 将旧文件改为 `.bak`。
  4. **重命名**: 将 `.tmp` 原子化改名为原文件名。
  5. 成功后清理 `.bak`。支持因崩溃导致的数据自我发现逻辑。
- **节点持久化**: `nodes.jsonl` 每行 JSON 必须完整保留 `id`, `type`, `name`, `parentId`, `contentId`, `order` 字段。

## 5. 导入/导出全量兼容
`.nwp` 包本质上是上述 `Database` 结构的 ZIP 压缩包，版本升级不会改变包内协议，确保不同版本间生成的包可以自由互导。
