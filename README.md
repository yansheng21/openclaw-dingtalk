# DingClaw

`DingClaw` 是一个面向企业场景的 OpenClaw 增强版，目标是把 AI 助手真正接入钉钉工作流，而不是只做一个能聊天的机器人。

当前仓库基于 OpenClaw 上游源码初始化，后续重点补齐这些能力：

- 钉钉企业机器人接入
- 群聊 `@机器人` 触发与会话路由
- 企业身份识别、租户隔离、权限策略
- OA 审批 / 内部 API / 浏览器自动化工具接入
- 中文化管理控制台
- 中转 API 配置能力（自定义 `baseURL`、`apiKey`、模型与推理强度）
- 审计、审批、工具调用留痕

## 仓库定位

这个仓库不是重新发明一个助手内核，而是在尽量少改 OpenClaw 核心的前提下，构建一套可持续演进的企业层。

约束原则：

- `upstream` 保持指向官方 OpenClaw，便于后续持续合并升级
- 企业能力优先放在 `apps/`、`packages/`、`extensions/`
- 对 OpenClaw 核心的改动尽量收敛，并记录在 `patches/openclaw-core/`

## 目录结构

```text
apps/
  admin-console/         中文管理控制台
  control-api/           控制面 API
  runtime-api/           运行时桥接 API
  jobs/                  异步任务与同步作业

packages/
  shared-types/          共享类型
  shared-config/         配置装载与校验
  database/              数据库访问层
  identity-service/      用户身份映射与画像
  policy-engine/         权限策略引擎
  approval-service/      审批编排
  audit-service/         审计留痕
  runtime-bridge/        与 OpenClaw Runtime 的桥接
  model-registry/        模型与中转 API 注册表

extensions/
  dingtalk-enterprise/   钉钉企业扩展
  oa-tools/              OA / 审批相关工具
  internal-api-tools/    企业内部 API 工具

docs/
  architecture/          仓库内架构说明
  blueprint/             产品级蓝图与实施方案
```

## 已有蓝图

首批产品与技术蓝图已经放入仓库：

- `docs/blueprint/01-product-overview.md`
- `docs/blueprint/02-system-architecture.md`
- `docs/blueprint/03-identity-and-policy.md`
- `docs/blueprint/04-data-model.md`
- `docs/blueprint/05-repo-and-deployment.md`
- `docs/blueprint/06-roadmap.md`
- `docs/blueprint/07-admin-console-ia.md`
- `docs/blueprint/08-api-boundaries.md`
- `docs/blueprint/09-database-erd.md`
- `docs/blueprint/10-repo-skeleton.md`
- `docs/blueprint/11-package-boundaries.md`
- `docs/blueprint/12-mvp-build-slices.md`
- `docs/blueprint/13-risk-register.md`

建议先从这三份开始：

- `docs/blueprint/01-product-overview.md`
- `docs/blueprint/02-system-architecture.md`
- `docs/blueprint/12-mvp-build-slices.md`

## 初始化

推荐环境：

- Node `24.x`
- `pnpm`

安装依赖：

```bash
pnpm install
```

后续执行顺序建议：

1. 先完成工作区依赖安装与构建校验
2. 再落第一批企业基础包：`shared-config`、`database`、`identity-service`
3. 然后补 `dingtalk-enterprise` 接入与 `admin-console`
4. 最后接 OA、审批、浏览器能力和审计闭环

## 远端策略

- `upstream`: `https://github.com/openclaw/openclaw.git`
- `origin`: 你的 DingClaw 私有 / 自有仓库

## 说明

本仓库当前仍处于企业化初始化阶段，已经具备：

- 上游基线代码
- 企业目录骨架
- 产品级蓝图文档

接下来的工作重点是把蓝图逐步变成可运行的控制面、运行时和钉钉扩展。
