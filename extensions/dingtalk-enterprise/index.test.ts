import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

const { registerPluginHttpRouteMock } = vi.hoisted(() => ({
  registerPluginHttpRouteMock: vi.fn(() => vi.fn()),
}));

vi.mock("openclaw/plugin-sdk/webhook-ingress", () => ({
  registerPluginHttpRoute: registerPluginHttpRouteMock,
}));

describe("dingtalk-enterprise plugin entry", () => {
  it("registers the channel, gateway test method, and http routes in full mode", async () => {
    const { default: plugin, dingtalkEnterprisePlugin } = await import("./index.js");
    const registerChannel = vi.fn();
    const registerGatewayMethod = vi.fn();
    const registerHttpRoute = vi.fn();
    const registerCli = vi.fn();
    const api = {
      runtime: {
        config: {
          loadConfig: vi.fn(() => ({})),
          writeConfigFile: vi.fn(),
        },
        logging: {
          getChildLogger: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
          })),
        },
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      registerChannel,
      registerGatewayMethod,
      registerHttpRoute,
      registerCli,
      registrationMode: "full",
    } as unknown as OpenClawPluginApi;

    plugin.register(api);

    expect(registerChannel).toHaveBeenCalledTimes(1);
    expect(registerChannel).toHaveBeenCalledWith({ plugin: dingtalkEnterprisePlugin });
    expect(registerGatewayMethod).toHaveBeenCalledTimes(4);
    expect(registerGatewayMethod).toHaveBeenCalledWith(
      "dingtalk-enterprise.test",
      expect.any(Function),
    );
    expect(registerGatewayMethod).toHaveBeenCalledWith(
      "dingtalk-enterprise.resolve-claims",
      expect.any(Function),
    );
    expect(registerGatewayMethod).toHaveBeenCalledWith(
      "dingtalk-enterprise.preview-policy",
      expect.any(Function),
    );
    expect(registerGatewayMethod).toHaveBeenCalledWith(
      "dingtalk-enterprise.kb.sync",
      expect.any(Function),
    );
    expect(registerCli).toHaveBeenCalledWith(expect.any(Function), {
      commands: ["dingtalk-enterprise"],
    });
    expect(registerHttpRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/admin/connectors/dingtalk",
        auth: "gateway",
        match: "prefix",
        handler: expect.any(Function),
      }),
    );
    expect(registerPluginHttpRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/webhooks/dingtalk/messages",
        auth: "plugin",
        handler: expect.any(Function),
        replaceExisting: true,
        pluginId: "dingtalk-enterprise",
      }),
    );
    expect(registerPluginHttpRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/webhooks/dingtalk/cards/actions",
        auth: "plugin",
        handler: expect.any(Function),
        replaceExisting: true,
        pluginId: "dingtalk-enterprise",
      }),
    );
    expect(registerPluginHttpRouteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/webhooks/dingtalk/oa/events",
        auth: "plugin",
        handler: expect.any(Function),
        replaceExisting: true,
        pluginId: "dingtalk-enterprise",
      }),
    );
  });
});
