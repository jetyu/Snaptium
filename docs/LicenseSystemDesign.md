# 授权系统设计

## 目标

授权系统用于区分用户当前可用的产品能力，并让测试用户和付费用户通过激活码解锁高级功能。

当前产品策略：

- `Free` 是默认基础版本，不需要激活。
- `Insider` 是测试用户版本，需要激活。
- `Pro` 是付费用户版本，需要激活。
- `Insider` 和 `Pro` 激活后解锁全部高级功能。
- `Free` 只能使用基础功能，不能使用 AI 服务配置、智能写作、知识库和云同步。
- Free 用户访问高级功能时显示升级提示。

外部接口参考 `docs/LICENSE_VERIFICATION_REPORT.md`。

生产环境 License API：

```text
https://api.snaptium.com/
```

## 授权类型

```ts
type LicensePlan = 'free' | 'insider' | 'pro';
```

### Free

- 默认本地授权状态。
- 不需要激活码。
- 首次启动即可使用。
- 只开放基础功能。
- 不开放高级功能。
- 访问高级功能时显示升级提示，而不是只显示禁用状态。

### Insider

- 测试用户授权。
- 需要通过 License API 激活。
- 激活成功后开放全部高级功能。
- 客户端能力等同于 Pro。
- 是否有效、是否过期完全由服务端控制。
- 服务端返回明确过期时间。

### Pro

- 付费用户授权。
- 需要通过 License API 激活。
- 激活成功后开放全部高级功能。
- 客户端能力等同于 Insider。
- 暂时按买断制处理。
- 虽然是买断制，客户端仍需要定期向服务端验证授权是否仍然有效。

## 授权码格式

服务端当前用授权码前缀区分授权来源和类型：

```text
SNPI-xxxx-xxxx-xxxx-xxxx -> Insider
SNPP-xxxx-xxxx-xxxx-xxxx -> Pro
```

客户端可以在输入框中根据前缀做轻量提示，但不能只依赖前缀决定最终授权类型。最终 `plan` 必须以 License API 返回值为准。

输入规范：

- 激活码输入时允许用户输入小写，提交前统一转成大写。
- 提交前 trim 空白。
- 可以移除用户误输入的空格。
- 不在 Renderer 里计算 `license_key_hash`。

## 服务端数据模型

当前 Web 服务端表结构包括三张表：

```text
licenses
license_devices
license_events
```

### licenses

```text
id                  授权 ID
license_key_hash    授权码 SHA-256 hash
license_key_plain   明文授权码，仅服务端管理用途
plan                授权类型，例如 Insider / Pro
user_channel        用户来源渠道，例如 GitHub / App
max_devices         可绑定设备数
status              授权状态，例如 active
issued_at           签发时间
expires_at          过期时间
grace_days          服务端宽限天数
metadata            JSON 扩展信息
```

客户端关心的字段映射：

```text
plan -> LicensePlan
max_devices -> maxDevices
status -> valid/status
expires_at -> expiresAt
grace_days -> 服务端计算 grace_expires_at 后返回给客户端
```

`plan` 在服务端示例中为 `Insider`。客户端需要在边界层归一化为小写：

```ts
function normalizePlan(plan: string): LicensePlan {
  const value = plan.trim().toLowerCase();
  if (value === 'insider') return 'insider';
  if (value === 'pro') return 'pro';
  return 'free';
}
```

客户端不直接消费 `license_key_plain`、`metadata.billing_status` 等服务端内部字段。

### license_devices

```text
id                         设备记录 ID
license_id                 所属授权 ID
device_fingerprint_hash    设备指纹 hash
device_name                设备名
first_activated_at         首次激活时间
last_seen_at               最近心跳 / 校验时间
last_ip_prefix             脱敏 IP 前缀
status                     设备状态，例如 active
```

客户端设备列表只展示 `status = active` 的设备。已解绑、禁用或历史设备不应默认展示在授权管理页，除非后续增加“查看历史设备”。

客户端字段映射：

