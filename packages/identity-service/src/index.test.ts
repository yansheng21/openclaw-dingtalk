import { describe, expect, it } from "vitest";
import { resolveSubjectClaims } from "./index.js";

describe("identity-service", () => {
  it("resolves enterprise claims from dingtalk ingress and policy defaults", () => {
    const claims = resolveSubjectClaims({
      ingress: {
        channel: "dingtalk-enterprise",
        accountId: "corp-a",
        webhookKind: "message",
        eventType: "chat_update_title",
        messageId: "msg-1",
        senderId: "user-1",
        staffId: "staff-1",
        senderName: "张三",
        conversationId: "cid-1",
        conversationTitle: "平台架构群",
        contentPreview: "线上日志告警需要排查",
        mentioned: true,
        receivedAt: 1_700_000_000_000,
      },
      policy: {
        defaultRoles: ["employee"],
        departmentHints: ["技术中心", "平台架构部"],
        toolScopes: ["chat.read", "browser.open"],
        approvalLevel: "L2",
        riskTier: "elevated",
      },
    });

    expect(claims.subjectId).toBe("dingtalk-enterprise:corp-a:staff-1");
    expect(claims.chatType).toBe("group");
    expect(claims.mentioned).toBe(true);
    expect(claims.roles).toContain("it_member");
    expect(claims.departments).toEqual(["技术中心", "平台架构部"]);
    expect(claims.toolScopes).toEqual(["chat.read", "browser.open"]);
    expect(claims.approvalLevel).toBe("L2");
    expect(claims.riskTier).toBe("elevated");
    expect(claims.requestIntent).toBe("it");
  });
});
