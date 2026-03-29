import { describe, expect, it, vi } from "vitest";
import type { OpenClawApp } from "./app.ts";
import type { DingTalkPreviewResult } from "./controllers/channels.ts";
import { openGenericChannelAccountEditor, previewDingTalkPolicyForApp } from "./app-channels.ts";

function createPreviewResult(): DingTalkPreviewResult {
  return {
    accepted: true,
    claims: {
      channel: "dingtalk-enterprise",
      accountId: "corp-main",
      subjectId: "dingtalk-enterprise:corp-main:preview_user",
      displayName: "预览用户",
      conversationId: "preview_group_conv",
      chatType: "group",
      mentioned: true,
      riskTier: "normal",
    },
    route: {
      allowed: true,
      route: "general-agent",
      reason: "ok",
    },
    toolPolicy: {
      allowed: true,
      allowedToolClasses: ["browser-automation"],
      deniedToolClasses: [],
      reason: "ok",
    },
    approval: {
      required: false,
      level: "none",
      requestId: null,
    },
    auditEvent: {
      eventId: "evt-preview",
      outcome: "accepted",
      summary: "preview",
    },
  };
}

function createHost() {
  return {
    client: {
      request: vi.fn().mockResolvedValue(createPreviewResult()),
    },
    connected: true,
    dingtalkPreviewLoading: false,
    dingtalkPreviewResult: null,
    channelsError: null,
  } as unknown as OpenClawApp;
}

describe("previewDingTalkPolicyForApp", () => {
  it("builds direct-message preview payloads with an explicit direct chat type", async () => {
    const host = createHost();

    await previewDingTalkPolicyForApp(host, "corp-main", "direct");

    expect(host.client!.request).toHaveBeenCalledWith(
      "dingtalk-enterprise.preview-policy",
      expect.objectContaining({
        accountId: "corp-main",
        kind: "message",
        body: {
          senderStaffId: "preview_user",
          chatType: "direct",
          content: "预览消息内容",
        },
        timeoutMs: 8000,
      }),
    );
  });

  it("builds group-mention preview payloads with fields the backend actually recognizes", async () => {
    const host = createHost();

    await previewDingTalkPolicyForApp(host, "corp-main", "groupMention");

    expect(host.client!.request).toHaveBeenCalledWith(
      "dingtalk-enterprise.preview-policy",
      expect.objectContaining({
        accountId: "corp-main",
        kind: "message",
        body: {
          senderStaffId: "preview_user",
          chatType: "group",
          conversationId: "preview_group_conv",
          content: "@机器人 预览群消息",
          atUsers: ["robot_code"],
        },
        timeoutMs: 8000,
      }),
    );
  });
});

describe("openGenericChannelAccountEditor", () => {
  it("falls back to configSnapshot when configForm is not initialized", () => {
    const host = {
      configForm: null,
      configSnapshot: {
        config: {
          channels: {
            "dingtalk-connector": {
              defaultAccount: "default",
              accounts: {
                default: {
                  displayName: "小龙",
                  clientId: "snapshot-client-id",
                  dmPolicy: "pairing",
                },
              },
            },
          },
        },
      },
      configSchema: null,
      connected: false,
      client: null,
      channelsSelectedId: null,
      channelsSelectedAccountId: "__default__",
      genericChannelAccountEditor: null,
      channelsRevealedSensitivePaths: new Set(),
    } as unknown as OpenClawApp;

    openGenericChannelAccountEditor(host, "dingtalk-connector", "edit", "__default__");

    expect(host.genericChannelAccountEditor?.values.displayName).toBe("小龙");
    expect(host.genericChannelAccountEditor?.values.clientId).toBe("snapshot-client-id");
    expect(host.genericChannelAccountEditor?.values.dmPolicy).toBe("pairing");
    expect(host.genericChannelAccountEditor?.setAsDefault).toBe(true);
  });
});
