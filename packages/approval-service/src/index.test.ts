import { beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  createApprovalRequest,
  rejectRequest,
  resetApprovalRequestsForTest,
  resumeExecution,
} from "./index.js";
import type { ApprovalDecision, RouteDecision, SubjectClaims, ToolPolicyDecision } from "../../shared-types/src/index.js";

function createClaims(): SubjectClaims {
  return {
    subjectId: "staff-1",
    channel: "dingtalk-enterprise",
    accountId: "corp-a",
    departments: ["技术中心"],
    roles: ["employee"],
    groups: [],
    toolScopes: ["browser.open"],
    dataScopes: [],
    approvalLevel: "L2",
    riskTier: "normal",
    chatType: "direct",
    mentioned: false,
    technical: {
      channel: "dingtalk-enterprise",
      accountId: "corp-a",
      receivedAt: 1,
    },
    enterprise: {
      subjectId: "staff-1",
      departments: ["技术中心"],
    },
    permission: {
      roles: ["employee"],
      groups: [],
      toolScopes: ["browser.open"],
      dataScopes: [],
      approvalLevel: "L2",
      riskTier: "normal",
    },
    scenario: {
      chatType: "direct",
      groupTags: [],
      mentioned: false,
      isAdminContext: false,
      isDirect: true,
    },
  };
}

describe("approval-service", () => {
  beforeEach(() => {
    resetApprovalRequestsForTest();
  });

  it("creates, approves, rejects and resumes approval requests", () => {
    const route: RouteDecision = {
      allowed: true,
      access: "allow",
      route: "it-agent",
      reason: "ok",
      matchedBy: "default",
      requiresMention: false,
    };
    const toolPolicy: ToolPolicyDecision = {
      allowed: true,
      reason: "ok",
      requestedToolClasses: ["browser-automation"],
      allowedToolClasses: ["browser-automation"],
      deniedToolClasses: [],
      requiresApproval: true,
    };
    const approval: ApprovalDecision = {
      required: true,
      level: "L2",
      status: "pending",
      reason: "浏览器代操作需要审批",
    };

    const created = createApprovalRequest({
      claims: createClaims(),
      route,
      toolPolicy,
      approval,
      now: 1_700_000_000_000,
    });

    expect(created?.status).toBe("pending");
    expect(created?.requestId).toContain("apr_");

    const approved = approveRequest(created!.requestId);
    expect(approved?.status).toBe("approved");
    expect(resumeExecution(created!.requestId).resumable).toBe(true);

    const rejected = rejectRequest(created!.requestId);
    expect(rejected?.status).toBe("rejected");
  });
});
