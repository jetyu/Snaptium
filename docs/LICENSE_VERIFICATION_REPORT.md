# License Verification API Guide

最后更新：2026-05-23

本文件描述客户端与 License API 的校验相关接口契约（含激活、校验、心跳、设备列表、设备解绑）。

## 1. 基本信息

- Base URL（生产）：`https://api.snaptium.com/v1`
- Content-Type：`application/json`
- 鉴权方式：
  - `activate` 无需 token
  - `validate` / `heartbeat` / `devices` / `deactivate-device` 必须使用 `Authorization: Bearer <token>`

## 2. 数据结构

### 2.1 Device

```json
{
  "id": "dev_123",
  "fingerprint": "sha256_fingerprint_hash",
  "name": "Jet Windows PC",
  "platform": null,
  "status": "active",
  "activated_at": "2026-05-22T10:00:00.000Z",
  "last_seen_at": "2026-05-23T09:30:00.000Z"
}
```

### 2.2 License Snapshot

```json
{
  "valid": true,
  "type": "insider",
  "expires_at": "2027-05-22T00:00:00.000Z",
  "grace_expires_at": "2027-05-25T00:00:00.000Z",
  "max_devices": 3,
  "current_device_id": "dev_123",
  "devices": []
}
```

字段说明：

- `valid`：是否在主有效期内。若在服务端宽限期内，可能返回 `false`。
- `type`：`free | insider | pro`。
- `grace_expires_at`：服务端计算后的宽限截止时间，客户端不得自行推导。
- `devices`：已绑定设备列表（当前实现返回 `active` 设备）。

## 3. 接口定义

### 3.1 激活

- Method + Path：`POST /license/activate`
- Auth：不需要

请求：

```json
{
  "license_key": "SNPI-XXXX-XXXX-XXXX-XXXX",
  "device_fingerprint": "CURRENT_DEVICE_HASH",
  "device_name": "Jet-PC",
  "platform": "win32"
}
```

成功响应（200）：

```json
{
  "valid": true,
  "type": "insider",
  "token": "JWT_TOKEN",
  "expires_at": "2027-05-22T00:00:00.000Z",
  "grace_expires_at": "2027-05-25T00:00:00.000Z",
  "max_devices": 3,
  "current_device_id": "dev_123",
  "devices": []
}
```

### 3.2 校验（启动/手动刷新）

- Method + Path：`POST /license/validate`
- Auth：`Authorization: Bearer <token>`

请求：

```json
{
  "device_fingerprint": "CURRENT_DEVICE_HASH"
}
```

成功响应（200）：返回 `License Snapshot`。

### 3.3 心跳

- Method + Path：`POST /license/heartbeat`
- Auth：`Authorization: Bearer <token>`

请求：

```json
{
  "device_fingerprint": "CURRENT_DEVICE_HASH"
}
```

成功响应（200）：返回 `License Snapshot`。

### 3.4 设备列表

- Method + Path：`POST /license/devices`
- Auth：`Authorization: Bearer <token>`

请求：

```json
{
  "device_fingerprint": "CURRENT_DEVICE_HASH"
}
```

成功响应（200）：返回 `License Snapshot`。

### 3.5 解绑设备

- Method + Path：`POST /license/deactivate-device`
- Auth：`Authorization: Bearer <token>`

请求：

```json
{
  "device_id": "dev_456"
}
```

成功响应（200）：返回 `License Snapshot`。

约束：

- 解绑当前设备会返回 `409 cannot_deactivate_current_device`。
- 客户端收到该错误后应执行本地清除授权流程（回落到 Free）。

## 4. 错误码与状态码

统一错误结构：

```json
{
  "code": "license_invalid",
  "message": "License is not active."
}
```

常见错误：

- `400 invalid_payload`：请求字段缺失或格式不正确
- `401 invalid_token`：Bearer token 缺失/无效/过期
- `401 device_mismatch`：请求指纹与 token 绑定指纹不一致
- `403 license_invalid`：授权无效、已撤销或当前设备未绑定
- `403 license_expired`：授权已过期且超出宽限期
- `409 max_devices_reached`：激活达到设备上限
- `409 cannot_deactivate_current_device`：不允许远端直接解绑当前设备
- `404 device_not_found`：解绑目标不存在或非 active
- `429 too_many_requests`：触发限流

## 5. 远端联调示例（curl）

将下列变量替换为真实值：

- `BASE=https://api.snaptium.com/v1`
- `KEY=...`
- `FP=...`
- `TOKEN=...`

### 5.1 激活

```bash
curl -X POST "$BASE/license/activate" \
  -H "content-type: application/json" \
  -d "{\"license_key\":\"$KEY\",\"device_fingerprint\":\"$FP\",\"device_name\":\"Jet-PC\",\"platform\":\"win32\"}"
```

### 5.2 校验

```bash
curl -X POST "$BASE/license/validate" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"device_fingerprint\":\"$FP\"}"
```

### 5.3 心跳

```bash
curl -X POST "$BASE/license/heartbeat" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"device_fingerprint\":\"$FP\"}"
```

### 5.4 设备列表

```bash
curl -X POST "$BASE/license/devices" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"device_fingerprint\":\"$FP\"}"
```

### 5.5 解绑设备

```bash
curl -X POST "$BASE/license/deactivate-device" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"device_id\":\"dev_456\"}"
```

## 6. 安全说明（是否会暴露服务端信息）

正常按本契约调用，不会暴露服务端实现细节；但需要遵守以下约束：

- 不在客户端日志打印 `license_key`、`token`、完整 `device_fingerprint`。
- 设备标识建议先本地 hash 后再上传（避免上传原始硬件信息）。
- 后端仅返回业务必要字段，不返回数据库主机、SQL、堆栈等内部信息。
- 出错信息保持通用（`code + message`），避免回传敏感内部上下文。

## 7. 客户端实现检查项

- `activate` 响应必须包含：`type`、`token`、`grace_expires_at`、`current_device_id`、`devices`。
- `validate`/`heartbeat` 必须走 Bearer Token，而不是 body 传 token。
- `devices` 页面只统计 `status = active` 设备。
- 遇到 `license_expired` / `license_invalid` 要触发回退流程。
