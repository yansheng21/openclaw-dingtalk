# DingClaw 仓库骨架

## 目标

把蓝图转成一个可长期维护的企业 monorepo，而不是多个随意堆在一起的目录。

## 推荐仓库形式

- `pnpm workspace`
- `turbo` 做任务编排
- TypeScript 全仓统一
- `apps` 放可部署应用
- `packages` 放服务和共享库
- `extensions` 放 OpenClaw 插件和工具扩展
- `infra` 放部署与运行脚本

## 顶层目录

```text
openclaw-enterprise/
  apps/
  packages/
  extensions/
  patches/
  infra/
  docs/
  scripts/
  .changeset/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  eslint.config.js
  prettier.config.js
  .env.example
  README.md
```

## `apps/`

### `apps/admin-console`

中文管理后台。

职责：

- 后台页面
- 管理员登录态
- 配置操作界面
- 审计和审批界面

建议技术栈：

- Next.js
- React
- TypeScript
- 中文 UI 设计系统

### `apps/control-api`

控制平面主 API。

职责：

- 后台 CRUD
- 组织、agent、模型、策略、审批、审计管理 API
- 内部服务聚合

建议技术栈：

- NestJS 或 Hono + Zod
- PostgreSQL
- Redis

### `apps/runtime-api`

执行平面网关适配层。

职责：

- 对接 OpenClaw Runtime 扩展点
- 处理运行时事件
- 调用 Identity / Policy / Approval / Audit 服务

### `apps/jobs`

异步任务和定时任务。

职责：

- 身份同步
- 群组同步
- 成本统计
- 审计归档
- 失效审批清理

## `packages/`

### `packages/shared-types`

全仓共享类型。

内容：

- DTO
- 枚举
- 事件结构
- claims 类型

### `packages/shared-config`

全仓共享配置。

内容：

- 环境变量 schema
- config loader
- feature flags

### `packages/database`

数据库访问层。

内容：

- Prisma 或 Drizzle schema
- migration
- repo helpers

### `packages/identity-service`

统一身份服务。

内容：

- 用户同步
- 部门同步
- 角色映射
- 渠道身份映射

### `packages/policy-engine`

策略引擎。

内容：

- subject claims 规则
- agent 路由决策
- 工具权限决策
- 审批判定

### `packages/approval-service`

审批服务。

内容：

- 审批单创建
- 审批流计算
- 审批状态推进
- 执行恢复令牌

### `packages/audit-service`

审计服务。

内容：

- 事件写入
- 查询聚合
- 导出
- 风险标记

### `packages/model-registry`

模型与中转配置层。

内容：

- provider 配置
- route 配置
- 调用策略
- 健康检查

## `extensions/`

### `extensions/dingtalk-enterprise`

企业版钉钉插件。

职责：

- 消息接收与发送
- 回调处理
- 卡片动作
- 构建 claims 输入

### `extensions/oa-tools`

钉钉 OA / 审批工具集。

### `extensions/internal-api-tools`

内部系统 API 工具集。

### `extensions/browser-fallback-tools`

浏览器兜底工具。

只做无 API 场景，不作为首选路径。

## `patches/`

### `patches/openclaw-core`

只保存最小 core patch。

建议控制在以下能力：

- runtime hook 注入
- claims 注入
- policy hook
- approval hook
- audit hook

原则：

- 一个 patch 只做一件事
- 必须有变更说明
- 必须有 upstream 对照

## `infra/`

### `infra/docker`

- 本地 compose
- 开发环境依赖

### `infra/k8s`

- 测试环境
- 生产环境

### `infra/monitoring`

- logs
- metrics
- alerts

## `docs/`

建议分区：

- `docs/architecture`
- `docs/runbooks`
- `docs/adr`
- `docs/security`
- `docs/api`

## `scripts/`

建议集中放：

- 本地初始化
- 数据导入
- 身份同步
- Upstream 合并辅助脚本

## 根目录文件建议

### `pnpm-workspace.yaml`

统一 workspace 包定义。

### `turbo.json`

统一任务：

- `dev`
- `build`
- `lint`
- `test`
- `typecheck`

### `.env.example`

统一列出：

- DB
- Redis
- DingTalk
- OpenClaw
- Model Relay
- Storage

## 首期实际最小目录

如果第一天就开工，最小可先建：

```text
openclaw-enterprise/
  apps/
    admin-console/
    control-api/
  packages/
    shared-types/
    shared-config/
    database/
    identity-service/
    policy-engine/
    approval-service/
    audit-service/
  extensions/
    dingtalk-enterprise/
  patches/
    openclaw-core/
  docs/
    architecture/
```

## 目录使用规则

- `apps` 不直接定义业务规则，只调用 `packages`
- `packages` 之间按边界依赖，不允许乱引用
- `extensions` 不直接访问数据库，必须走服务边界
- `patches` 不放业务实现，只放 OpenClaw 集成扩展

## 版本管理建议

- OpenClaw upstream 单独远程
- 企业版本主分支单独管理
- patch 和插件变更分开提交
- 所有数据库 migration 都必须版本化
