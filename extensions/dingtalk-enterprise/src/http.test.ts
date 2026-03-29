import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChannelActivity, resetChannelActivityForTest } from "openclaw/plugin-sdk/infra-runtime";
import {
  createDingTalkEnterpriseAdminHttpHandler,
  createDingTalkEnterpriseWebhookHttpHandler,
  previewDingTalkEnterpriseRuntime,
  resolveDingTalkEnterpriseWebhookRoutes,
} from "./http.js";

function createMockRequest(
  method: string,
  url: string,
  body?: unknown,
  options?: { headers?: Record<string, string>; remoteAddress?: string },
): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", {
    value: options?.remoteAddress ?? "127.0.0.1",
    configurable: true,
  });
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = {
    host: "localhost:3000",
    ...(body ? { "content-type": "application/json" } : {}),
    ...(options?.headers ?? {}),
  };

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", Buffer.from(JSON.stringify(body)));
    }
    req.emit("end");
  });

  return req;
}

function createMockResponse(): ServerResponse & {
  _getData: () => string;
  _getStatusCode: () => number;
} {
  const res = new ServerResponse({} as IncomingMessage);
  let data = "";
  let statusCode = 200;

  res.write = function (chunk: unknown) {
    data += String(chunk);
    return true;
  };

  res.end = function (chunk?: unknown) {
    if (chunk) {
      data += String(chunk);
    }
    return this;
  };

  Object.defineProperty(res, "statusCode", {
    get: () => statusCode,
    set: (code: number) => {
      statusCode = code;
    },
  });

  (res as unknown as { _getData: () => string })._getData = () => data;
  (res as unknown as { _getStatusCode: () => number })._getStatusCode = () => statusCode;
  return res as ServerResponse & { _getData: () => string; _getStatusCode: () => number };
}

