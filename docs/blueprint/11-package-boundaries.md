# DingClaw 包边界与依赖规则

## 目标

避免 monorepo 做到后面变成一个“大号同目录工程”。

边界必须清楚：

- 谁定义数据
- 谁负责业务规则
- 谁可以访问数据库
- 谁可以调用 OpenClaw runtime

## 依赖总原则

### 1. 单向依赖

依赖方向必须尽量单向：

`apps -> packages -> shared`

`extensions -> runtime adapter -> internal service client`

### 2. 插件不直连数据库

OpenClaw 插件不要直接读写业务数据库。  
插件通过内部 API 或 service client 获取身份、策略、审批结果。

### 3. UI 不直接写业务逻辑

后台页面不包含业务判断，所有规则由服务层控制。

### 4. Patch 不写业务

OpenClaw core patch 只提供扩展点，不写 OA、组织、审批具体逻辑。

## 包边界定义

### `shared-types`

职责：

- 最底层共享类型

允许依赖：

- 无业务包依赖

禁止：

- 访问数据库
- 访问网络
- 引用 OpenClaw runtime

### `shared-config`

职责：

- 环境变量 schema
- 配置装载

允许依赖：

- `shared-types`

### `database`

职责：

- schema
- migrations
- db client

允许依赖：

- `shared-types`
- `shared-config`

禁止：

- 业务决策
- OpenClaw runtime

### `identity-service`

职责：

- 统一身份解析
- 组织同步
- 身份映射

允许依赖：

- `database`
- `shared-types`
- `shared-config`

输出：

- `resolveSubject`
- `syncOrgUsers`
- `linkChannelIdentity`

### `policy-engine`

职责：

- 根据 claims 和上下文做策略决策

允许依赖：

- `database`
- `identity-service`
- `shared-types`

输出：

- `evaluateRoute`
- `evaluateToolPolicy`
- `evaluateApprovalNeed`
- `buildPersonaProfile`

### `approval-service`

职责：

- 审批单生命周期

允许依赖：

- `database`
- `shared-types`

输出：

- `createApprovalRequest`
- `approveRequest`
- `rejectRequest`
- `resumeExecution`

### `audit-service`

职责：

- 统一审计事件写入与检索

允许依赖：

- `database`
- `shared-types`

输出：

- `emitAuditEvent`
- `queryAuditEvents`
- `exportAuditEvents`

### `model-registry`

职责：

- 管理模型供应商和路由

允许依赖：

- `database`
- `shared-types`

### `dingtalk-enterprise`

职责：

- OpenClaw 钉钉插件

允许依赖：

- `shared-types`
- `shared-config`
- 内部 service client
- OpenClaw plugin sdk

禁止：

- 直接依赖 `database`
- 直接引用后台层实现

### `oa-tools`

职责：

- OA 与审批相关工具封装

允许依赖：

- `shared-types`
- `shared-config`
- 内部 API client

### `internal-api-tools`

职责：

- 内部系统 API 工具

允许依赖：

- `shared-types`
- service client

## App 边界

### `admin-console`

只负责：

- 展示
- 表单提交
- 权限感知 UI

不负责：

- 最终策略判断
- 数据写入规则
- 审批业务逻辑

### `control-api`

负责：

- 管理面 API
- 聚合内部服务

### `runtime-api`

负责：

- 给 OpenClaw runtime 提供企业能力接入面

## OpenClaw 扩展边界

建议定义一个专门适配层，例如：

- `packages/runtime-bridge`

职责：

- 把 OpenClaw runtime 上下文转成企业统一上下文
- 调用 Identity / Policy / Approval / Audit
- 返回 runtime 可消费的结果

这样可以避免企业服务直接理解 OpenClaw 内部细节。

## 推荐内部契约

### `resolveSubjectClaims(input)`

输入：

- channel
- accountId
- sender
- conversation

输出：

- subject
- claims

### `evaluatePolicy(input)`

输入：

- claims
- intent
- sessionContext
- candidateTool

输出：

- route
- persona
- allow
- approvalRequired

### `requestApproval(input)`

输入：

- tool request
- claims
- risk

输出：

- approvalRequestId
- status

### `emitAuditEvent(input)`

输入：

- event
- traceId
- actor
- payload

## 依赖矩阵

```text
admin-console -> control-api client -> shared-types
control-api -> identity-service / policy-engine / approval-service / audit-service / model-registry
runtime-api -> runtime-bridge -> identity-service / policy-engine / approval-service / audit-service
dingtalk-enterprise -> runtime-bridge client + OpenClaw SDK
oa-tools -> internal-api client + shared-types
identity-service -> database
policy-engine -> database + identity-service
approval-service -> database
audit-service -> database
```

## 禁止事项

- `extensions/*` 直接 import `database`
- `admin-console` 直接引用数据库 client
- `patches/openclaw-core` 直接 import 业务服务实现
- `policy-engine` 直接发送钉钉消息
- `approval-service` 直接执行工具动作

## 首期最关键的边界

最先必须守住这 4 条：

1. 钉钉插件不直连数据库
2. 策略与身份独立
3. 审批与执行独立
4. OpenClaw patch 只做桥接，不做业务
