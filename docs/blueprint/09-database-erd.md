# DingClaw 数据库 ERD 草案

## 说明

本草案用于指导首期 PostgreSQL 表设计。  
重点放在：

- 身份
- 组织
- 策略
- agent
- 审批
- 审计

## ER 图

```mermaid
erDiagram
    ORG_USERS ||--o{ ORG_USER_DEPARTMENTS : belongs_to
    ORG_DEPARTMENTS ||--o{ ORG_USER_DEPARTMENTS : contains
    ORG_USERS ||--o{ ORG_USER_ROLES : has
    ORG_ROLES ||--o{ ORG_USER_ROLES : grants

    ORG_USERS ||--o{ CHANNEL_SUBJECT_LINKS : maps_to
    CHANNEL_ACCOUNTS ||--o{ CHANNEL_SUBJECT_LINKS : owns
    CHANNEL_ACCOUNTS ||--o{ CHANNEL_GROUPS : owns

    AGENTS ||--o{ AGENT_BINDINGS : routes
    PERSONA_PROFILES ||--o{ AGENTS : styles
    MODEL_ROUTES ||--o{ AGENTS : defaults_to
    MODEL_PROVIDERS ||--o{ MODEL_ROUTES : provides

    POLICY_SETS ||--o{ POLICY_RULES : contains
    AGENTS ||--o{ APPROVAL_REQUESTS : triggers
    ORG_USERS ||--o{ APPROVAL_REQUESTS : initiates
    APPROVAL_REQUESTS ||--o{ APPROVAL_ACTIONS : records

    AGENTS ||--o{ SESSION_INDEX : owns
    ORG_USERS ||--o{ SESSION_INDEX : participates

    ORG_USERS ||--o{ AUDIT_EVENTS : causes
    AGENTS ||--o{ AUDIT_EVENTS : emits
    APPROVAL_REQUESTS ||--o{ AUDIT_EVENTS : references

    ORG_USERS {
      uuid id PK
      string subject_id UK
      string employee_code
      string staff_id
      string display_name
      string email
      string mobile
      string status
      uuid primary_department_id
      timestamptz created_at
      timestamptz updated_at
    }

    ORG_DEPARTMENTS {
      uuid id PK
      string dept_id UK
      string name
      uuid parent_id
      string path
      string status
      timestamptz created_at
      timestamptz updated_at
    }

    ORG_USER_DEPARTMENTS {
      uuid id PK
      uuid user_id
      uuid department_id
      boolean is_primary
    }

    ORG_ROLES {
      uuid id PK
      string role_key UK
      string name
      string scope
      string description
    }

    ORG_USER_ROLES {
      uuid id PK
      uuid user_id
      uuid role_id
      string source
      timestamptz expires_at
    }

    CHANNEL_ACCOUNTS {
      uuid id PK
      string channel
      string account_key
      string display_name
      string status
      string config_ref
    }

    CHANNEL_SUBJECT_LINKS {
      uuid id PK
      uuid channel_account_id
      string channel
      string external_subject_id
      string external_staff_id
      string external_union_id
      uuid user_id
      timestamptz last_seen_at
    }

    CHANNEL_GROUPS {
      uuid id PK
      uuid channel_account_id
      string conversation_id
      string name
      string group_type
      uuid owner_user_id
      string status
    }

    PERSONA_PROFILES {
      uuid id PK
      string persona_key UK
      string name
      jsonb style_json
      text prompt_template
    }

    MODEL_PROVIDERS {
      uuid id PK
      string provider_key UK
      string base_url
      string auth_ref
      string status
    }

    MODEL_ROUTES {
      uuid id PK
      uuid provider_id
      string route_key UK
      string model_id
      string reasoning_effort
      integer timeout_ms
      boolean enabled
    }

    AGENTS {
      uuid id PK
      string agent_key UK
      string name
      uuid persona_profile_id
      uuid model_route_id
      string workspace_path
      string status
    }

    AGENT_BINDINGS {
      uuid id PK
      uuid agent_id
      string channel
      string account_id
      string group_id
      string role_key
      string department_id
      integer priority
      boolean enabled
    }

    POLICY_SETS {
      uuid id PK
      string policy_key UK
      string name
      integer version
      string status
    }

    POLICY_RULES {
      uuid id PK
      uuid policy_set_id
      string rule_type
      string effect
      integer priority
      jsonb match_json
      jsonb decision_json
    }

    APPROVAL_REQUESTS {
      uuid id PK
      string request_no UK
      uuid user_id
      uuid agent_id
      string tool_key
      string risk_level
      string status
      jsonb context_json
      timestamptz created_at
      timestamptz approved_at
    }

    APPROVAL_ACTIONS {
      uuid id PK
      uuid approval_request_id
      uuid operator_user_id
      string action
      text comment
      timestamptz created_at
    }

    SESSION_INDEX {
      uuid id PK
      uuid agent_id
      uuid user_id
      string session_key UK
      string channel
      string account_id
      string conversation_id
      string chat_type
      timestamptz last_message_at
    }

    AUDIT_EVENTS {
      uuid id PK
      string event_type
      string trace_id
      uuid user_id
      uuid agent_id
      uuid approval_request_id
      string tool_key
      string risk_level
      string session_key
      jsonb payload_json
      timestamptz created_at
    }
```

## 建表优先级

### P0 必须先建

- `org_users`
- `org_departments`
- `org_roles`
- `org_user_roles`
- `channel_accounts`
- `channel_subject_links`
- `agents`
- `agent_bindings`
- `policy_sets`
- `policy_rules`
- `approval_requests`
- `approval_actions`
- `audit_events`

### P1 第二批

- `channel_groups`
- `persona_profiles`
- `model_providers`
- `model_routes`
- `session_index`

### P2 后续增强

- 成本统计表
- 浏览器证据表
- 工具运行明细表
- 卡片交互明细表

## 索引建议

### `org_users`

- `subject_id`
- `staff_id`
- `employee_code`
- `primary_department_id`

### `channel_subject_links`

- `(channel, external_staff_id)`
- `(channel, external_subject_id)`
- `user_id`

### `agent_bindings`

- `(channel, priority desc)`
- `(agent_id, enabled)`

### `policy_rules`

- `(policy_set_id, priority desc)`
- `rule_type`

### `approval_requests`

- `request_no`
- `status`
- `user_id`
- `created_at desc`

### `audit_events`

- `trace_id`
- `event_type`
- `user_id`
- `agent_id`
- `created_at desc`

## 命名建议

- 业务主键统一 `uuid`
- 外部平台 id 不当主键
- 所有时间使用 `timestamptz`
- JSON 扩展字段统一 `jsonb`

## 约束建议

- `subject_id` 唯一
- `request_no` 唯一
- `agent_key` 唯一
- `role_key` 唯一
- `policy_key + version` 唯一
- `session_key` 唯一

## 首期落地建议

首期不要试图把所有 OpenClaw 原生 session 数据完全迁进数据库。

建议：

- OpenClaw 原生 session 仍保留文件存储
- DingClaw 先维护 `session_index`
- 业务审计、审批、身份、策略全部进 PostgreSQL

这样改造风险最低。
