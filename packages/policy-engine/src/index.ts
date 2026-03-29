import type {
  ApprovalDecision,
  ApprovalLevel,
  EnterpriseAccessPolicy,
  RouteDecision,
  SubjectClaims,
  ToolClass,
  ToolPolicyDecision,
} from "../../shared-types/src/index.js";

export const policyEngine = "@dingclaw/policy-engine";

function normalizeList(value: Array<string | null | undefined> | undefined): string[] {
  return [
    ...new Set(
      (value ?? [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

function approvalRank(level: ApprovalLevel): number {
  switch (level) {
    case "L4":
      return 4;
    case "L3":
      return 3;
    case "L2":
      return 2;
    case "L1":
      return 1;
    default:
      return 0;
  }
}

function maxApprovalLevel(left: ApprovalLevel, right: ApprovalLevel): ApprovalLevel {
  return approvalRank(left) >= approvalRank(right) ? left : right;
}

function resolveSenderCandidates(claims: SubjectClaims): string[] {
  return normalizeList([
    claims.subjectId,
    claims.staffId ?? undefined,
    claims.senderId ?? undefined,
    ...claims.roles,
    ...claims.departments,
  ]);
}

function isAllowlisted(entries: string[] | undefined, candidates: string[]): boolean {
  const normalizedEntries = normalizeList(entries);
  if (normalizedEntries.includes("*")) {
    return true;
  }
  if (normalizedEntries.length === 0) {
    return false;
  }
  return candidates.some((candidate) => normalizedEntries.includes(candidate));
}

function inferRouteByClaims(claims: SubjectClaims, policy?: EnterpriseAccessPolicy): {
  route: string;
  matchedBy: RouteDecision["matchedBy"];
} {
  const preview = (claims.contentPreview ?? "").toLowerCase();
  if (claims.roles.includes("platform-admin")) {
    return { route: "executive-agent", matchedBy: "role" };
  }
  if (claims.roles.includes("hr_member") || claims.departments.some((entry) => entry.includes("人力"))) {
    return { route: "hr-agent", matchedBy: "department" };
  }
  if (claims.roles.includes("it_member") || claims.departments.some((entry) => entry.includes("技术"))) {
    return { route: "it-agent", matchedBy: "department" };
  }
  if (preview.includes("审批")) {
    return { route: "approval-agent", matchedBy: "keyword" };
  }
  if (preview.includes("告警") || preview.includes("故障")) {
    return { route: "ops-agent", matchedBy: "keyword" };
  }
  return { route: policy?.defaultRoute ?? "general-agent", matchedBy: "default" };
}

function resolveScopeToolClasses(toolScopes: string[]): ToolClass[] {
  const classes = new Set<ToolClass>(["chat-only"]);
  for (const scope of toolScopes) {
    if (scope.startsWith("chat.") || scope.startsWith("read.")) {
      classes.add("read-only");
    }
    if (scope.startsWith("oa.") || scope.startsWith("internal-api.") || scope.startsWith("api.")) {
      classes.add("internal-api");
    }
    if (scope.startsWith("browser.")) {
      classes.add("browser-automation");
    }
    if (scope.startsWith("host.") || scope.startsWith("exec.")) {
      classes.add("host-exec");
    }
  }
  return [...classes];
}

export function evaluateRoute(params: {
  claims: SubjectClaims;
  policy?: EnterpriseAccessPolicy;
}): RouteDecision {
  const { claims, policy } = params;
  const senderCandidates = resolveSenderCandidates(claims);
  const { route, matchedBy } = inferRouteByClaims(claims, policy);
  const requireMention = policy?.requireMention !== false;

  if (claims.chatType === "group") {
    const groupPolicy = policy?.groupPolicy ?? "allowlist";
    if (groupPolicy === "disabled") {
      return {
        allowed: false,
        access: "deny",
        route,
        reason: "groupPolicy=disabled",
        matchedBy: "policy",
        requiresMention: requireMention,
      };
    }
    if (!isAllowlisted(policy?.groupAllowFrom, [
      ...senderCandidates,
      claims.conversationId ?? "",
      ...claims.scenario.groupTags,
    ])) {
      if (groupPolicy === "allowlist") {
        return {
          allowed: false,
          access: "deny",
          route,
          reason: "groupPolicy=allowlist (not allowlisted)",
          matchedBy: "policy",
          requiresMention: requireMention,
        };
      }
    }
    if (requireMention && !claims.mentioned) {
      return {
        allowed: false,
        access: "deny",
        route,
        reason: "群聊需要显式 @ 机器人后才会进入企业链路",
        matchedBy: "mention-gate",
        requiresMention: true,
      };
    }
    return {
      allowed: true,
      access: "allow",
      route,
      reason: `groupPolicy=${groupPolicy}`,
      matchedBy,
      requiresMention: requireMention,
    };
  }

  const dmPolicy = policy?.dmPolicy ?? "pairing";
  if (dmPolicy === "disabled") {
    return {
      allowed: false,
      access: "deny",
      route,
      reason: "dmPolicy=disabled",
      matchedBy: "policy",
      requiresMention: false,
    };
  }
  if (dmPolicy === "open") {
    return {
      allowed: true,
      access: "allow",
      route,
      reason: "dmPolicy=open",
      matchedBy,
      requiresMention: false,
    };
  }
  const matched = isAllowlisted(policy?.allowFrom, senderCandidates);
  if (matched) {
    return {
      allowed: true,
      access: "allow",
      route,
      reason: `dmPolicy=${dmPolicy} (allowlisted)`,
      matchedBy,
      requiresMention: false,
    };
  }
  if (dmPolicy === "pairing") {
    return {
      allowed: false,
      access: "pairing",
      route,
      reason: "dmPolicy=pairing (需要先建立配对或加入白名单)",
      matchedBy: "policy",
      requiresMention: false,
    };
  }
  return {
    allowed: false,
    access: "deny",
    route,
    reason: `dmPolicy=${dmPolicy} (not allowlisted)`,
    matchedBy: "policy",
    requiresMention: false,
  };
}

export function evaluateToolPolicy(params: {
  claims: SubjectClaims;
  policy?: EnterpriseAccessPolicy;
  requestedToolClasses?: ToolClass[];
}): ToolPolicyDecision {
  const requestedToolClasses = params.requestedToolClasses?.length
    ? params.requestedToolClasses
    : resolveScopeToolClasses(params.claims.toolScopes);
  const baseAllowed = new Set<ToolClass>(resolveScopeToolClasses(params.claims.toolScopes));
  const blocked = new Set<ToolClass>(params.policy?.blockedToolClasses ?? []);

  if (!params.claims.roles.includes("platform-admin")) {
    blocked.add("host-exec");
  }
  if (params.claims.riskTier === "critical") {
    blocked.add("browser-automation");
    blocked.add("host-exec");
  }
  if (params.claims.riskTier === "high") {
    blocked.add("host-exec");
  }

  const allowedToolClasses = requestedToolClasses.filter(
    (toolClass) => baseAllowed.has(toolClass) && !blocked.has(toolClass),
  );
  const deniedToolClasses = requestedToolClasses.filter(
    (toolClass) => !allowedToolClasses.includes(toolClass),
  );
  const allowed = deniedToolClasses.length === 0;
  const requiresApproval = requestedToolClasses.some(
    (toolClass) => toolClass === "browser-automation" || toolClass === "host-exec",
  );

  return {
    allowed,
    reason: allowed
      ? "工具权限通过"
      : `以下工具类别被策略拒绝：${deniedToolClasses.join(", ") || "未知"}`,
    requestedToolClasses,
    allowedToolClasses,
    deniedToolClasses,
    requiresApproval,
  };
}

export function evaluateApprovalNeed(params: {
  claims: SubjectClaims;
  route: RouteDecision;
  toolPolicy: ToolPolicyDecision;
}): ApprovalDecision {
  if (!params.route.allowed || !params.toolPolicy.allowed) {
    return {
      required: false,
      level: params.claims.approvalLevel,
      status: "not-required",
      reason: "请求已被策略拦截，无需进入审批",
    };
  }

  let level = params.claims.approvalLevel;
  let required = false;
  let reason = "普通对话无需审批";
  if (params.toolPolicy.requestedToolClasses.includes("host-exec")) {
    level = maxApprovalLevel(level, "L4");
    required = true;
    reason = "宿主机执行属于最高风险动作，必须审批";
  } else if (params.toolPolicy.requestedToolClasses.includes("browser-automation")) {
    level = maxApprovalLevel(level, "L2");
    required = true;
    reason = "浏览器代操作需要审批";
  } else if (params.toolPolicy.requestedToolClasses.includes("internal-api")) {
    level = maxApprovalLevel(level, "L1");
    required = true;
    reason = "内部系统写操作或流程动作建议审批";
  }

  return {
    required,
    level,
    status: required ? "pending" : "not-required",
    reason,
  };
}

export function buildPersonaProfile(params: {
  claims: SubjectClaims;
}): {
  tone: "formal" | "direct" | "executive";
  responseStyle: "steps" | "summary" | "diagnostic";
  riskNotice: boolean;
} {
  if (params.claims.roles.includes("platform-admin")) {
    return { tone: "executive", responseStyle: "summary", riskNotice: true };
  }
  if (params.claims.requestIntent === "it") {
    return { tone: "direct", responseStyle: "diagnostic", riskNotice: true };
  }
  return { tone: "formal", responseStyle: "steps", riskNotice: false };
}
