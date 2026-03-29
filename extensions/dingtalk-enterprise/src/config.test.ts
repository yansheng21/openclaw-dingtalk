import { describe, expect, it } from "vitest";
import {
  listDingTalkEnterpriseAccountIds,
  resolveDefaultDingTalkEnterpriseAccountId,
  resolveDingTalkEnterpriseAccount,
} from "./config.js";
import { probeDingTalkEnterpriseAccount } from "./probe.js";

describe("dingtalk-enterprise config", () => {
  it("reads plugin config from plugins.entries and exposes generated callback urls", () => {
    const cfg = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              name: "总部钉钉",
              appKey: "ding-app-key",
              appSecret: "ding-app-secret",
              agentId: "123456",
              callbackBaseUrl: "https://gateway.example.com/",
            },
          },
        },
      },
    };

    const account = resolveDingTalkEnterpriseAccount(cfg as never);

    expect(account.accountId).toBe("default");
    expect(account.enabled).toBe(true);
    expect(account.configured).toBe(true);
    expect(account.credentialMode).toBe("appSecret");
    expect(account.callbacks.baseUrl).toBe("https://gateway.example.com/");
    expect(account.callbacks.message.path).toBe("/webhooks/dingtalk/messages");
    expect(account.callbacks.message.url).toBe("https://gateway.example.com/webhooks/dingtalk/messages");
    expect(account.callbacks.card.url).toBe("https://gateway.example.com/webhooks/dingtalk/cards/actions");
    expect(account.callbacks.oa.url).toBe("https://gateway.example.com/webhooks/dingtalk/oa/events");
  });

  it("merges named account overrides and resolves default account ids", () => {
    const cfg = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              defaultAccount: "branch",
              clientId: "root-client",
              clientSecret: "root-secret",
              agentId: "root-agent",
              dmPolicy: "pairing",
              groupPolicy: "allowlist",
              requireMention: true,
              toolScopes: ["chat.read"],
              accounts: {
                branch: {
                  name: "分部账号",
                  agentId: "branch-agent",
                  callbackBaseUrl: "https://branch.example.com",
                  allowFrom: ["staff-1"],
                  approvalLevel: "L2",
                },
              },
            },
          },
        },
      },
    };

    expect(listDingTalkEnterpriseAccountIds(cfg as never)).toEqual(["default", "branch"]);
    expect(resolveDefaultDingTalkEnterpriseAccountId(cfg as never)).toBe("branch");

    const account = resolveDingTalkEnterpriseAccount(cfg as never, "branch");
    expect(account.name).toBe("分部账号");
    expect(account.clientId).toBe("root-client");
    expect(account.clientSecret).toBe("root-secret");
    expect(account.agentId).toBe("branch-agent");
    expect(account.callbacks.message.url).toBe("https://branch.example.com/webhooks/dingtalk/messages");
    expect(account.dmPolicy).toBe("pairing");
    expect(account.groupPolicy).toBe("allowlist");
    expect(account.requireMention).toBe(true);
    expect(account.allowFrom).toEqual(["staff-1"]);
    expect(account.approvalLevel).toBe("L2");
  });

  it("returns a structured static probe when required fields are missing", async () => {
    const cfg = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              enabled: true,
              callbackBaseUrl: "https://gateway.example.com",
            },
          },
        },
      },
    };

    const account = resolveDingTalkEnterpriseAccount(cfg as never);
    const probe = await probeDingTalkEnterpriseAccount(account);

    expect(account.configured).toBe(false);
    expect(probe.ok).toBe(false);
    expect(probe.mode).toBe("static");
    expect(probe.error).toContain("缺少必填字段");
    expect(probe.missingRequired).toEqual(["appKey / clientId", "appSecret / clientSecret", "agentId"]);
    expect(probe.notes.some((entry) => entry.includes("本地静态探测"))).toBe(true);
  });

  it("merges knowledge-base sync defaults with account-level overrides", () => {
    const cfg = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              clientId: "root-client",
              clientSecret: "root-secret",
              agentId: "root-agent",
              knowledgeBaseSync: {
                enabled: true,
                operatorId: "union-root",
                targetAgentId: "kb-root",
                maxWorkspaces: 3,
              },
              accounts: {
                branch: {
                  agentId: "branch-agent",
                  knowledgeBaseSync: {
                    workspaceIds: ["ws-1", "ws-2"],
                    maxNodesPerWorkspace: 120,
                  },
                },
              },
            },
          },
        },
      },
    };

    const account = resolveDingTalkEnterpriseAccount(cfg as never, "branch");

    expect(account.knowledgeBaseSync).toEqual({
      enabled: true,
      operatorId: "union-root",
      targetAgentId: "kb-root",
      maxWorkspaces: 3,
      workspaceIds: ["ws-1", "ws-2"],
      maxNodesPerWorkspace: 120,
    });
  });
});
