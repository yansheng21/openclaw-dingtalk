# DingClaw 系统架构

## 总体思路

采用“双平面”设计：

- 控制平面：负责配置、身份、策略、审批、审计、运维
- 执行平面：负责 agent 运行、工具调用、浏览器、会话、消息收发

OpenClaw 主要承担执行平面内核角色。  
DingClaw 负责在其上增加企业级控制能力。

## 逻辑分层

### A. 接入层

- DingTalk Enterprise Connector
- 管理后台 Web Console
- 内部 API 网关
- 审批回调入口

### B. 控制平面

- Identity Service
- Policy Engine
- Approval Service
- Audit Service
- Config Registry
- Model Relay Registry

### C. 执行平面

- OpenClaw Gateway
- Agent Runtime
- Tool Runtime
- Sandbox Runner
- Browser Worker
- OA / Internal API Tools

### D. 数据层

- PostgreSQL
- Redis
- Object Storage
- 可选日志检索系统

## 模块职责

### OpenClaw Core

保留原生能力：

- gateway
- agent session
- tool runtime
- sandbox
- browser
- message routing

只做少量扩展补丁：

- 在每次请求进入 agent 前注入 `subjectClaims`
- 在 tool 调用前统一执行策略检查
- 在高风险动作前统一进入审批流程
- 在关键生命周期节点输出结构化审计事件

### DingTalk Enterprise Connector

这是企业版的关键插件，不再只是一个消息收发器。

职责包括：

- 接收钉钉消息和事件
- 解析发送者、群组、会话、账号信息
- 拉取并缓存组织身份信息
- 将钉钉身份映射为企业统一身份
- 构建 `subjectClaims`
- 维护群组和用户元数据
- 支持 OA/API 工具回调和卡片交互

### Identity Service

职责：

- 员工、部门、角色、群组、外部联系人映射
- 统一 subject id
- 身份缓存和同步
- 在职状态和组织树
- 多来源身份合并

### Policy Engine

职责：

- 判断谁可以触发哪个 agent
- 判断哪些工具可用
- 判断是否需要审批
- 判断数据范围和响应风格
- 生成运行时策略决策结果

### Approval Service

职责：

- 记录待审批动作
- 定义审批流和审批人
- 同步审批状态回执行平面
- 保存审批证据和操作上下文

### Audit Service

职责：

- 保存消息元数据
- 保存 agent 决策摘要
- 保存工具调用记录
- 保存审批记录
- 保存异常和安全事件

### Admin Console

职责：

- 中文配置后台
- 组织管理
- agent 管理
- 模型中转配置
- 策略管理
- 审计查询
- 审批管理
- 节点与浏览器池运维

## 运行链路

### 标准消息链路

1. 用户在钉钉中私聊或群聊 @ 机器人
2. DingTalk Connector 收到消息
3. Connector 解析 sender、group、account、conversation
4. Identity Service 返回统一身份和组织信息
5. Policy Engine 计算路由与权限
6. OpenClaw 将消息送入对应 agent
7. Agent 可调用允许的工具
8. 若命中高风险动作，进入 Approval Service
9. 审批通过后继续执行
10. 结果回到钉钉，并写入 Audit Service

### 高风险工具链路

1. 用户请求敏感动作
2. Policy Engine 判定需要审批
3. OpenClaw 不直接执行工具
4. Approval Service 创建审批单
5. 指定审批人确认
6. 执行平面恢复该动作
7. 写入完整审计记录

## Agent 拓扑建议

首期不建议只有一个万能 agent。建议拆成：

- `main-assistant`
- `oa-agent`
- `hr-agent`
- `it-agent`
- `knowledge-agent`
- `browser-fallback-agent`
- `ops-agent`

路由方式基于：

- 渠道
- 群组
- 用户角色
- 部门
- 场景标签
- 请求意图

## 什么放在插件里，什么放在外围服务

适合放插件：

- 钉钉消息协议处理
- 钉钉事件解析
- 钉钉目标发送
- 会话上下文构建
- 原生卡片交互

适合放外围服务：

- 组织身份
- 权限策略
- 审批流
- 审计中心
- 模型配置
- 后台控制台

## 技术边界

企业版的主业务路径必须是：

- 钉钉消息
- 内部 API
- 结构化策略
- 审计与审批

浏览器自动化只处理：

- 无开放 API 的后台页面
- 临时兜底动作
- 人工明确授权的辅助场景
