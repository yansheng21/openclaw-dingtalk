# DingClaw 数据模型

## 设计原则

- 业务身份、技术身份、权限策略、审计记录分离
- 会话元数据与消息全文分离
- 审批流与执行记录可追踪关联
- 所有关键实体都有稳定主键和时间字段

## 核心实体

### 1. `org_users`

企业用户主表。

关键字段：

- `id`
- `subject_id`
- `employee_code`
- `staff_id`
- `display_name`
- `mobile`
- `email`
- `status`
- `manager_subject_id`
- `primary_department_id`
- `created_at`
- `updated_at`

### 2. `org_departments`

组织部门表。

关键字段：

- `id`
- `dept_id`
- `name`
- `parent_id`
- `path`
- `status`
- `created_at`
- `updated_at`

### 3. `org_user_departments`

用户与部门多对多关系。

关键字段：

- `id`
- `subject_id`
- `department_id`
- `is_primary`

### 4. `org_roles`

角色定义表。

关键字段：

- `id`
- `role_key`
- `name`
- `scope`
- `description`

### 5. `org_user_roles`

用户角色关系表。

关键字段：

- `id`
- `subject_id`
- `role_id`
- `source`
- `expires_at`

### 6. `channel_accounts`

渠道账号表。

关键字段：

- `id`
- `channel`
- `account_key`
- `display_name`
- `status`
- `config_ref`

### 7. `channel_subject_links`

技术身份与企业身份映射表。

关键字段：

- `id`
- `channel`
- `account_id`
- `external_subject_id`
- `external_staff_id`
- `external_union_id`
- `subject_id`
- `last_seen_at`

### 8. `channel_groups`

群组元数据表。

关键字段：

- `id`
- `channel`
- `account_id`
- `conversation_id`
- `name`
- `group_type`
- `owner_subject_id`
- `status`

### 9. `agents`

agent 定义表。

关键字段：

- `id`
- `agent_key`
- `name`
- `persona_key`
- `workspace_path`
- `model_route_id`
- `status`

### 10. `agent_bindings`

运行时路由规则。

关键字段：

- `id`
- `agent_id`
- `channel`
- `account_id`
- `group_id`
- `role_key`
- `department_id`
- `priority`
- `enabled`

### 11. `persona_profiles`

人格和响应风格模板。

关键字段：

- `id`
- `persona_key`
- `name`
- `style_json`
- `prompt_template`

### 12. `policy_sets`

策略集。

关键字段：

- `id`
- `policy_key`
- `name`
- `version`
- `status`

### 13. `policy_rules`

具体策略规则。

关键字段：

- `id`
- `policy_set_id`
- `rule_type`
- `effect`
- `priority`
- `match_json`
- `decision_json`

### 14. `tool_catalog`

系统工具目录。

关键字段：

- `id`
- `tool_key`
- `name`
- `risk_level`
- `category`
- `requires_approval`

### 15. `approval_requests`

审批主表。

关键字段：

- `id`
- `request_no`
- `subject_id`
- `agent_id`
- `tool_key`
- `risk_level`
- `status`
- `context_json`
- `created_at`
- `approved_at`

### 16. `approval_actions`

审批动作明细。

关键字段：

- `id`
- `approval_request_id`
- `action`
- `operator_subject_id`
- `comment`
- `created_at`

### 17. `session_index`

会话索引表，用于辅助 OpenClaw session 管理。

关键字段：

- `id`
- `agent_id`
- `session_key`
- `chat_type`
- `channel`
- `account_id`
- `subject_id`
- `conversation_id`
- `last_message_at`

### 18. `audit_events`

统一审计事件表。

关键字段：

- `id`
- `event_type`
- `trace_id`
- `subject_id`
- `agent_id`
- `session_key`
- `tool_key`
- `risk_level`
- `payload_json`
- `created_at`

### 19. `model_providers`

模型供应商配置。

关键字段：

- `id`
- `provider_key`
- `base_url`
- `auth_ref`
- `status`

### 20. `model_routes`

模型路由表。

关键字段：

- `id`
- `route_key`
- `provider_id`
- `model_id`
- `reasoning_effort`
- `timeout_ms`
- `enabled`

## 会话策略

企业版默认建议：

- 私聊使用 `per-channel-peer` 或 `per-account-channel-peer`
- 群聊按 `conversationId` 隔离
- 不同 agent 独立会话
- 敏感上下文不跨群共享

如果需要跨渠道合并同一人，可引入：

- `identity_links`

字段：

- `id`
- `canonical_subject_id`
- `channel`
- `external_subject_id`

## 审计事件建议类型

- `message.received`
- `identity.resolved`
- `policy.decided`
- `agent.routed`
- `tool.requested`
- `tool.blocked`
- `approval.created`
- `approval.resolved`
- `tool.executed`
- `message.sent`
- `security.alert`

## 存储建议

- PostgreSQL：业务主数据、策略、审批、审计索引
- Redis：缓存、幂等、短期状态
- Object Storage：截图、附件、审批证据、导出文件

## Retention 建议

- 审计索引：180 天起
- 审批记录：至少 1 年
- 敏感操作证据：按合规要求
- 截图和浏览器产物：默认短期保留，可配置
