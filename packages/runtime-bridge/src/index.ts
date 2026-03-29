import {
  createApprovalRequest,
} from "../../approval-service/src/index.js";
import { emitAuditEvent } from "../../audit-service/src/index.js";
import { resolveSubjectClaims } from "../../identity-service/src/index.js";
import {
  evaluateApprovalNeed,
  evaluateRoute,
  evaluateToolPolicy,
} from "../../policy-engine/src/index.js";
import type {
  ApprovalRequest,
  AuditEvent,
  RuntimeBridgeInput,
  RuntimeDecision,
} from "../../shared-types/src/index.js";

export const runtimeBridge = "@dingclaw/runtime-bridge";

export type RuntimeBridgeResult = RuntimeDecision & {
  approvalRequest: ApprovalRequest | null;
};

function createAuditEvent(params: {
  input: RuntimeBridgeInput;
  decision: RuntimeDecision;
}): AuditEvent {
  const outcome = !params.decision.route.allowed || !params.decision.toolPolicy.allowed
    ? "blocked"
    : params.decision.approval.required
      ? "pending-approval"
      : "accepted";
  return {
    eventId:
      params.input.ingress.traceId ??
      params.input.ingress.messageId ??
      `audit_${params.input.ingress.channel}_${params.input.ingress.accountId}_${params.input.ingress.receivedAt}`,
    occurredAt: params.input.ingress.receivedAt,
    kind: params.decision.approval.required ? "approval" : "runtime",
    action: params.input.action ?? "channel.ingress",
    channel: params.decision.claims.channel,
    accountId: params.decision.claims.accountId,
    subjectId: params.decision.claims.subjectId,
    conversationId: params.decision.claims.conversationId ?? null,
    route: params.decision.route.route,
    riskTier: params.decision.claims.riskTier,
    outcome,
    summary:
      params.input.ingress.contentPreview ??
      `${params.decision.claims.displayName ?? params.decision.claims.subjectId} -> ${params.decision.route.route}`,
    metadata: {
      requestIntent: params.decision.claims.requestIntent,
      toolPolicy: params.decision.toolPolicy,
      approval: params.decision.approval,
      eventType: params.input.ingress.eventType ?? null,
    },
  };
}

export function resolveRuntimeDecision(input: RuntimeBridgeInput): RuntimeBridgeResult {
  const claims = resolveSubjectClaims({
    ingress: input.ingress,
    policy: input.policy,
  });
  const route = evaluateRoute({
    claims,
    policy: input.policy,
  });
  const toolPolicy = evaluateToolPolicy({
    claims,
    policy: input.policy,
    requestedToolClasses: input.requestedToolClasses,
  });
  const approvalBase = evaluateApprovalNeed({
    claims,
    route,
    toolPolicy,
  });
  const approvalRequest = createApprovalRequest({
    claims,
    route,
    toolPolicy,
    approval: approvalBase,
    now: input.ingress.receivedAt,
  });
  const approval = approvalRequest
    ? { ...approvalBase, requestId: approvalRequest.requestId }
    : approvalBase;
  const decision: RuntimeDecision = {
    accepted: route.allowed && toolPolicy.allowed && !approval.required,
    claims,
    route,
    toolPolicy,
    approval,
    auditEvent: {
      eventId: "",
      occurredAt: input.ingress.receivedAt,
      kind: "runtime",
      action: input.action ?? "channel.ingress",
      channel: claims.channel,
      accountId: claims.accountId,
      subjectId: claims.subjectId,
      riskTier: claims.riskTier,
      outcome: "accepted",
      summary: claims.contentPreview ?? "",
    },
  };
  const auditEvent = emitAuditEvent(
    createAuditEvent({
      input,
      decision,
    }),
  );
  return {
    ...decision,
    auditEvent,
    approvalRequest,
  };
}
