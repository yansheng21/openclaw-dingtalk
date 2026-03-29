/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n/index.ts";
import { analyzeConfigSchema, renderConfigForm, renderNode } from "./views/config-form.ts";

const rootSchema = {
  type: "object",
  properties: {
    gateway: {
      type: "object",
      properties: {
        auth: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    allowFrom: {
      type: "array",
      items: { type: "string" },
    },
    mode: {
      type: "string",
      enum: ["off", "token"],
    },
    enabled: {
      type: "boolean",
    },
    bind: {
      anyOf: [{ const: "auto" }, { const: "lan" }, { const: "tailnet" }, { const: "loopback" }],
    },
  },
};

describe("config form renderer", () => {
  beforeEach(async () => {
    await i18n.setLocale("en");
  });

  it("renders inputs and patches values", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { label: "Gateway Token", sensitive: true },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        revealSensitive: true,
        onPatch,
      }),
      container,
    );

    const tokenInput: HTMLInputElement | null = container.querySelector(
      '#config-section-gateway input.cfg-input[type="text"]',
    );
    expect(tokenInput).not.toBeNull();
    if (!tokenInput) {
      return;
    }
    tokenInput.value = "abc123";
    tokenInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["gateway", "auth", "token"], "abc123");

    const tokenButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-segmented__btn"),
    ).find((btn) => btn.textContent?.trim() === "token");
    expect(tokenButton).not.toBeUndefined();
    tokenButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["mode"], "token");

    const checkbox: HTMLInputElement | null = container.querySelector("input[type='checkbox']");
    expect(checkbox).not.toBeNull();
    if (!checkbox) {
      return;
    }
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["enabled"], true);
  });

  it("adds and removes array entries", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { allowFrom: ["+1"] },
        onPatch,
      }),
      container,
    );

    const addButton = container.querySelector(".cfg-array__add");
    expect(addButton).not.toBeUndefined();
    addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["allowFrom"], ["+1", ""]);

    const removeButton = container.querySelector(".cfg-array__item-remove");
    expect(removeButton).not.toBeUndefined();
    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["allowFrom"], []);
  });

  it("renders union literals as select options", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { bind: "auto" },
        onPatch,
      }),
      container,
    );

    const tailnetButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-segmented__btn"),
    ).find((btn) => btn.textContent?.trim() === "tailnet");
    expect(tailnetButton).not.toBeUndefined();
    tailnetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["bind"], "tailnet");
  });

  it("renders map fields from additionalProperties", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        slack: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { slack: { channelA: "ok" } },
        onPatch,
      }),
      container,
    );

    const removeButton = container.querySelector(".cfg-map__item-remove");
    expect(removeButton).not.toBeUndefined();
    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["slack"], {});
  });

  it("supports wildcard uiHints for map entries", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        plugins: {
          type: "object",
          properties: {
            entries: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "plugins.entries.*.enabled": { label: "Plugin Enabled" },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: { plugins: { entries: { "voice-call": { enabled: true } } } },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Plugin Enabled");
  });

  it("renders tags from uiHints metadata", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { tags: ["security", "secret"] },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        onPatch,
      }),
      container,
    );

    const tags = Array.from(container.querySelectorAll(".cfg-tag")).map((node) =>
      node.textContent?.trim(),
    );
    expect(tags).toContain("security");
    expect(tags).toContain("secret");
  });

  it("filters by tag query", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { tags: ["security"] },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        searchQuery: "tag:security",
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Gateway");
    expect(container.textContent).toContain("Token");
    expect(container.textContent).not.toContain("Allow From");
    expect(container.textContent).not.toContain("Mode");
  });

  it("does not treat plain text as tag filter", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { tags: ["security"] },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        searchQuery: "security",
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain('No settings match "security"');
  });

  it("requires both text and tag when combined", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const analysis = analyzeConfigSchema(rootSchema);
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { tags: ["security"] },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        searchQuery: "token tag:security",
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Token");
    expect(container.textContent).not.toContain('No settings match "token tag:security"');

    const noMatchContainer = document.createElement("div");
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "gateway.auth.token": { tags: ["security"] },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: {},
        searchQuery: "mode tag:security",
        onPatch,
      }),
      noMatchContainer,
    );
    expect(noMatchContainer.textContent).toContain('No settings match "mode tag:security"');
  });

  it("supports SecretInput unions in additionalProperties maps", () => {
    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        models: {
          type: "object",
          properties: {
            providers: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  apiKey: {
                    anyOf: [
                      { type: "string" },
                      {
                        oneOf: [
                          {
                            type: "object",
                            properties: {
                              source: { type: "string", const: "env" },
                              provider: { type: "string" },
                              id: { type: "string" },
                            },
                            required: ["source", "provider", "id"],
                            additionalProperties: false,
                          },
                          {
                            type: "object",
                            properties: {
                              source: { type: "string", const: "file" },
                              provider: { type: "string" },
                              id: { type: "string" },
                            },
                            required: ["source", "provider", "id"],
                            additionalProperties: false,
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("models.providers");
    expect(analysis.unsupportedPaths).not.toContain("models.providers.*.apiKey");

    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {
          "models.providers.*.apiKey": { sensitive: true },
        },
        unsupportedPaths: analysis.unsupportedPaths,
        value: { models: { providers: { openai: { apiKey: "old" } } } }, // pragma: allowlist secret
        revealSensitive: true,
        onPatch,
      }),
      container,
    );

    const apiKeyInput: HTMLInputElement | null = container.querySelector(
      "#config-section-models .cfg-map__item-value input.cfg-input[type='text']",
    );
    expect(apiKeyInput).not.toBeNull();
    if (!apiKeyInput) {
      return;
    }
    apiKeyInput.value = "new-key";
    apiKeyInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["models", "providers", "openai", "apiKey"], "new-key");
  });

  it("accepts renderable unions", () => {
    const schema = {
      type: "object",
      properties: {
        mixed: {
          anyOf: [{ type: "string" }, { type: "object", properties: {} }],
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("mixed");
  });

  it("renders model field labels with clearer Chinese copy", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        models: {
          type: "object",
          properties: {
            providers: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  baseUrl: { type: "string" },
                  api: { type: "string" },
                  models: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        contextWindow: { type: "number" },
                        maxTokens: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        agents: {
          type: "object",
          properties: {
            defaults: {
              type: "object",
              properties: {
                model: {
                  type: "object",
                  properties: {
                    primary: { type: "string" },
                    fallbacks: { type: "array", items: { type: "string" } },
                  },
                },
                models: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      params: {
                        type: "object",
                        properties: {
                          reasoningEffort: { type: "string" },
                        },
                      },
                    },
                  },
                },
                thinkingDefault: { type: "string" },
              },
            },
          },
        },
        tools: {
          type: "object",
          properties: {
            exec: {
              type: "object",
              properties: {
                applyPatch: {
                  type: "object",
                  properties: {
                    allowModels: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);

    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: {
          models: {
            providers: {
              relay: {
                baseUrl: "https://api.xairouter.com/v1",
                api: "openai-completions",
                models: [{ id: "gpt-5.4", contextWindow: 16000, maxTokens: 4096 }],
              },
            },
          },
          agents: {
            defaults: {
              model: {
                primary: "relay/gpt-5.4",
                fallbacks: ["relay/gpt-5.4-mini"],
              },
              models: {
                "relay/gpt-5.4": {
                  params: { reasoningEffort: "xhigh" },
                },
              },
              thinkingDefault: "xhigh",
            },
          },
          tools: {
            exec: {
              applyPatch: {
                allowModels: ["relay/gpt-5.4"],
              },
            },
          },
        },
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("主模型");
    expect(container.textContent).toContain("回退模型");
    expect(container.textContent).toContain("默认推理强度");
    expect(container.textContent).toContain("允许 apply_patch 的模型");
    expect(container.textContent).toContain("上下文窗口");
  });

  it("supports nullable types", () => {
    const schema = {
      type: "object",
      properties: {
        note: { type: ["string", "null"] },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("note");
  });

  it("ignores untyped additionalProperties schemas", () => {
    const schema = {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: {
            whatsapp: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
              },
            },
          },
          additionalProperties: {},
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("channels");
  });

  it("treats additionalProperties true as editable map fields", () => {
    const schema = {
      type: "object",
      properties: {
        accounts: {
          type: "object",
          additionalProperties: true,
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);
    expect(analysis.unsupportedPaths).not.toContain("accounts");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { accounts: { default: { enabled: true } } },
        onPatch,
      }),
      container,
    );

    const removeButton = container.querySelector(".cfg-map__item-remove");
    expect(removeButton).not.toBeNull();
    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPatch).toHaveBeenCalledWith(["accounts"], {});
  });

  it("renders config form chrome in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        gateway: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
        allowFrom: {
          type: "array",
          items: { type: "string" },
        },
        slack: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);

    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { allowFrom: [], slack: {} },
        activeSection: "gateway",
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("令牌");
    expect(container.textContent).not.toContain("网关服务、端口、认证与绑定设置。");

    const chromeContainer = document.createElement("div");
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { allowFrom: [], slack: {} },
        onPatch,
      }),
      chromeContainer,
    );

    expect(chromeContainer.textContent).toContain("0 项");
    expect(chromeContainer.textContent).toContain("添加");
    expect(chromeContainer.textContent).toContain("自定义条目");
    expect(chromeContainer.textContent).toContain("暂无自定义条目。");
  });

  it("groups common gateway settings into guided cards", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    const schema = {
      type: "object",
      properties: {
        gateway: {
          type: "object",
          properties: {
            controlUi: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
              },
            },
            auth: {
              type: "object",
              properties: {
                token: { type: "string" },
              },
            },
            port: { type: "number" },
            tls: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
              },
            },
          },
        },
      },
    };
    const analysis = analyzeConfigSchema(schema);

    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { gateway: { port: 8080 } },
        activeSection: "gateway",
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("访问与控制台");
    expect(container.textContent).toContain("运行与网络");
    expect(container.textContent).toContain("控制台界面");
    expect(container.textContent).toContain("网关认证");
    expect(container.textContent).toContain("网关端口");
    expect(container.querySelectorAll(".config-subsection-card").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps english help visible when chinese override is missing", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "string",
          title: "Custom Field",
          description: "Use this field to tune an experimental runtime flag.",
        },
        value: "",
        path: ["custom", "flag"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("Use this field to tune an experimental runtime flag.");
  });

  it("marks json fallback fields as advanced config", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          anyOf: [{ type: "string" }, { type: "object", properties: {} }],
          title: "Mixed Config",
        },
        value: { enabled: true },
        path: ["mixed"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.querySelector(".cfg-field--advanced")).not.toBeNull();
    expect(container.textContent).toContain("高级字段");
  });

  it("localizes wildcard channel policy fields in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "string",
          enum: ["pairing", "allowlist", "open", "disabled"],
        },
        value: "pairing",
        path: ["channels", "discord", "dmPolicy"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("私信接入策略");
    expect(container.textContent).toContain("配对后允许");
    expect(container.textContent).toContain("白名单");
    expect(container.textContent).toContain("开放");
    expect(container.textContent).toContain("禁用");
  });

  it("localizes wildcard account secrets and redacted guidance in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "string",
        },
        value: "stored-secret",
        path: ["channels", "dingtalk-enterprise", "accounts", "default", "clientSecret"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("客户端密钥");
    expect(container.textContent).toContain("该值会在本地控制台中直接显示");

    const input = container.querySelector<HTMLInputElement>("input.cfg-input");
    expect(input).not.toBeNull();
    expect(input?.placeholder).toContain("敏感值已隐藏");
    expect(input?.readOnly).toBe(true);
  });

  it("localizes account allowFrom fields in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "array",
          items: { type: "string" },
        },
        value: ["staff_1"],
        path: ["channels", "dingtalk-connector", "accounts", "default", "allowFrom"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("允许来源");
    expect(container.textContent).not.toContain("Allow From");
  });

  it("does not expose redacted sentinel values when a sensitive field is revealed", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "string",
        },
        value: "__OPENCLAW_REDACTED__",
        path: ["channels", "dingtalk-connector", "accounts", "default", "clientSecret"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        isSensitivePathRevealed: () => true,
        onToggleSensitivePath: () => undefined,
        onPatch,
      }),
      container,
    );

    const input = container.querySelector<HTMLInputElement>("input.cfg-input");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("");
    expect(input?.readOnly).toBe(false);
    expect(input?.placeholder).toContain("已有值已隐藏");
    expect(container.textContent ?? "").not.toContain("__OPENCLAW_REDACTED__");
  });

  it("localizes deep nested conversation fields in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const onPatch = vi.fn();
    const container = document.createElement("div");
    render(
      renderNode({
        schema: {
          type: "object",
          properties: {
            requireMention: { type: "boolean" },
            resolveSenderNames: { type: "boolean" },
            separateSessionByConversation: { type: "boolean" },
            sharedMemoryAcrossConversations: { type: "boolean" },
          },
        },
        value: {
          requireMention: true,
          resolveSenderNames: true,
          separateSessionByConversation: true,
          sharedMemoryAcrossConversations: false,
        },
        path: ["channels", "telegram", "groups", "*"],
        hints: {},
        unsupported: new Set(),
        disabled: false,
        onPatch,
      }),
      container,
    );

    expect(container.textContent).toContain("必须 @ 机器人");
    expect(container.textContent).toContain("解析发送者名称");
    expect(container.textContent).toContain("按会话分别建上下文");
    expect(container.textContent).toContain("跨会话共享记忆");
    expect(container.textContent).not.toContain("Resolve Sender 名称s");
    expect(container.textContent).not.toContain("Separate 会话 By Conversation");
  });
});
