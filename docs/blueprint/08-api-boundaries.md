# DingClaw 核心接口边界

## 设计目标

把系统拆成可独立演进的服务边界，而不是一个巨大后端。

本文件定义的是：

- 谁对外提供 API
- 谁只做内部调用
- 哪些 API 是首期必须落地

## 服务边界

### 1. Admin API

服务对象：

- 中文管理后台

职责：

- 页面配置读取
- 管理动作提交
- 组织、策略、agent、模型、审批、审计的 CRUD

### 2. Runtime Control API

服务对象：

- OpenClaw Gateway
- 执行平面组件

职责：

- 下发 agent 配置
- 查询运行时状态
- 接收结构化事件

### 3. Identity API

服务对象：

- DingTalk Connector
- Policy Engine
- Admin API

职责：

- 解析和查询统一身份
- 维护用户、部门、角色、映射关系

### 4. Policy API

服务对象：

- DingTalk Connector
- OpenClaw runtime hook
- Admin API

职责：

- 输入上下文，输出决策结果

### 5. Approval API

服务对象：

- Tool runtime
- Admin API
- 审批执行器

职责：

- 创建审批
- 查询审批
- 批准/驳回
- 执行恢复

### 6. Audit API

服务对象：

- 所有服务

职责：

- 写入审计事件
- 查询和导出审计

### 7. Connector Webhook API

服务对象：

- 钉钉

职责：

- 接收消息
- 接收卡片回调
- 接收审批或事件回调

## API 风格建议

- 管理后台 API：REST
- 服务内决策 API：REST 或 RPC
- 审计写入：异步事件优先
- 高吞吐日志：批量写入
- 结构化返回统一带 `traceId`

## 首期 REST 资源

### A. 组织与身份

#### `GET /api/admin/users`

能力：

- 分页查询员工

筛选：

- `keyword`
- `departmentId`
- `roleKey`
- `status`

#### `GET /api/admin/users/:id`

能力：

- 查看用户详情
- 查看渠道身份映射

#### `POST /api/admin/users/:id/roles`

能力：

- 分配角色

#### `GET /api/admin/groups`

能力：

- 查询群组

#### `POST /api/admin/identity-links`

能力：

- 新建渠道身份与 subject 的映射

### B. 智能体

#### `GET /api/admin/agents`

#### `POST /api/admin/agents`

#### `GET /api/admin/agents/:id`

#### `PATCH /api/admin/agents/:id`

#### `POST /api/admin/agents/:id/test`

能力：

- 用指定身份和场景模拟 agent 响应

#### `POST /api/admin/agent-bindings`

能力：

- 创建路由规则

### C. 模型与中转

#### `GET /api/admin/model-providers`

#### `POST /api/admin/model-providers`

#### `GET /api/admin/model-routes`

#### `POST /api/admin/model-routes`

#### `POST /api/admin/model-routes/:id/test`

能力：

- 测试模型连通性和返回

### D. 策略

#### `GET /api/admin/policy-sets`

#### `POST /api/admin/policy-sets`

#### `GET /api/admin/policy-rules`

#### `POST /api/admin/policy-rules`

#### `POST /api/admin/policy-rules/evaluate`

能力：

- 输入模拟上下文，输出策略结果

### E. 审批

#### `GET /api/admin/approvals`

#### `GET /api/admin/approvals/:id`

#### `POST /api/admin/approvals/:id/approve`

#### `POST /api/admin/approvals/:id/reject`

#### `POST /api/admin/approvals/:id/replay`

能力：

- 审批后恢复执行

### F. 审计

#### `GET /api/admin/audit-events`

#### `GET /api/admin/audit-events/:id`

#### `POST /api/admin/audit-events/export`

### G. 渠道接入

#### `GET /api/admin/connectors/dingtalk/accounts`

#### `POST /api/admin/connectors/dingtalk/accounts`

#### `POST /api/admin/connectors/dingtalk/accounts/:id/test`

#### `GET /api/admin/connectors/dingtalk/groups`

### H. 节点与运行时

#### `GET /api/admin/runtime/nodes`

#### `GET /api/admin/runtime/browser-workers`

#### `GET /api/admin/runtime/health`

## 内部决策接口

### `POST /internal/identity/resolve-subject`

输入：

- `channel`
- `accountId`
- `sender`
- `conversation`

输出：

- `subject`
- `claims`
- `mappingStatus`

### `POST /internal/policy/evaluate`

输入：

- `subjectClaims`
- `intent`
- `agentContext`
- `toolRequest`

输出：

- `allow`
- `agentRoute`
- `personaProfile`
- `toolPolicy`
- `approvalRequirement`

### `POST /internal/approvals/create`

输入：

- `subject`
- `toolKey`
- `riskLevel`
- `context`

输出：

- `approvalRequestId`
- `status`

### `POST /internal/audit/events`

输入：

- `eventType`
- `traceId`
- `payload`

输出：

- `accepted`

## 钉钉回调接口

### `POST /webhooks/dingtalk/messages`

职责：

- 接收消息
- 验签
- 转成统一消息对象

### `POST /webhooks/dingtalk/cards/actions`

职责：

- 接收卡片按钮动作
- 恢复审批或执行

### `POST /webhooks/dingtalk/oa/events`

职责：

- 审批状态同步
- 流程结果回写

## OpenClaw Runtime 扩展接口

首期建议增加几个稳定扩展点：

- `resolveSubjectClaims(context)`
- `evaluatePolicy(runContext)`
- `requestApproval(actionContext)`
- `emitAuditEvent(event)`

这些可以通过企业 patch 或 runtime hook 注入，不建议把业务逻辑直接写进 OpenClaw 主流程。

## 响应格式建议

统一返回结构：

```json
{
  "ok": true,
  "data": {},
  "traceId": "trace_xxx"
}
```

错误结构：

```json
{
  "ok": false,
  "error": {
    "code": "POLICY_DENY",
    "message": "当前身份无权执行该动作"
  },
  "traceId": "trace_xxx"
}
```

## 首期最小可用接口集

如果要快速进入实现，最少先做这些：

- 用户查询
- 群组查询
- Agent 列表/详情
- 模型供应商配置
- 策略评估
- 审批创建/通过/驳回
- 审计事件查询
- 钉钉消息回调

## 不建议首期做的 API

- 通用低代码流程编排 API
- 对外开放的第三方集成市场 API
- 复杂 GraphQL 聚合层
- 大而全的工作流 DSL