```text
id -> LicenseDevice.id
device_fingerprint_hash -> LicenseDevice.fingerprint
device_name -> LicenseDevice.name
first_activated_at -> LicenseDevice.activatedAt
last_seen_at -> LicenseDevice.lastSeenAt
status -> LicenseDevice.status
```

`last_ip_prefix` 默认不展示。它属于审计和风控信息，如后续需要展示，应只显示脱敏信息。

### license_events

```text
id              事件 ID
license_id      所属授权 ID
event_type      事件类型
actor_type      操作者类型
actor_id        操作者 ID
ip_prefix       脱敏 IP 前缀
user_agent_hash User-Agent hash
created_at      创建时间
payload         JSON 事件 payload
```

客户端不直接写审计日志。激活、校验、心跳、解绑设备等操作由服务端记录 `license_events`。

## 功能权限

```ts
type LicensedFeature =
  | 'aiSources'
  | 'aiAssistant'
  | 'rag'
  | 'sync';

const PLAN_FEATURES = {
  free: {
    aiSources: false,
    aiAssistant: false,
    rag: false,
    sync: false,
  },
  insider: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
  pro: {
    aiSources: true,
    aiAssistant: true,
    rag: true,
    sync: true,
  },
} as const;
```

需要授权的高级功能：

- AI 服务配置。
- 智能写作。
- RAG / 知识库。
- 云同步。

Free 可用的基础功能：

- 本地笔记。
- 本地编辑器和预览。
- 本地搜索。
- 标签。
- 回收站。
- 导入导出。
- 与高级功能无关的首选项。
- 本地安全和访问控制。

## 授权状态

客户端应该把 Free 视为默认可用状态，而不是一种已经激活的授权。

```ts
interface LicenseState {
  plan: LicensePlan;
  activated: boolean;
  valid: boolean;
  status: LicenseStatus;
  source: 'default' | 'license-api';
  expiresAt: string | null;
  graceExpiresAt: string | null;
  maxDevices: number | null;
  activatedDevices: number;
  currentDeviceId: string | null;
  devices: LicenseDevice[];
  lastValidatedAt: number | null;
  lastHeartbeatAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

interface LicenseDevice {
  id: string;
  fingerprint: string;
  name: string;
  platform: string | null;
  status: 'active' | 'inactive' | 'revoked' | string;
  activatedAt: string | null;
  lastSeenAt: string | null;
  current: boolean;
}

type LicenseStatus =
  | 'free'
  | 'active'
  | 'expired'
  | 'invalid'
  | 'offline_grace'
  | 'session_grace'
  | 'max_devices_reached'
  | 'network_error';
```

默认状态：

```ts
const DEFAULT_LICENSE_STATE: LicenseState = {
  plan: 'free',
  activated: false,
  valid: true,
  status: 'free',
  source: 'default',
  expiresAt: null,
  graceExpiresAt: null,
  maxDevices: null,
  activatedDevices: 0,
  currentDeviceId: null,
  devices: [],
  lastValidatedAt: null,
  lastHeartbeatAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
};
```

## 激活规则

激活只针对 `Insider` 和 `Pro`。

```text
用户输入激活码
-> Main 进程调用 POST /v1/license/activate
-> 服务端绑定当前设备指纹
-> 服务端返回 token、授权类型、过期时间、宽限期、设备上限、已绑定设备列表
-> Main 进程本地加密持久化授权状态
-> Renderer 收到最新授权状态
-> 高级功能变为可用
```

激活接口必须返回授权类型：

```json
{
  "valid": true,
  "type": "pro",
  "token": "JWT_TOKEN",
  "expires_at": "2027-05-22T00:00:00.000Z",
  "grace_expires_at": "2027-06-05T00:00:00.000Z",
  "max_devices": 3,
  "current_device_id": "dev_123",
  "devices": [
    {
      "id": "dev_123",
      "fingerprint": "CURRENT_DEVICE_HASH",
      "name": "Jet Windows PC",
      "platform": "win32",
      "status": "active",
      "activated_at": "2026-05-22T10:00:00.000Z",
      "last_seen_at": "2026-05-22T10:00:00.000Z"
    }
  ]
}
```

