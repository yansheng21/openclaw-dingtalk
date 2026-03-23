# DingClaw 仓库与部署

## 仓库策略

不建议在本机安装目录里长期修改 `node_modules`。  
建议建立私有企业仓，并保留官方上游作为同步源。

## 推荐仓库模型

```text
openclaw-enterprise/
  apps/
    admin-console/
    api-gateway/
  packages/
    identity-service/
    policy-engine/
    approval-service/
    audit-service/
    shared-types/
    shared-config/
  extensions/
    dingtalk-enterprise/
    oa-tools/
    internal-api-tools/
  patches/
    openclaw-core/
  infra/
    docker/
    k8s/
    scripts/
  docs/
    architecture/
    runbooks/
```

## 模块说明

### `apps/admin-console`

中文管理后台。

功能：

- 组织管理
- agent 管理
- 模型中转配置
- 权限策略管理
- 审批中心
- 审计中心
- 节点与浏览器池管理

### `apps/api-gateway`

企业 API 入口。

功能：

- 后台 API
- webhook 回调
- 内部服务聚合
- 对外认证

### `packages/identity-service`

组织与身份统一服务。

### `packages/policy-engine`

策略决策引擎。

### `packages/approval-service`

高风险动作审批服务。

### `packages/audit-service`

审计事件接收、查询、导出。

### `extensions/dingtalk-enterprise`

企业版钉钉插件。

### `extensions/oa-tools`

审批和 OA 工具集。

### `patches/openclaw-core`

最小 core patch，控制在少量文件内。

## 技术栈建议

- Runtime: Node.js + TypeScript
- Admin Console: Next.js
- UI: React + 中文设计系统
- DB: PostgreSQL
- Cache: Redis
- Object Storage: S3 / MinIO
- Queue: Redis Streams 或消息队列
- Observability: Loki / ELK / ClickHouse 三选一

## 环境规划

### 开发环境

- 单机 Docker Compose
- 本地 OpenClaw Gateway
- 测试钉钉企业应用

### 测试环境

- 独立钉钉测试组织或测试应用
- 完整审批和审计链路
- 独立模型配置

### 生产环境

- 控制平面与执行平面分离
- Browser Worker 独立隔离
- Secret 独立托管
- 生产数据库单独备份和监控

## 部署拓扑

### 控制平面

- `admin-console`
- `api-gateway`
- `identity-service`
- `policy-engine`
- `approval-service`
- `audit-service`
- `postgres`
- `redis`
- `object-storage`

### 执行平面

- `openclaw-gateway`
- `agent-runner`
- `sandbox-runner`
- `browser-worker`
- `connector-worker`

## 浏览器与执行节点建议

浏览器节点和宿主机执行节点不要和控制后台混布。

建议：

- 控制后台单独部署
- Browser Worker 使用独立工作池
- 高风险执行使用专用 runner
- 普通问答和 OA API 调用与浏览器节点隔离

## Secrets 管理

必须从配置文件明文迁移出去。

建议使用：

- 环境变量 + Secret Manager
- KMS 或 Vault
- 模型 API Key、钉钉 Secret、数据库密码全部集中托管

## 模型中转设计

后台应允许录入：

- `baseUrl`
- `apiKey`
- `providerType`
- `modelId`
- `reasoningEffort`
- `timeout`
- `routingPolicy`

模型配置分两层：

- 平台级可用模型
- agent 级默认模型

## Upstream 升级策略

必须保持：

- 官方 `upstream`
- 企业私有 `main`
- patch 清单
- 每次升级都有兼容性回归清单

原则：

- 插件优先
- 外围服务优先
- core patch 最小
- 不把企业业务逻辑硬塞到 OpenClaw 核心
