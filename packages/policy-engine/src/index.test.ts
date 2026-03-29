import { describe, expect, it } from "vitest";
import {
  evaluateApprovalNeed,
  evaluateRoute,
  evaluateToolPolicy,
} from "./index.js";
import type { SubjectClaims } from "../../shared-types/src/index.js";

function createClaims(overrides: Partial<SubjectClaims> = {}): SubjectClaims {
  return {
    subjectId: "staff-1",
    channel: "dingtalk-enterprise",
    accountId: "corp-a",
    conversationId: "cid-1",
    staffId: "staff-1",
    senderId: "user-1",
    displayName: "张三",
    departments: ["技术中心"],
    roles: ["employee", "it_member"],
    groups: ["cid-1"],
    toolScopes: ["chat.read", "browser.open", "oa.submit.leave"],
    dataScopes: [],
    approvalLevel: "L1",
    riskTier: "normal",
    chatType: "group",
    mentioned: true,
    requestIntent: "it",
    language: "zh-CN",
    contentPreview: "请帮我看下线上日志",
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
      roles: ["employee", "it_member"],
      groups: ["cid-1"],
      toolScopes: ["chat.read", "browser.open", "oa.submit.leave"],
      dataScopes: [],
      approvalLevel: "L1",
      riskTier: "normal",
    },
    scenario: {
      chatType: "group",
      groupId: "cid-1",
      groupTags: ["平台群"],
      mentioned: true,
      isAdminContext: false,
      isDirect: false,
      requestIntent: "it",
      language: "zh-CN",
      contentPreview: "请帮我看下线上日志",
    },
    ...overrides,
  };
}

describe("policy-engine", () => {
  it("blocks group traffic when mention is required but missing", () => {
    const decision = evaluateRoute({
      claims: createClaims({ mentioned: false }),
      policy: {
        groupPolicy: "allowlist",
        groupAllowFrom: ["cid-1"],
        requireMention: true,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.matchedBy).toBe("mention-gate");
    expect(decision.reason).toContain("@");
  });

  it("returns pairing access for non-allowlisted direct messages", () => {
    const decision = evaluateRoute({
      claims: createClaims({
        chatType: "direct",
        conversationId: null,
        groups: [],
        mentioned: false,
        scenario: {
          chatType: "direct",
          groupTags: [],
          mentioned: false,
          isAdminContext: false,
          isDirect: true,
          requestIntent: "general",
          language: "zh-CN",
          contentPreview: "帮我查一下流程",
        },
      }),
      policy: {
        dmPolicy: "pairing",
        allowFrom: ["staff-2"],
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.access).toBe("pairing");
  });

  it("computes tool policy and approval requirement for browser automation", () => {
    const claims = createClaims();
    const route = evaluateRoute({
      claims,
      policy: {
        groupPolicy: "allowlist",
        groupAllowFrom: ["cid-1"],
        requireMention: false,
      },
    });
    const toolPolicy = evaluateToolPolicy({
      claims,
      requestedToolClasses: ["chat-only", "browser-automation"],
    });
    const approval = evaluateApprovalNeed({
      claims,
      route,
      toolPolicy,
    });

    expect(route.allowed).toBe(true);
    expect(toolPolicy.allowed).toBe(true);
    expect(toolPolicy.allowedToolClasses).toContain("browser-automation");
    expect(approval.required).toBe(true);
    expect(approval.level).toBe("L2");
  });
});