如果接口返回有效 token，但没有返回可识别的 `type`，客户端应拒绝本次激活结果。客户端不应自行猜测授权属于 Insider 还是 Pro。

## 校验规则

启动时，如果本地存在已激活许可证，则进行远端校验。

```text
应用启动
-> licenseService.initialize()
-> 读取本地授权文件
-> 如果没有 token：使用 Free 默认状态
-> 如果存在 token：POST /v1/license/validate
-> 如果校验成功：使用服务端返回的授权类型、设备额度和设备列表，并启动 heartbeat
-> 如果授权无效且不在宽限期：回落到 Free，并禁用高级功能
-> 如果网络失败且本地 expiresAt 或 graceExpiresAt 仍有效：进入 offline_grace
-> 如果服务端确认授权过期但仍在宽限期：进入 session_grace
```

校验接口也必须返回授权类型、宽限期和设备绑定状态：

```json
{
  "valid": true,
  "type": "insider",
  "expires_at": "2027-05-22T00:00:00.000Z",
  "grace_expires_at": "2027-06-05T00:00:00.000Z",
  "max_devices": 3,
  "current_device_id": "dev_123",
  "devices": []
}
```

`grace_expires_at` 由服务端决定。客户端不自行计算授权宽限期。

## 设备绑定管理

授权页面需要显示当前激活码已经绑定的全部设备，并提供解绑功能。

### 服务端数据

客户端需要从激活、校验或单独设备列表接口获得：

```ts
interface LicenseDevicePayload {
  id: string;
  fingerprint: string;
  name: string;
  platform?: string | null;
  status?: string | null;
  activated_at?: string | null;
  last_seen_at?: string | null;
}
```

服务端应返回：

- `max_devices`：该激活码最多允许绑定的设备数量。
- `current_device_id`：当前设备在服务端的设备记录 ID。
- `devices`：当前激活码已绑定设备列表。

客户端根据 `current_device_id` 标记当前设备：

```ts
current: device.id === currentDeviceId
```

客户端应只把 `status = active` 的设备计入 `activatedDevices`。如果服务端返回非 active 设备，默认过滤掉，避免用户把历史设备误认为仍占用额度。

### 授权页面展示

授权页面需要展示：

- 已绑定设备数：`activatedDevices / maxDevices`。
- 当前设备名称和标识。
- 全部已绑定设备列表。
- 每台设备的名称、平台、激活时间、最近在线时间。
- 每台设备的状态。
- 当前设备标记。
- 非当前设备的解绑按钮。

当前设备也可以提供解绑按钮，但必须二次确认，并说明解绑后当前应用会回落到 Free。

### 解绑规则

建议接口：

```text
POST /v1/license/deactivate-device
```

请求：

```json
{
  "token": "STORED_JWT_TOKEN",
  "device_id": "dev_456"
}
```

响应：

```json
{
  "valid": true,
  "max_devices": 3,
  "current_device_id": "dev_123",
  "devices": []
}
```

客户端行为：

- 解绑非当前设备：服务端将该设备状态改为 inactive / revoked，客户端刷新设备列表，不影响当前授权状态。
- 解绑当前设备：服务端解除当前设备绑定后，客户端清除本地 token 和授权状态，回落到 Free。
- 如果解绑失败，保留现有状态并展示错误。
- 如果服务端返回 `license_invalid` 或 `license_expired`，按授权失效处理。
- 解绑操作必须由服务端写入 `license_events`，客户端只展示结果。

### 设备刷新

授权页面打开时应刷新设备列表。

建议接口：

```text
POST /v1/license/devices
```

请求：

```json
{
  "token": "STORED_JWT_TOKEN",
  "device_fingerprint": "CURRENT_DEVICE_HASH"
}
```

如果服务端不提供单独设备列表接口，也可以在 `validate` 返回中包含 `devices`，授权页面打开时调用 `validate` 来刷新设备列表。

