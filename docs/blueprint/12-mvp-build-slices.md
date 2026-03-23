# DingClaw MVP 模块拆解

## 目标

把蓝图拆成可以排期和分工的实现切片。

原则：

- 每个切片可独立验收
- 每个切片尽量减少跨边界耦合
- 优先把高风险基础设施做出来

## Slice 0: 仓库初始化

目标：

- 建立 monorepo 基线

输出：

- workspace
- turbo
- lint
- typecheck
- docs 目录
- env schema

验收：

- 全仓可以执行 `pnpm lint`、`pnpm typecheck`

## Slice 1: 数据库与配置基线

目标：

- 建立第一批核心表

输出：

- `org_users`
- `org_departments`
- `org_roles`
- `channel_accounts`
- `channel_subject_links`
- `agents`
- `policy_sets`
- `approval_requests`
- `audit_events`

验收：

- migration 可执行
- 本地环境可初始化

## Slice 2: 企业版钉钉插件 MVP

目标：

- 能稳定接消息并输出统一上下文

输出：

- `dingtalk-enterprise` 插件
- 消息接收
- 消息发送
- 会话上下文
- 内部回调适配

验收：

- 私聊和群聊都能稳定收发
- 每条消息带标准化技术身份字段

## Slice 3: 统一身份解析 MVP

目标：

- 建立 subject claims

输出：

- `resolveSubjectClaims`
- staffId 到 subjectId 映射
- 部门和角色附加
- 群组元数据读取

验收：

- 任意一条消息都能得到 claims

## Slice 4: 策略引擎 MVP

目标：

- 根据身份和场景做基本决策

输出：

- agent 路由
- tool allow / deny
- approval need
- persona profile

验收：

- 同一个问题在不同角色下能得到不同 agent 或不同工具边界

## Slice 5: OpenClaw Runtime Bridge

目标：

- 把企业能力接到 OpenClaw runtime 上

输出：

- claims 注入 hook
- policy hook
- approval hook
- audit hook

验收：

- agent 收到的每个 turn 都有 claims
- 工具调用前能被策略拦截

## Slice 6: 中文后台 MVP

目标：

- 管理员可配置和观察系统

输出：

- 登录
- 工作台
- 钉钉账号管理
- 员工与群组管理
- Agent 列表与详情
- 模型中转配置
- 策略管理

验收：

- 管理员无需改配置文件即可完成关键设置

## Slice 7: 审批中心 MVP

目标：

- 高风险动作具备审批闭环

输出：

- 待审批列表
- 审批详情
- 批准/驳回
- 恢复执行

验收：

- 高风险动作不会直接执行
- 审批通过后能恢复执行

## Slice 8: 审计中心 MVP

目标：

- 关键行为可追踪

输出：

- 审计事件写入
- 审计列表
- 事件详情
- 风险筛选

验收：

- 可以通过用户、时间、工具、风险级别追查行为

## Slice 9: 模型中转与路由

目标：

- 从固定配置升级到可配置模型路由

输出：

- provider 管理
- route 管理
- agent 默认模型绑定
- 连通性测试

验收：

- 不改代码即可切换模型供应商和模型路由

## Slice 10: OA 工具 MVP

目标：

- 实现第一批正式业务工具

建议首批：

- 发起审批
- 查询审批状态
- 获取待办
- 查询流程模板

验收：

- 不依赖浏览器自动化即可完成首批 OA 流程

## Slice 11: 浏览器兜底能力

目标：

- 只在 API 缺失场景下使用浏览器

输出：

- 浏览器 worker
- 浏览器任务审批
- 截图归档
- 失败恢复

验收：

- 浏览器任务默认不可直接触发
- 有审批和证据链

## Slice 12: 上线前治理

目标：

- 形成试点可上线能力

输出：

- 监控
- 告警
- 成本报表
- runbook
- 回滚方案

验收：

- 可进行小范围部门试点

## 建议优先级

最优先顺序：

1. Slice 0
2. Slice 1
3. Slice 2
4. Slice 3
5. Slice 4
6. Slice 5
7. Slice 6
8. Slice 7
9. Slice 8
10. Slice 9
11. Slice 10
12. Slice 11
13. Slice 12

## 首批团队分工建议

### 轨道 A: 平台基础

- 仓库
- 数据库
- runtime bridge
- audit

### 轨道 B: 企业接入

- dingtalk-enterprise
- identity-service
- policy-engine

### 轨道 C: 产品后台

- admin-console
- control-api
- 审批中心

### 轨道 D: 业务工具

- oa-tools
- internal-api-tools
- browser fallback

## 首期上线边界建议

首期不要做：

- 全公司开放
- 默认高权限工具
- 宿主机执行开放给普通员工
- 大范围浏览器自动化

首期只做：

- 指定部门试点
- API 工具优先
- 审批和审计先到位