describe("dingtalk-enterprise http handlers", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetChannelActivityForTest();
  });

  afterEach(() => {
    resetChannelActivityForTest();
  });

  it("lists configured accounts via the admin accounts route", async () => {
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () =>
        ({
          plugins: {
            entries: {
              "dingtalk-enterprise": {
                config: {
                  appKey: "ding-app",
                  appSecret: "ding-secret",
                  agentId: "10001",
                  callbackBaseUrl: "https://gateway.example.com",
                },
              },
            },
          },
        }) as never,
      logger,
    });
    const req = createMockRequest("GET", "/api/admin/connectors/dingtalk/accounts");
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.accounts).toHaveLength(1);
    expect(payload.accounts[0].accountId).toBe("default");
    expect(payload.accounts[0].messageCallbackUrl).toBe(
      "https://gateway.example.com/webhooks/dingtalk/messages",
    );
  });

  it("runs static tests from the admin test route", async () => {
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () =>
        ({
          plugins: {
            entries: {
              "dingtalk-enterprise": {
                config: {
                  accounts: {
                    corp: {
                      clientId: "cid",
                      clientSecret: "csecret",
                      agentId: "20002",
                    },
                  },
                },
              },
            },
          },
        }) as never,
      logger,
    });
    const req = createMockRequest("POST", "/api/admin/connectors/dingtalk/accounts/corp/test");
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.accountId).toBe("corp");
    expect(payload.probe.ok).toBe(true);
    expect(logger.info).toHaveBeenCalled();
  });

  it("stores account config under plugins.entries.dingtalk-enterprise.config", async () => {
    let currentConfig: any = {
      plugins: {
        allow: ["dingtalk-connector"],
        entries: {
          "dingtalk-enterprise": {
            config: {
              defaultAccount: "legacy",
              accounts: {
                legacy: {
                  clientId: "legacy-client",
                  clientSecret: "legacy-secret",
                  agentId: "legacy-agent",
                },
              },
            },
          },
        },
      },
    } as never;
    const writeConfig = vi.fn(async (nextConfig: unknown) => {
      currentConfig = nextConfig as never;
    });
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () => currentConfig,
      writeConfig,
      logger,
    });
    const req = createMockRequest("POST", "/api/admin/connectors/dingtalk/accounts", {
      accountId: "corp-a",
      clientId: "corp-client",
      clientSecret: "corp-secret",
      agentId: "corp-agent",
      callbackBaseUrl: "https://gateway.example.com",
      setAsDefault: true,
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(currentConfig.plugins.allow).toEqual(["dingtalk-connector", "dingtalk-enterprise"]);
    expect(currentConfig.plugins.entries["dingtalk-enterprise"]).toEqual(
      expect.objectContaining({
        enabled: true,
        config: expect.objectContaining({
          defaultAccount: "corp-a",
          accounts: expect.objectContaining({
            legacy: expect.objectContaining({
              clientId: "legacy-client",
            }),
            "corp-a": expect.objectContaining({
              clientId: "corp-client",
              clientSecret: "corp-secret",
              agentId: "corp-agent",
              callbackBaseUrl: "https://gateway.example.com",
            }),
          }),
        }),
      }),
    );
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.saved).toBe(true);
    expect(payload.account.accountId).toBe("corp-a");
    expect(payload.account.messageCallbackUrl).toBe(
      "https://gateway.example.com/webhooks/dingtalk/accounts/corp-a/messages",
    );
    expect(payload.defaultAccountId).toBe("corp-a");
    expect(payload.configLocation).toBe("plugins.entries.dingtalk-enterprise.config");
  });

  it("re-syncs webhook routes immediately after saving account config", async () => {
    let currentConfig: any = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {},
          },
        },
      },
    } as never;
    const writeConfig = vi.fn(async (nextConfig: unknown) => {
      currentConfig = nextConfig as never;
    });
    const syncWebhookRoutes = vi.fn();
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () => currentConfig,
      writeConfig,
      syncWebhookRoutes,
      logger,
    });
    const req = createMockRequest("POST", "/api/admin/connectors/dingtalk/accounts", {
      accountId: "corp-a",
      clientId: "corp-client",
      clientSecret: "corp-secret",
      agentId: "corp-agent",
      callbackBaseUrl: "https://gateway.example.com",
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    expect(syncWebhookRoutes).toHaveBeenCalledTimes(1);
    expect(syncWebhookRoutes).toHaveBeenCalledWith(currentConfig);
  });

  it("deletes stored accounts via the admin delete route", async () => {
    let currentConfig: any = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              defaultAccount: "corp-a",
              accounts: {
                "corp-a": {
                  clientId: "corp-client",
                  clientSecret: "corp-secret",
                  agentId: "corp-agent",
                },
                backup: {
                  clientId: "backup-client",
                  clientSecret: "backup-secret",
                  agentId: "backup-agent",
                },
              },
            },
          },
        },
      },
    } as never;
    const writeConfig = vi.fn(async (nextConfig: unknown) => {
      currentConfig = nextConfig as never;
    });
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () => currentConfig,
      writeConfig,
      logger,
    });
    const req = createMockRequest("DELETE", "/api/admin/connectors/dingtalk/accounts/corp-a");
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(currentConfig.plugins.entries["dingtalk-enterprise"]).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          defaultAccount: "backup",
          accounts: {
            backup: expect.objectContaining({
              clientId: "backup-client",
            }),
          },
        }),
      }),
    );
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.deleted).toBe(true);
    expect(payload.accountId).toBe("corp-a");
    expect(payload.defaultAccountId).toBe("backup");
  });

  it("re-syncs webhook routes immediately after deleting account config", async () => {
    let currentConfig: any = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              defaultAccount: "corp-a",
              accounts: {
                "corp-a": {
                  clientId: "corp-client",
                  clientSecret: "corp-secret",
                  agentId: "corp-agent",
                },
              },
            },
          },
        },
      },
    } as never;
    const writeConfig = vi.fn(async (nextConfig: unknown) => {
      currentConfig = nextConfig as never;
    });
    const syncWebhookRoutes = vi.fn();
    const handler = createDingTalkEnterpriseAdminHttpHandler({
      loadConfig: () => currentConfig,
      writeConfig,
      syncWebhookRoutes,
      logger,
    });
    const req = createMockRequest("DELETE", "/api/admin/connectors/dingtalk/accounts/corp-a");
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    expect(syncWebhookRoutes).toHaveBeenCalledTimes(1);
    expect(syncWebhookRoutes).toHaveBeenCalledWith(currentConfig);
  });

  it("accepts webhook callbacks and records inbound activity", async () => {
    const handler = createDingTalkEnterpriseWebhookHttpHandler({
      logger,
      route: {
        path: "/webhooks/dingtalk/messages",
        kind: "message",
        accountIdHint: "corp-a",
      },
      loadConfig: () =>
        ({
          plugins: {
            entries: {
              "dingtalk-enterprise": {
                config: {
                  accounts: {
                    "corp-a": {
                      groupPolicy: "allowlist",
                      groupAllowFrom: ["cid-1"],
                      requireMention: false,
                      toolScopes: ["chat.read"],
                    },
                  },
                },
              },
            },
          },
        }) as never,
    });
    const req = createMockRequest("POST", "/webhooks/dingtalk/messages", {
      EventType: "chat_update_title",
      msgId: "msg-1",
      senderStaffId: "staff-1",
      senderNick: "张三",
      conversationId: "cid-1",
      msgtype: "text",
      text: {
        content: "测试一下钉钉企业消息接入摘要能力",
      },
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.ok).toBe(true);
    expect(payload.kind).toBe("message");
    expect(payload.accountId).toBe("corp-a");
    expect(payload.eventType).toBe("chat_update_title");
    expect(payload.traceId).toBe("msg-1");
    expect(payload.summary).toEqual(
      expect.objectContaining({
        messageId: "msg-1",
        senderId: "staff-1",
        senderName: "张三",
        conversationId: "cid-1",
        messageType: "text",
        contentPreview: "测试一下钉钉企业消息接入摘要能力",
      }),
    );
    expect(payload.enterprise).toEqual(
      expect.objectContaining({
        accepted: true,
        claims: expect.objectContaining({
          subjectId: "dingtalk-enterprise:corp-a:staff-1",
          channel: "dingtalk-enterprise",
          accountId: "corp-a",
        }),
        route: expect.objectContaining({
          allowed: true,
          route: "general-agent",
        }),
        approval: expect.objectContaining({
          required: false,
        }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "dingtalk-enterprise: webhook message received",
      expect.objectContaining({
        accountId: "corp-a",
        eventType: "chat_update_title",
        traceId: "msg-1",
        summary: expect.objectContaining({
          messageId: "msg-1",
          senderId: "staff-1",
        }),
        enterprise: expect.objectContaining({
          accepted: true,
          route: "general-agent",
        }),
      }),
    );
    expect(
      getChannelActivity({ channel: "dingtalk-enterprise", accountId: "corp-a" }).inboundAt,
    ).not.toBeNull();
  });

  it("builds enterprise runtime previews from webhook-like payloads", () => {
    const preview = previewDingTalkEnterpriseRuntime({
      cfg: {
        plugins: {
          entries: {
            "dingtalk-enterprise": {
              config: {
                accounts: {
                  "corp-a": {
                    dmPolicy: "open",
                    toolScopes: ["browser.open", "oa.submit.leave"],
                    approvalLevel: "L1",
                    riskTier: "normal",
                  },
                },
              },
            },
          },
        },
      } as never,
      kind: "card",
      accountId: "corp-a",
      body: {
        EventId: "evt-1",
        userId: "staff-1",
        userName: "张三",
        title: "请代我提交发布审批",
      },
      receivedAt: 1_700_000_000_000,
    });

    expect(preview.claims.subjectId).toBe("dingtalk-enterprise:corp-a:staff-1");
    expect(preview.route.route).toBe("approval-agent");
    expect(preview.toolPolicy.allowedToolClasses).toContain("browser-automation");
    expect(preview.approval.required).toBe(true);
    expect(preview.auditEvent.outcome).toBe("pending-approval");
  });

  it("derives webhook route definitions from configured callback paths", () => {
    const routes = resolveDingTalkEnterpriseWebhookRoutes({
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              accounts: {
                corp: {
                  messageCallbackPath: "/hook/dingtalk/messages",
                  cardCallbackPath: "/hook/dingtalk/cards",
                  oaCallbackPath: "/hook/dingtalk/oa",
                },
              },
            },
          },
        },
      },
    } as never);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/hook/dingtalk/messages", kind: "message" }),
        expect.objectContaining({ path: "/hook/dingtalk/cards", kind: "card" }),
        expect.objectContaining({ path: "/hook/dingtalk/oa", kind: "oa" }),
      ]),
    );
  });

  it("derives account-scoped callback routes for non-default accounts to avoid path collisions", () => {
    const routes = resolveDingTalkEnterpriseWebhookRoutes({
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              accounts: {
                "corp-a": {
                  clientId: "corp-client",
                  clientSecret: "corp-secret",
                  agentId: "corp-agent",
                },
                "corp-b": {
                  clientId: "corp-client-b",
                  clientSecret: "corp-secret-b",
                  agentId: "corp-agent-b",
                  messageCallbackPath: "/webhooks/dingtalk/messages",
                },
              },
            },
          },
        },
      },
    } as never);

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/webhooks/dingtalk/accounts/corp-a/messages",
          kind: "message",
          accountIdHint: "corp-a",
        }),
        expect.objectContaining({
          path: "/webhooks/dingtalk/accounts/corp-a/cards/actions",
          kind: "card",
          accountIdHint: "corp-a",
        }),
        expect.objectContaining({
          path: "/webhooks/dingtalk/accounts/corp-a/oa/events",
          kind: "oa",
          accountIdHint: "corp-a",
        }),
        expect.objectContaining({
          path: "/webhooks/dingtalk/accounts/corp-b/messages",
          kind: "message",
          accountIdHint: "corp-b",
        }),
      ]),
    );
  });
});