## 心跳

心跳只针对已激活的 Insider 和 Pro。

```text
当前为 active / offline_grace / session_grace Insider 或 Pro
-> 每 1 小时
-> POST /v1/license/heartbeat
-> 成功后更新 lastHeartbeatAt
-> 如果响应包含 devices，则同步设备列表
-> 短暂网络失败时保持当前状态
```

心跳失败不应立即降级用户。授权降级应由校验失败、授权过期且宽限期结束触发。

## 离线和宽限期

Free 不需要联网。

已激活的 Insider / Pro：

- 如果校验因为网络不可用失败，并且本地 `expiresAt` 或 `graceExpiresAt` 仍有效，则进入 `offline_grace`。
- `offline_grace` 期间高级功能仍然可用。
- 如果服务端返回授权已过期，但仍在服务端宽限期内，则进入 `session_grace`。
- `session_grace` 期间高级功能在当前会话内继续可用。
- 一旦本地 `graceExpiresAt` 已过期，或下次启动后服务端确认不再允许宽限，则回落到 Free，并禁用高级功能。
- 离线状态下不能执行设备解绑，因为解绑必须由服务端完成。

宽限期以服务端返回的 `grace_expires_at` 为准。客户端不硬编码宽限天数。

授权过期后的云同步策略：

- 如果应用启动时仍处于有效授权或服务端宽限期内，当前会话允许继续使用云同步。
- 如果会话中途发现授权过期，不立即中断当前会话中的功能。
- 正在执行的同步任务允许完成。
- 下次启动时重新校验授权；如果服务端不再允许宽限，则禁用云同步。
- Free 状态下不能启动新的云同步任务。

## 设备指纹

设备指纹在 Main 进程生成，不暴露给 Renderer。

MVP 推荐：

```text
userData/license-device.json 保存一个随机安装 UUID
device_fingerprint = sha256(appName + platform + installationUuid)
```

理由：

- 普通重启后稳定。
- 不采集硬件序列号，隐私风险低。
- Node crypto 即可实现。
- Renderer 不接触指纹生成逻辑。

代价：

- 用户清空应用数据后会被识别为新设备。MVP 阶段可以接受，除非服务端强制要求硬件级绑定。

## 本地持久化

授权状态独立于普通首选项存储：

```text
app.getPath('userData')/license.json
app.getPath('userData')/license-device.json
```

本地授权文件结构：

```ts
interface PersistedLicenseState {
  version: number;
  encryptedToken: string | null;
  plan: 'insider' | 'pro' | null;
  expiresAt: string | null;
  graceExpiresAt: string | null;
  maxDevices: number | null;
  currentDeviceId: string | null;
  devices: LicenseDevice[];
  activatedAt: number | null;
  lastValidatedAt: number | null;
  lastHeartbeatAt: number | null;
}
```

token 存储策略：

- 优先使用 Electron `safeStorage` 加密。
- 如果 `safeStorage` 不可用，则降级为明文存储，并记录 warning 日志。
- token 永远不暴露给 Renderer。

设备列表可以持久化，用于离线展示最近一次校验结果。离线状态下应明确标记“设备列表可能不是最新”。

## 架构落点

Main 进程拥有授权权威。

```text
License API
-> electron/main/services/license.service.ts
-> electron/main/ipc/modules/license.ts
-> electron/preload/src/initPreloadCore.ts
-> src/renderer/core/bridge/electronApi.ts
-> src/renderer/features/license
```

Renderer 不直接请求 License API，也不持有 JWT token。

Main 侧文件：

```text
electron/shared/license.constants.ts
electron/main/services/license.service.ts
electron/main/ipc/modules/license.ts
electron/main/constants/ipc.constants.ts
electron/main/ipc/index.ts
electron/preload/src/initPreloadCore.ts
```

Renderer 侧文件：

