# DingClaw 身份与权限设计

## 设计目标

让系统在每次请求进入 agent 前，先明确回答 4 个问题：

1. 这个人是谁
2. 他在组织中的身份是什么
3. 他当前在哪个场景里说话
4. 他此刻能触发什么能力

## 统一身份模型

### 1. 技术身份

来源于渠道原始消息：

- `channel`
- `accountId`
- `conversationId`
- `senderStaffId`
- `senderId`
- `senderNick`
- `messageId`

### 2. 企业身份

来源于组织数据：

- `subjectId`
- `employeeCode`
- `displayName`
- `departmentId`
- `departmentPath`
- `jobTitle`
- `managerId`
- `employmentStatus`

### 3. 权限身份

来源于 RBAC / ABAC 规则：

- `roles`
- `groups`
- `toolScopes`
- `dataScopes`
- `approvalLevel`
- `riskTier`

### 4. 场景身份

来源于会话上下文：

- `chatType`
- `groupId`
- `groupTags`
- `mentioned`
- `isAdminContext`
- `isDirect`
- `requestIntent`

## 运行时 Subject Claims

所有进入 agent 的请求都注入统一 claims：

```json
{
  "subjectId": "user_001",
  "channel": "dingtalk-connector",
  "accountId": "__default__",
  "staffId": "16928374866135830",
  "conversationId": "cid+xxx",
  "displayName": "张三",
  "departments": ["技术中心", "平台架构部"],
  "roles": ["employee", "it_member"],
  "chatType": "group",
  "mentioned": true,
  "toolScopes": ["chat.read", "oa.submit.leave"],
  "approvalLevel": "L1",
  "riskTier": "normal"
}
```

## 授权层级

### A. 接入授权

决定消息是否能进入系统：

- 是否允许该员工私聊
- 是否允许该群接入
- 群里是否必须 @
- 群里哪些人可触发

### B. 路由授权

决定消息进入哪个 agent：

- 普通员工进入通用 agent
- HR 问题进入 HR agent
- 技术群进入 IT agent
- 运维群进入 Ops agent
- 高管进入摘要型 agent

### C. 工具授权

决定 agent 能调用哪些工具：

- 只聊天
- 读数据
- 调内部 API
- 浏览器自动化
- 宿主机执行

### D. 数据授权

决定 agent 可见的数据范围：

- 仅自己
- 自己和直属下属
- 本部门
- 全公司
- 指定业务域

### E. 动作授权

决定是否需要审批：

- 普通查询不审批
- 敏感查询可审批
- 对外发送审批
- 浏览器代操作审批
- 宿主机执行必须审批

## 工具分级

建议统一分为 5 档：

- `chat-only`
- `read-only`
- `internal-api`
- `browser-automation`
- `host-exec`

默认规则：

- 普通员工：`chat-only` + 部分 `internal-api`
- 主管：增加团队数据读取
- 部门管理员：增加部门级操作
- 平台管理员：可申请高风险工具
- 审计员：只读审计和审批记录

## Persona 切换

不要通过 prompt 硬编码“对谁说什么话”，而是通过规则生成 persona profile。

输入维度：

- 用户角色
- 部门
- 群类型
- 语言偏好
- 请求类型

输出结果：

- 语气风格
- 回复长度
- 是否给摘要
- 是否给步骤
- 是否允许技术细节
- 是否主动给风险提示

示例：

- 高管：先结论后细节，默认摘要
- 普通员工：默认给可执行步骤
- 技术群：允许日志、命令、结构化排障信息
- HR 场景：默认正式、敏感、谨慎

## 审批策略

建议按风险级别设置：

- `L0`：无需审批
- `L1`：本人确认
- `L2`：直属主管审批
- `L3`：平台管理员审批
- `L4`：双人审批

触发审批的动作示例：

- 浏览器代点提交
- 跨部门数据查询
- 执行脚本
- 外发消息
- 修改系统配置

## 企业默认基线

企业版默认策略建议：

- `dmPolicy = allowlist` 或 `pairing`
- `groupPolicy = allowlist`
- 群聊默认必须 @
- 高风险工具默认关闭
- sandbox 默认开启
- 宿主机执行默认禁止
- 所有敏感动作必须审计

## 关键实现要求

必须实现：

- 钉钉身份到企业 subject 的映射
- 运行时 claims 注入
- tool 前置策略检查
- 审批中断与恢复
- 结构化审计事件

不建议实现为：

- 单纯靠系统提示词判断权限
- 把用户角色写死在 prompt 里
- 让任意群成员共享完整高权限 agent
