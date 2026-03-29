import type {
  ApprovalLevel,
  ChatType,
  EnterpriseAccessPolicy,
  EnterpriseChannelIngress,
  RiskTier,
  SubjectClaims,
} from "../../shared-types/src/index.js";

export const identityService = "@dingclaw/identity-service";

export type ResolveSubjectClaimsInput = {
  ingress: EnterpriseChannelIngress;
  policy?: EnterpriseAccessPolicy;
};

function normalizeList(value: Array<string | null | undefined> | undefined): string[] {
  return [
    ...new Set(
      (value ?? [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

function normalizeApprovalLevel(value: ApprovalLevel | undefined): ApprovalLevel {
  return value ?? "L1";
}

function normalizeRiskTier(value: RiskTier | undefined): RiskTier {
  return value ?? "normal";
}

function inferChatType(input: ResolveSubjectClaimsInput): ChatType {
  if (input.ingress.chatType) {
    return input.ingress.chatType;
  }
  const eventType = input.ingress.eventType?.toLowerCase() ?? "";
  if (eventType.includes("oa") || eventType.includes("approval")) {
    return "workflow";
  }
  if (input.ingress.conversationId || input.ingress.conversationTitle) {
    return "group";
  }
  return "direct";
}

function inferRequestIntent(preview: string | null | undefined): string | null {
  const normalized = preview?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("请假") || normalized.includes("考勤") || normalized.includes("薪资")) {
    return "hr";
  }
  if (
    normalized.includes("日志") ||
    normalized.includes("报错") ||
    normalized.includes("接口") ||
    normalized.includes("部署") ||
    normalized.includes("告警") ||
    normalized.includes("工单")
  ) {
    return "it";
  }
  if (normalized.includes("审批") || normalized.includes("流程")) {
    return "approval";
  }
  return "general";
}

function inferSubjectId(input: ResolveSubjectClaimsInput): string {
  const raw =
    input.ingress.staffId?.trim() ||
    input.ingress.senderId?.trim() ||
    input.ingress.traceId?.trim() ||
    "anonymous";
  return `${input.ingress.channel}:${input.ingress.accountId}:${raw}`;
}

function inferRoles(input: ResolveSubjectClaimsInput): string[] {
  const roles = normalizeList([
    ...(input.ingress.senderRoles ?? []),
    ...(input.policy?.defaultRoles ?? []),
  ]);
  if (roles.length === 0) {
    roles.push("employee");
  }
  if ((input.policy?.adminStaffIds ?? []).includes(input.ingress.staffId ?? "")) {
    roles.push("platform-admin");
  }
  const intent = inferRequestIntent(input.ingress.contentPreview);
  if (intent === "it" && !roles.includes("it_member")) {
    roles.push("it_member");
  }
  if (intent === "hr" && !roles.includes("hr_member")) {
    roles.push("hr_member");
  }
  return normalizeList(roles);
}

function inferDepartments(input: ResolveSubjectClaimsInput): string[] {
  const configured = normalizeList([
    ...(input.ingress.senderDepartments ?? []),
    ...(input.policy?.departmentHints ?? []),
  ]);
  if (configured.length > 0) {
    return configured;
  }
  const preview = input.ingress.contentPreview ?? "";
  if (preview.includes("日志") || preview.includes("部署") || preview.includes("告警")) {
    return ["技术中心", "平台架构部"];
  }
  if (preview.includes("请假") || preview.includes("薪资")) {
    return ["职能中心", "人力资源部"];
  }
  return ["企业服务部"];
}

export function resolveSubjectClaims(input: ResolveSubjectClaimsInput): SubjectClaims {
  const subjectId = inferSubjectId(input);
  const chatType = inferChatType(input);
  const mentioned = input.ingress.mentioned === true;
  const roles = inferRoles(input);
  const departments = inferDepartments(input);
  const toolScopes = normalizeList(input.policy?.toolScopes);
  const dataScopes = normalizeList(input.policy?.dataScopes);
  const requestIntent = inferRequestIntent(input.ingress.contentPreview);
  const approvalLevel = normalizeApprovalLevel(input.policy?.approvalLevel);
  const riskTier = normalizeRiskTier(input.policy?.riskTier);
  const isAdminContext = roles.includes("platform-admin");

  return {
    subjectId,
    channel: input.ingress.channel,
    accountId: input.ingress.accountId,
    conversationId: input.ingress.conversationId ?? null,
    staffId: input.ingress.staffId ?? null,
    senderId: input.ingress.senderId ?? null,
    displayName: input.ingress.senderName ?? null,
    departments,
    roles,
    groups: input.ingress.conversationId ? [input.ingress.conversationId] : [],
    toolScopes,
    dataScopes,
    approvalLevel,
    riskTier,
    chatType,
    mentioned,
    requestIntent,
    language: input.ingress.language ?? input.policy?.language ?? "zh-CN",
    contentPreview: input.ingress.contentPreview ?? null,
    technical: {
      channel: input.ingress.channel,
      accountId: input.ingress.accountId,
      webhookKind: input.ingress.webhookKind,
      eventType: input.ingress.eventType ?? null,
      traceId: input.ingress.traceId ?? null,
      messageId: input.ingress.messageId ?? null,
      conversationId: input.ingress.conversationId ?? null,
      senderId: input.ingress.senderId ?? null,
      staffId: input.ingress.staffId ?? null,
      senderNick: input.ingress.senderName ?? null,
      receivedAt: input.ingress.receivedAt,
    },
    enterprise: {
      subjectId,
      employeeCode: input.ingress.staffId ?? input.ingress.senderId ?? null,
      displayName: input.ingress.senderName ?? null,
      departments,
      departmentPath: departments,
      jobTitle: roles.includes("platform-admin") ? "平台管理员" : "员工",
      managerId: null,
      employmentStatus: "active",
    },
    permission: {
      roles,
      groups: input.ingress.conversationId ? [input.ingress.conversationId] : [],
      toolScopes,
      dataScopes,
      approvalLevel,
      riskTier,
    },
    scenario: {
      chatType,
      groupId: chatType === "group" ? input.ingress.conversationId ?? null : null,
      groupTags:
        normalizeList([
          ...(input.ingress.groupTags ?? []),
          input.ingress.conversationTitle ?? undefined,
        ]) ?? [],
      mentioned,
      isAdminContext,
      isDirect: chatType === "direct",
      requestIntent,
      language: input.ingress.language ?? input.policy?.language ?? "zh-CN",
      contentPreview: input.ingress.contentPreview ?? null,
    },
  };
}