```text
src/renderer/core/bridge/electronApi.ts
src/renderer/electron.d.ts
src/renderer/features/license/components/LicenseDialog.vue
src/renderer/features/license/components/LicenseActivationView.vue
src/renderer/features/license/components/LicenseManagementView.vue
src/renderer/features/license/components/LicenseBadge.vue
src/renderer/features/license/components/LicenseDeviceList.vue
src/renderer/features/license/components/LicenseGateNotice.vue
src/renderer/features/license/composables/useLicenseDialog.ts
src/renderer/features/license/composables/useLicenseGate.ts
src/renderer/features/license/services/license.service.ts
src/renderer/features/license/store/license.store.ts
src/renderer/features/license/index.ts
```

## 菜单栏授权标识

建议在顶部自绘菜单栏中加入一个轻量授权标识，用于显示当前版本：

```text
File  View  Window  Help                         Free
File  View  Window  Help                         Pro
File  View  Window  Help                         Insider
```

落点：

```text
src/renderer/app/components/AppWindowFrame.vue
src/renderer/app/components/AppMenuBar.vue
src/renderer/features/license/components/LicenseBadge.vue
```

推荐实现：

- 新增 `LicenseBadge.vue`。
- `LicenseBadge` 从 `license.store.ts` 读取当前授权状态。
- 在 `AppWindowFrame.vue` 的菜单区域或搜索区域附近展示。
- 点击 `LicenseBadge` 打开独立授权弹窗。
- 如果当前是 Free，弹出激活页面。
- 如果当前是 Insider 或 Pro，弹出授权管理页面。

显示规则：

```text
Free：显示 Free，普通灰色标签。
Pro：显示 Pro，使用强调色标签。
Insider：显示 Insider，使用测试版标签样式。
offline_grace：显示 Pro / Insider，并附加离线校验提示。
session_grace：显示 Pro / Insider，并附加宽限期提示。
expired / invalid：显示 Free 或 Expired，点击进入激活页。
```

该标识不应该占用过多空间，也不应该影响窗口拖拽区域。组件根节点需要设置：

```css
-webkit-app-region: no-drag;
```

## 激活入口

激活入口建议同时放在两个地方：

1. 菜单栏授权标识。
2. 帮助菜单。

帮助菜单新增：

```text
Help
-> Activate License / 激活许可证
```

配置落点：

```text
electron/shared/menu.config.ts
src/renderer/app/components/AppMenuBar.vue
electron/assets/locales/*.json
```

建议新增菜单 action：

```ts
type MenuAction =
  | 'activateLicense'
  | ...
```

在自绘菜单栏中，`activateLicense` 打开 Renderer 的激活页面。原生菜单也可以通过 Main 向 Renderer 发送事件：

```text
MENU_OPEN_LICENSE: 'menu:open-license'
```

这样行为与当前帮助菜单里的关于、检查更新保持一致。

入口行为：

```text
点击菜单栏 Free / Pro / Insider 标识
-> 打开 LicenseDialog
-> Free：显示 LicenseActivationView
-> Insider / Pro：显示 LicenseManagementView

点击 Help -> Activate License / 激活许可证
-> 打开 LicenseDialog
-> Free：显示 LicenseActivationView
-> Insider / Pro：显示 LicenseManagementView
```

菜单栏标识和帮助菜单必须使用同一套打开逻辑，避免一个入口打开激活页、另一个入口打开设置页造成行为不一致。

## 激活和授权管理页面

建议做成独立弹窗页面，而不是首选项中的页签。

容器文件：

```text
src/renderer/features/license/components/LicenseDialog.vue
```

`LicenseDialog` 只负责弹窗壳、关闭行为和根据授权状态切换视图。

```text
LicenseDialog
-> LicenseActivationView   // Free / 未激活 / 授权失效后重新激活
-> LicenseManagementView   // Insider / Pro 已激活管理
```

### 待激活页面

文件：

```text
src/renderer/features/license/components/LicenseActivationView.vue
```

显示场景：

- 当前是 Free。
- 授权失效后回落到 Free。
- 用户主动清除授权后。

