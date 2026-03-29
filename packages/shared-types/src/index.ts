export type SubjectId = string;

export type ApprovalLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export type RiskTier = "low" | "normal" | "elevated" | "high" | "critical";

export type ChatType = "direct" | "group" | "workflow" | "system";

export type DmPolicy = "open" | "allowlist" | "pairing" | "disabled";

export type GroupPolicy = "open" | "allowlist" | "disabled";

export type ToolClass =
  | "chat-only"
  | "read-only"
  | "internal-api"
  | "browser-automation"
  | "host-exec";

export type RouteAccessState = "allow" | "deny" | "pairing";

export type ApprovalStatus = "not-required" | "pending";

export type AuditOutcome = "accepted" | "blocked" | "pending-approval";

export type EnterpriseWebhookKind = "message" | "card" | "oa";

export interface TechnicalIdentity {
  channel: string;
  accountId: string;
  webhookKind?: EnterpriseWebhookKind | string;
  eventType?: string | null;
  traceId?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  senderId?: string | null;
  staffId?: string | null;
  senderNick?: string | null;
  receivedAt: number;
}

export interface EnterpriseIdentity {
  subjectId: SubjectId;
  employeeCode?: string | null;
  displayName?: string | null;
  departments: string[];
  departmentPath?: string[];
  jobTitle?: string | null;
  managerId?: string | null;
  employmentStatus?: "active" | "inactive" | "contractor" | "unknown";
}

export interface PermissionIdentity {
  roles: string[];
  groups: string[];
  toolScopes: string[];
  dataScopes: string[];
  approvalLevel: ApprovalLevel;
  riskTier: RiskTier;
}

export interface ScenarioIdentity {
  chatType: ChatType;
  groupId?: string | null;
  groupTags: string[];
  mentioned: boolean;
  isAdminContext: boolean;
  isDirect: boolean;
  requestIntent?: string | null;
  language?: string | null;
  contentPreview?: string | null;
}

export interface SubjectClaims {
  subjectId: SubjectId;
  channel: string;
  accountId: string;
  conversationId?: string | null;
  staffId?: string | null;
  senderId?: string | null;
  displayName?: string | null;
  departments: string[];
  roles: string[];
  groups: string[];
  toolScopes: string[];
  dataScopes: string[];
  approvalLevel: ApprovalLevel;
  riskTier: RiskTier;
  chatType: ChatType;
  mentioned: boolean;
  requestIntent?: string | null;
  language?: string | null;
  contentPreview?: string | null;
  technical: TechnicalIdentity;
  enterprise: EnterpriseIdentity;
  permission: PermissionIdentity;
  scenario: ScenarioIdentity;
}

export interface EnterpriseChannelIngress {
  channel: string;
  accountId: string;
  webhookKind?: EnterpriseWebhookKind | string;
  eventType?: string | null;
  traceId?: string | null;
  messageId?: string | null;
  senderId?: string | null;
  staffId?: string | null;
  senderName?: string | null;
  conversationId?: string | null;
  conversationTitle?: string | null;
  senderRoles?: string[];
  senderDepartments?: string[];
  groupTags?: string[];
  chatType?: ChatType;
  mentioned?: boolean;
  contentPreview?: string | null;
  language?: string | null;
  receivedAt: number;
  metadata?: Record<string, unknown>;
}

export interface EnterpriseAccessPolicy {
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  requireMention?: boolean;
  allowFrom?: string[];
  groupAllowFrom?: string[];
  defaultRoles?: string[];
  departmentHints?: string[];
  toolScopes?: string[];
  dataScopes?: string[];
  adminStaffIds?: string[];
  defaultRoute?: string;
  approvalLevel?: ApprovalLevel;
  riskTier?: RiskTier;
  language?: string;
  blockedToolClasses?: ToolClass[];
}

export interface RouteDecision {
  allowed: boolean;
  access: RouteAccessState;
  route: string;
  reason: string;
  matchedBy: "default" | "role" | "department" | "keyword" | "policy" | "mention-gate";
  requiresMention: boolean;
}

export interface ToolPolicyDecision {
  allowed: boolean;
  reason: string;
  requestedToolClasses: ToolClass[];
  allowedToolClasses: ToolClass[];
  deniedToolClasses: ToolClass[];
  requiresApproval: boolean;
}

export interface ApprovalDecision {
  required: boolean;
  level: ApprovalLevel;
  status: ApprovalStatus;
  reason: string;
  requestId?: string;
}

export interface ApprovalRequest {
  requestId: string;
  createdAt: number;
  subjectId: SubjectId;
  channel: string;
  accountId: string;
  route: string;
  level: ApprovalLevel;
  riskTier: RiskTier;
  requestedToolClasses: ToolClass[];
  summary: string;
  status: "pending" | "approved" | "rejected";
}

export interface AuditEvent {
  eventId: string;
  occurredAt: number;
  kind: "ingress" | "policy" | "approval" | "runtime";
  action: string;
  channel: string;
  accountId: string;
  subjectId: SubjectId;
  conversationId?: string | null;
  route?: string | null;
  riskTier: RiskTier;
  outcome: AuditOutcome;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeBridgeInput {
  ingress: EnterpriseChannelIngress;
  policy?: EnterpriseAccessPolicy;
  requestedToolClasses?: ToolClass[];
  action?: string;
}

export interface RuntimeDecision {
  accepted: boolean;
  claims: SubjectClaims;
  route: RouteDecision;
  toolPolicy: ToolPolicyDecision;
  approval: ApprovalDecision;
  auditEvent: AuditEvent;
}

export type SubjectClaimSet = SubjectClaims;
