import type {
  ApprovalDecision,
  ApprovalRequest,
  RiskTier,
  RouteDecision,
  SubjectClaims,
  ToolPolicyDecision,
} from "../../shared-types/src/index.js";

export const approvalService = "@dingclaw/approval-service";

const approvalRequests = new Map<string, ApprovalRequest>();

function createApprovalRequestId(seed: {
  channel: string;
  accountId: string;
  subjectId: string;
  now: number;
}): string {
  return `apr_${seed.channel}_${seed.accountId}_${seed.subjectId}_${seed.now}`;
}

export function createApprovalRequest(params: {
  claims: SubjectClaims;
  route: RouteDecision;
  toolPolicy: ToolPolicyDecision;
  approval: ApprovalDecision;
  now?: number;
}): ApprovalRequest | null {
  if (!params.approval.required) {
    return null;
  }
  const createdAt = params.now ?? Date.now();
  const requestId = createApprovalRequestId({
    channel: params.claims.channel,
    accountId: params.claims.accountId,
    subjectId: params.claims.subjectId,
    now: createdAt,
  });
  const request: ApprovalRequest = {
    requestId,
    createdAt,
    subjectId: params.claims.subjectId,
    channel: params.claims.channel,
    accountId: params.claims.accountId,
    route: params.route.route,
    level: params.approval.level,
    riskTier: params.claims.riskTier,
    requestedToolClasses: params.toolPolicy.requestedToolClasses,
    summary: `${params.claims.displayName ?? params.claims.subjectId} 请求在 ${params.route.route} 使用 ${params.toolPolicy.requestedToolClasses.join(", ")}`,
    status: "pending",
  };
  approvalRequests.set(requestId, request);
  return request;
}

export function approveRequest(requestId: string): ApprovalRequest | null {
  const request = approvalRequests.get(requestId);
  if (!request) {
    return null;
  }
  const approved: ApprovalRequest = { ...request, status: "approved" };
  approvalRequests.set(requestId, approved);
  return approved;
}

export function rejectRequest(requestId: string): ApprovalRequest | null {
  const request = approvalRequests.get(requestId);
  if (!request) {
    return null;
  }
  const rejected: ApprovalRequest = { ...request, status: "rejected" };
  approvalRequests.set(requestId, rejected);
  return rejected;
}

export function resumeExecution(requestId: string): {
  resumable: boolean;
  request: ApprovalRequest | null;
  riskTier: RiskTier | null;
} {
  const request = approvalRequests.get(requestId) ?? null;
  return {
    resumable: request?.status === "approved",
    request,
    riskTier: request?.riskTier ?? null,
  };
}

export function listApprovalRequests(): ApprovalRequest[] {
  return [...approvalRequests.values()].toSorted((left, right) => right.createdAt - left.createdAt);
}

export function resetApprovalRequestsForTest(): void {
  approvalRequests.clear();
}