页面内容：

- 当前版本：Free。
- 高级功能说明：AI 服务、智能写作、知识库、云同步需要 Insider 或 Pro。
- 激活码输入框。
- 激活按钮。
- 升级到 Pro 入口。
- 激活失败错误提示。

激活成功后：

```text
activate()
-> 更新 license.store
-> LicenseDialog 自动切换到 LicenseManagementView
```

### 已激活管理页面

文件：

```text
src/renderer/features/license/components/LicenseManagementView.vue
```

显示场景：

- 当前是 Insider。
- 当前是 Pro。
- 当前处于 `offline_grace` 或 `session_grace`，但本地仍保留已激活计划。

页面内容：

- 当前版本：Insider / Pro。
- 当前状态：已激活、离线验证中、宽限期内、已过期。
- 到期时间。
- 宽限期到期时间。
- 最大设备数。
- 已绑定设备数。
- 最近校验时间。
- 重新验证按钮。
- 清除本机授权按钮。
- 已绑定设备列表。
- 解绑设备按钮。

设备列表展示：

```text
设备名称          状态      平台       激活时间        最近在线        操作
Jet Windows PC   active    win32      2026-05-22      刚刚            当前设备
MacBook Pro      active    darwin     2026-05-20      1 天前          解绑
```

当用户从帮助菜单或授权标识进入时：

```text
openLicenseDialog()
```

实现落点：

```text
src/renderer/features/license/composables/useLicenseDialog.ts
src/renderer/features/license/store/license.store.ts
```

MVP 不再新增 `LicenseSettings.vue`。授权管理不放在首选项里，避免用户在设置树里寻找激活入口。

## IPC 合约

新增通道：

```ts
LICENSE_GET_STATE: 'license:get-state'
LICENSE_ACTIVATE: 'license:activate'
LICENSE_VALIDATE: 'license:validate'
LICENSE_REFRESH_DEVICES: 'license:refresh-devices'
LICENSE_DEACTIVATE_DEVICE: 'license:deactivate-device'
LICENSE_CLEAR: 'license:clear'
LICENSE_STATE_CHANGED: 'license:state-changed'
MENU_OPEN_LICENSE: 'menu:open-license'
```

Renderer API：

```ts
window.electronAPI.license = {
  getState: () => Promise<LicenseState>,
  activate: (licenseKey: string) => Promise<LicenseState>,
  validate: () => Promise<LicenseState>,
  refreshDevices: () => Promise<LicenseState>,
  deactivateDevice: (deviceId: string) => Promise<LicenseState>,
  clear: () => Promise<LicenseState>,
  onStateChanged: (callback: (state: LicenseState) => void) => () => void,
};
```

菜单 API：

```ts
window.electronAPI.menu.onOpenLicense(callback)
```

Renderer 侧接收 `onOpenLicense` 后调用：

```ts
openLicenseDialog()
```

输入校验：

- `licenseKey` 必须是非空字符串。
- `deviceId` 必须是非空字符串。
- Main service 负责 trim、统一大小写和格式化。
- Renderer 不允许透传任意 API payload。

## 功能禁用策略

功能禁用需要做两层。

### UI 层

设置页和功能入口根据授权状态禁用控件：

```ts
licenseStore.canUse('sync')
licenseStore.canUse('rag')
licenseStore.canUse('aiSources')
licenseStore.canUse('aiAssistant')
```

需要处理的 UI：

```text
src/renderer/features/settings/components/tabs/AISourceSettings.vue
src/renderer/features/settings/components/tabs/AIAssistantSettings.vue
src/renderer/features/settings/components/tabs/RAGSettings.vue
src/renderer/features/settings/components/tabs/SyncSettings.vue
src/renderer/features/settings/components/tabs/sync/SyncDashboard.vue
src/renderer/features/ai/*
src/renderer/features/rag/*
src/renderer/features/sync/*
```

UI 行为：

