/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { renderChannelAccountConfigForm, renderChannelConfigForm } from "./channels.config.ts";

function renderText(template: unknown): string {
  const container = document.createElement("div");
  render(template, container);
  return container.textContent ?? "";
}

describe("channel config form", () => {
  beforeEach(async () => {
    await i18n.setLocale("zh-CN");
  });

  it("hides instance-scoped accounts fields from channel config", () => {
    const text = renderText(
      renderChannelConfigForm({
        channelId: "dingtalk-connector",
        configValue: {
          channels: {
            "dingtalk-connector": {
              streamMode: "websocket",
              defaultAccount: "default",
              accounts: {
                default: {
                  clientId: "client-id",
                  clientSecret: "client-secret",
                },
              },
            },
          },
        },
        schema: {
          type: "object",
          properties: {
            channels: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  streamMode: { type: "string" },
                  defaultAccount: { type: "string" },
                  accounts: {
                    type: "object",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        clientId: { type: "string" },
                        clientSecret: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        uiHints: {},
        disabled: false,
        isSensitivePathRevealed: () => false,
        onToggleSensitivePath: () => undefined,
        onPatch: () => undefined,
      }),
    );

    expect(text).toContain("流式回复模式");
    expect(text).not.toContain("默认账号");
    expect(text).not.toContain("客户端 ID");
    expect(text).not.toContain("客户端密钥");
  });

  it("hides root credential fields for multi-instance channel configs", () => {
    const text = renderText(
      renderChannelConfigForm({
        channelId: "discord",
        configValue: {
          channels: {
            discord: {
              token: "bot-token",
              signingSecret: "signing-secret",
              accounts: {
                default: {
                  token: "instance-token",
                },
              },
            },
          },
        },
        schema: {
          type: "object",
          properties: {
            channels: {
              type: "object",
              properties: {
                discord: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    signingSecret: { type: "string" },
                    accounts: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          token: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        uiHints: {},
        disabled: false,
        isSensitivePathRevealed: () => false,
        onToggleSensitivePath: () => undefined,
        onPatch: () => undefined,
      }),
    );

    expect(text).not.toContain("Token");
    expect(text).not.toContain("Signing Secret");
  });

  it("coerces instance client secrets to plain text inputs even when schema is union-shaped", () => {
    const container = document.createElement("div");

    render(
      renderChannelAccountConfigForm({
        channelId: "dingtalk-connector",
        accountId: "default",
        value: {
          clientSecret: "client-secret",
        },
        configValue: {
          channels: {
            "dingtalk-connector": {
              accounts: {
                default: {
                  clientSecret: "client-secret",
                },
              },
            },
          },
        },
        schema: {
          type: "object",
          properties: {
            channels: {
              type: "object",
              properties: {
                "dingtalk-connector": {
                  type: "object",
                  properties: {
                    accounts: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          clientSecret: {
                            oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        uiHints: {},
        disabled: false,
        isSensitivePathRevealed: () => false,
        onToggleSensitivePath: () => undefined,
        onPatch: () => undefined,
      }),
      container,
    );

    const input = container.querySelector<HTMLInputElement>("input.cfg-input");
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea.cfg-textarea");

    expect(input?.value).toBe("client-secret");
    expect(textarea).toBeNull();
  });
});
