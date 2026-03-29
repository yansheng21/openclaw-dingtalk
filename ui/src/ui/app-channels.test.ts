import { describe, expect, it, vi } from "vitest";
import {
  openGenericChannelAccountEditor,
  previewDingTalkPolicyForApp,
  saveGenericChannelAccountEditor,
  updateGenericChannelAccountEditorAccountId,
} from "./app-channels.ts";
import type { OpenClawApp } from "./app.ts";
import type { DingTalkPreviewResult } from "./controllers/channels.ts";

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
  const request = vi.fn().mockResolvedValue(createPreviewResult());
  return {
    host: {
      client: {
        request,
      },
      connected: true,
      dingtalkPreviewLoading: false,
      dingtalkPreviewResult: null,
      channelsError: null,
    } as unknown as OpenClawApp,
    request,
  };
}

describe("previewDingTalkPolicyForApp", () => {
  it("builds direct-message preview payloads with an explicit direct chat type", async () => {
    const { host, request } = createHost();

    await previewDingTalkPolicyForApp(host, "corp-main", "direct");

    expect(request).toHaveBeenCalledWith(
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
    const { host, request } = createHost();

    await previewDingTalkPolicyForApp(host, "corp-main", "groupMention");

    expect(request).toHaveBeenCalledWith(
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

  it("prepares an agent draft for create mode and follows account id changes", () => {
    const host = {
      configForm: {
        agents: {
          defaults: {
            workspace: "/tmp/workspace",
          },
        },
      },
      configSnapshot: null,
      configSchema: null,
      connected: false,
      client: null,
      channelsSelectedId: null,
      channelsSelectedAccountId: null,
      genericChannelAccountEditor: null,
      channelsRevealedSensitivePaths: new Set(),
    } as unknown as OpenClawApp;

    openGenericChannelAccountEditor(host, "dingtalk-connector", "create");
    updateGenericChannelAccountEditorAccountId(host, "xiaolong");

    expect(host.genericChannelAccountEditor?.agentDraft?.enabled).toBe(true);
    expect(host.genericChannelAccountEditor?.agentDraft?.id).toBe("xiaolong");
    expect(host.genericChannelAccountEditor?.agentDraft?.workspace).toBe("/tmp/workspace-xiaolong");
  });
});

describe("saveGenericChannelAccountEditor", () => {
  it("blocks create-agent saves before persisting when the gateway is disconnected", async () => {
    const host = {
      client: null,
      connected: false,
      configForm: {
        channels: {},
      },
      configSnapshot: null,
      configSchema: null,
      genericChannelAccountEditor: {
        channelId: "dingtalk-connector",
        mode: "create",
        originalAccountId: null,
        accountId: "xiaolong",
        setAsDefault: false,
        values: {},
        agentDraft: {
          enabled: true,
          id: "xiaolong",
          name: "小龙",
          workspace: "/tmp/workspace-xiaolong",
          autoId: true,
          autoName: true,
          autoWorkspace: true,
        },
        saving: false,
        error: null,
      },
    } as unknown as OpenClawApp;

    await saveGenericChannelAccountEditor(host, {
      createAgent: {
        id: "xiaolong",
        name: "小龙",
        workspace: "/tmp/workspace-xiaolong",
      },
    });

    expect(host.genericChannelAccountEditor?.error).toContain("当前未连接网关");
    expect(host.genericChannelAccountEditor?.saving).toBe(false);
  });
});