- 禁用输入框、开关、运行按钮。
- Free 用户访问高级功能时展示升级提示：该功能需要 Insider 或 Pro。
- 提供“激活许可证”或“升级到 Pro”入口。
- 用户从 Insider / Pro 回落到 Free 时，不删除已经配置的高级设置，只禁用使用。

### 运行时层

服务调用前也要检查授权，避免通过快捷键、生命周期任务、保存触发绕过 UI：

```text
AI assistant request
RAG initialization / indexing / query
Manual sync
Auto sync on save
Scheduled sync
AI source connection tests
```

## 错误映射

```text
403 license_invalid -> invalid
403 license_expired -> expired
403 license_inactive -> invalid
409 max_devices_reached -> max_devices_reached
404 device_not_found -> 设备不存在或已解绑
409 cannot_deactivate_current_device -> 当前设备解绑需要走本地清除授权流程
network timeout -> network_error 或 offline_grace
expired but inside server grace -> session_grace 或 offline_grace
unknown response -> invalid
```

Renderer 显示 i18n 文案。Main 记录详细日志，但必须脱敏 token 和激活码。

## 启动集成

在 `electron/main/index.ts` 中：

```text
settingsService.loadConfig()
accessControlService.initialize()
licenseService.initialize()
registerIpcHandlers(mainWindow)
```

授权初始化不应该长时间阻塞窗口创建。建议使用短超时校验，并通过 `LICENSE_STATE_CHANGED` 通知 Renderer 最新状态。

## 实现阶段

### 第一阶段：授权核心

- 新增 shared 授权常量和类型。
- 新增 Main `license.service.ts`。
- 新增 license IPC module。
- 新增 preload 和 renderer bridge API。
- 新增 renderer `license.store.ts`。
- 新增独立授权弹窗，支持激活、校验和清除授权。

### 第二阶段：入口和标识

- 在帮助菜单新增“激活许可证”。
- 在菜单栏加入 `LicenseBadge`。
- 点击授权标识打开独立授权弹窗。
- Free 状态显示待激活页面。
- Insider / Pro 状态显示授权管理页面。
- 帮助菜单入口与菜单栏标识使用同一套打开逻辑。
- 接入 `MENU_OPEN_LICENSE`。

### 第三阶段：设备管理

- 在授权管理页面展示 `activatedDevices / maxDevices`。
- 展示全部已绑定设备列表。
- 标记当前设备。
- 支持解绑非当前设备。
- 解绑当前设备时清除本地授权并回落到 Free。

### 第四阶段：功能门禁

- 新增 `licenseStore.canUse(feature)`。
- 禁用 AI 服务设置。
- 禁用智能写作设置和运行时请求。
- 禁用 RAG 设置、初始化、索引和问答。
- 禁用云同步设置、手动同步、保存后同步和定时同步。
- Free 用户在这些位置看到升级提示。

### 第五阶段：启动与心跳

- 应用启动时初始化 license service。
- 校验本地已激活许可证。
- 对 active / offline_grace / session_grace Insider 或 Pro 启动 heartbeat。
- 向 Renderer 推送授权状态变化。

### 第六阶段：安全和测试

- 使用 `safeStorage` 加密 token。
- 增加 API 超时和重试策略。
- 补充 i18n 文案。
- 测试 plan 解析、feature gate、IPC payload 校验。
- 测试激活、校验、清除授权、离线回退、会话宽限。
- 测试设备列表刷新和设备解绑。

## 已确认决策

- 生产 License API base URL：`https://api.snaptium.com/`。
- Insider 完全由服务端控制有效状态和过期时间。
- Pro 暂时是买断制，但客户端仍需要定期验证授权状态。
- Free 用户访问高级功能时显示升级提示。
- 授权过期后，高级功能允许当前会话继续使用；云同步不立即中断，当前会话结束后再按服务端校验结果决定是否停用。
- 授权宽限期由服务端接口返回，客户端不硬编码宽限天数。
- License API 会返回激活码允许绑定的设备数量。
- 授权管理页面需要显示全部已绑定设备，并提供解绑功能。
