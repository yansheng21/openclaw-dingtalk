import { beforeEach, describe, expect, it } from "vitest";
import { queryAuditEvents, resetAuditEventsForTest } from "../../audit-service/src/index.js";
import { resetApprovalRequestsForTest } from "../../approval-service/src/index.js";
import { resolveRuntimeDecision } from "./index.js";

describe("runtime-bridge", () => {
  beforeEach(() => {
    resetAuditEventsForTest();
    resetApprovalRequestsForTest();
  });

  it("builds claims, policy, approval and audit output from a single ingress", () => {
    const decision = resolveRuntimeDecision({
      ingress: {
        channel: "dingtalk-enterprise",
        accountId: "corp-a",
        webhookKind: "card",
        eventType: "card.action.trigger",
        messageId: "msg-1",
        senderId: "user-1",
        staffId: "staff-1",
        senderName: "张三",
        conversationId: "cid-1",
        conversationTitle: "平台架构群",
        chatType: "group",
        mentioned: true,
        contentPreview: "请代我提交发布审批",
        receivedAt: 1_700_000_000_000,
      },
      policy: {
        groupPolicy: "allowlist",
        groupAllowFrom: ["cid-1"],
        requireMention: true,
        toolScopes: ["browser.open", "oa.submit.leave"],
        approvalLevel: "L1",
        riskTier: "normal",
      },
      requestedToolClasses: ["chat-only", "browser-automation"],
      action: "dingtalk-enterprise.card.ingress",
    });

    expect(decision.claims.subjectId).toBe("dingtalk-enterprise:corp-a:staff-1");
    expect(decision.route.route).toBe("approval-agent");
    expect(decision.toolPolicy.allowedToolClasses).toContain("browser-automation");
    expect(decision.approval.required).toBe(true);
    expect(decision.approvalRequest?.status).toBe("pending");
    expect(decision.auditEvent.outcome).toBe("pending-approval");
    expect(queryAuditEvents({ subjectId: "dingtalk-enterprise:corp-a:staff-1" })).toHaveLength(1);
  });
});
