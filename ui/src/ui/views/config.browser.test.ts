/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import type { ThemeMode, ThemeName } from "../theme.ts";
import { renderConfig, resetConfigViewStateForTests } from "./config.ts";

describe("config view", () => {
  beforeEach(async () => {
    resetConfigViewStateForTests();
    await i18n.setLocale("en");
  });

  const baseProps = () => ({
    raw: "{\n}\n",
    originalRaw: "{\n}\n",
    valid: true,
    issues: [],
    loading: false,
    saving: false,
    applying: false,
    updating: false,
    connected: true,
    schema: {
      type: "object",
      properties: {},
    },
    schemaLoading: false,
    uiHints: {},
    formMode: "form" as const,
    showModeToggle: true,
    formValue: {},
    originalValue: {},
    searchQuery: "",
    activeSection: null,
    activeSubsection: null,
    onRawChange: vi.fn(),
    onFormModeChange: vi.fn(),
    onFormPatch: vi.fn(),
    onSearchChange: vi.fn(),
    onSectionChange: vi.fn(),
    onReload: vi.fn(),
    onSave: vi.fn(),
    onApply: vi.fn(),
    onUpdate: vi.fn(),
    onSubsectionChange: vi.fn(),
    version: "2026.3.11",
    theme: "claw" as ThemeName,
    themeMode: "system" as ThemeMode,
    setTheme: vi.fn(),
    setThemeMode: vi.fn(),
    borderRadius: 50,
    setBorderRadius: vi.fn(),
    gatewayUrl: "",
    assistantName: "OpenClaw",
    locale: "en",
  });

  function createModelConfigSchema() {
    return {
      type: "object",
      properties: {
        models: {
          type: "object",
          properties: {
            mode: { type: "string" },
            providers: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  baseUrl: { type: "string" },
                  apiKey: { type: "string" },
                  api: { type: "string" },
                  models: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        reasoning: { type: "boolean" },
                        input: { type: "array", items: { type: "string" } },
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
            profile: { type: "string" },
            exec: {
              type: "object",
              properties: {
                security: { type: "string" },
                ask: { type: "string" },
                applyPatch: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    workspaceOnly: { type: "boolean" },
                    allowModels: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  function findActionButtons(container: HTMLElement): {
    saveButton?: HTMLButtonElement;
    applyButton?: HTMLButtonElement;
  } {
    const buttons = Array.from(container.querySelectorAll("button"));
    return {
      saveButton: buttons.find((btn) => btn.textContent?.trim() === "Save"),
      applyButton: buttons.find((btn) => btn.textContent?.trim() === "Apply"),
    };
  }

  it("allows save when form is unsafe", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        schema: {
          type: "object",
          properties: {
            mixed: {
              anyOf: [{ type: "string" }, { type: "object", properties: {} }],
            },
          },
        },
        schemaLoading: false,
        uiHints: {},
        formMode: "form",
        formValue: { mixed: "x" },
      }),
      container,
    );

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Save",
    );
    expect(saveButton).not.toBeUndefined();
    expect(saveButton?.disabled).toBe(false);
  });

  it("disables save when schema is missing", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        schema: null,
        formMode: "form",
        formValue: { gateway: { mode: "local" } },
        originalValue: {},
      }),
      container,
    );

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Save",
    );
    expect(saveButton).not.toBeUndefined();
    expect(saveButton?.disabled).toBe(true);
  });

  it("disables save and apply when raw is unchanged", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        formMode: "raw",
        raw: "{\n}\n",
        originalRaw: "{\n}\n",
      }),
      container,
    );

    const { saveButton, applyButton } = findActionButtons(container);
    expect(saveButton).not.toBeUndefined();
    expect(applyButton).not.toBeUndefined();
    expect(saveButton?.disabled).toBe(true);
    expect(applyButton?.disabled).toBe(true);
  });

  it("enables save and apply when raw changes", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        formMode: "raw",
        raw: '{\n  gateway: { mode: "local" }\n}\n',
        originalRaw: "{\n}\n",
      }),
      container,
    );

    const { saveButton, applyButton } = findActionButtons(container);
    expect(saveButton).not.toBeUndefined();
    expect(applyButton).not.toBeUndefined();
    expect(saveButton?.disabled).toBe(false);
    expect(applyButton?.disabled).toBe(false);
  });

  it("switches mode via the sidebar toggle", () => {
    const container = document.createElement("div");
    const onFormModeChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        onFormModeChange,
      }),
      container,
    );

    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Raw",
    );
    expect(btn).toBeTruthy();
    btn?.click();
    expect(onFormModeChange).toHaveBeenCalledWith("raw");
  });

  it("switches sections from the sidebar", () => {
    const container = document.createElement("div");
    const onSectionChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        onSectionChange,
        schema: {
          type: "object",
          properties: {
            gateway: { type: "object", properties: {} },
            agents: { type: "object", properties: {} },
          },
        },
      }),
      container,
    );

    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Gateway",
    );
    expect(btn).toBeTruthy();
    btn?.click();
    expect(onSectionChange).toHaveBeenCalledWith("gateway");
  });

  it("wires search input to onSearchChange", () => {
    const container = document.createElement("div");
    const onSearchChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        onSearchChange,
      }),
      container,
    );

    const input = container.querySelector(".config-search__input");
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }
    (input as HTMLInputElement).value = "gateway";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onSearchChange).toHaveBeenCalledWith("gateway");
  });

  it("renders the top search icon inside the search input row", () => {
    const container = document.createElement("div");
    render(renderConfig(baseProps()), container);

    const icon = container.querySelector<SVGElement>(".config-search__icon");
    expect(icon).not.toBeNull();
    expect(icon?.closest(".config-search__input-row")).not.toBeNull();
  });

  it("renders a config header summary and search hint", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        schema: {
          type: "object",
          properties: {
            gateway: { type: "object", properties: {} },
          },
        },
        formValue: { gateway: { mode: "local" } },
        originalValue: {},
      }),
      container,
    );

    expect(container.querySelector(".config-header__title")?.textContent?.trim()).toBe("Settings");
    expect(container.textContent).toContain("Manage settings by section.");
    expect(container.textContent).toContain("1 pending");
    expect(container.textContent).toContain("Search by keyword or tag:security");
    expect(container.textContent).toContain("Not set");
  });

  it("renders a model relationship overview inside the models section", () => {
    const container = document.createElement("div");
    const onFormPatch = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        activeSection: "models",
        showRootOverview: true,
        onFormPatch,
        schema: createModelConfigSchema(),
        formValue: {
          models: {
            mode: "merge",
            providers: {
              relay: {
                baseUrl: "https://api.xairouter.com/v1",
                apiKey: "sk-test-1234",
                api: "openai-completions",
                models: [
                  {
                    id: "gpt-5.4",
                    name: "gpt-5.4 (xairouter)",
                    reasoning: true,
                    input: ["text"],
                    contextWindow: 16000,
                    maxTokens: 4096,
                  },
                  {
                    id: "gpt-5.4-mini",
                    name: "gpt-5.4 mini",
                    reasoning: true,
                    input: ["text"],
                    contextWindow: 8000,
                    maxTokens: 2048,
                  },
                ],
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
                  params: {
                    reasoningEffort: "xhigh",
                  },
                },
                "relay/gpt-5.4-mini": {
                  params: {
                    reasoningEffort: "high",
                  },
                },
              },
              thinkingDefault: "xhigh",
            },
          },
          tools: {
            profile: "full",
            exec: {
              security: "full",
              ask: "off",
              applyPatch: {
                enabled: true,
                workspaceOnly: false,
                allowModels: ["gpt-5.4-mini", "relay/gpt-5.4"],
              },
            },
          },
        },
        originalValue: {
          models: {},
        },
      }),
      container,
    );

    expect(container.querySelector(".config-models-workspace")).not.toBeNull();
    expect(container.querySelector('[data-model-ref="relay/gpt-5.4"]')).not.toBeNull();
    expect(container.querySelector('[data-model-ref="relay/gpt-5.4-mini"]')).not.toBeNull();
    expect(container.textContent).toContain("Providers and Models");
    expect(container.textContent).toContain("Full access");
    expect(container.textContent).toContain("gpt-5.4 mini");
    expect(container.textContent).toContain("relay");
    expect(Array.from(container.querySelectorAll(".config-models-editor-table th")).map((entry) => entry.textContent?.trim())).toEqual([
      "Name",
      "API key",
      "API URL",
      "Model",
      "Reasoning",
      "Actions",
    ]);

    expect(container.querySelector('[data-model-name="relay:0"]')).toBeNull();

    const editModelButton = container.querySelector<HTMLButtonElement>('[data-edit-model="relay:0"]');
    expect(editModelButton).not.toBeNull();
    editModelButton?.click();

    const editModelDialog = container.querySelector<HTMLDialogElement>('[data-model-dialog="edit:relay:0"]');
    expect(editModelDialog).not.toBeNull();
    expect(editModelDialog?.hasAttribute("open")).toBe(true);

    const editModelNameInput = editModelDialog?.querySelector<HTMLInputElement>("[data-model-dialog-name]");
    expect(editModelNameInput?.value).toBe("gpt-5.4 (xairouter)");
    if (!editModelNameInput) {
      return;
    }
    editModelNameInput.value = "Primary model";
    editModelNameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const editModelForm = editModelDialog?.querySelector<HTMLFormElement>("form");
    expect(editModelForm).not.toBeNull();
    editModelForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onFormPatch).toHaveBeenCalledWith(
      ["models", "providers", "relay", "models", 0, "name"],
      "Primary model",
    );
    onFormPatch.mockClear();

    const addModelButton = container.querySelector<HTMLButtonElement>('[data-add-model="relay"]');
    expect(addModelButton).not.toBeNull();
    addModelButton?.click();

    const addModelDialog = container.querySelector<HTMLDialogElement>('[data-model-dialog="add:relay"]');
    expect(addModelDialog).not.toBeNull();
    expect(addModelDialog?.hasAttribute("open")).toBe(true);

    const addModelIdInput = addModelDialog?.querySelector<HTMLInputElement>("[data-model-dialog-id]");
    expect(addModelIdInput).not.toBeNull();
    if (!addModelIdInput) {
      return;
    }
    addModelIdInput.value = "gpt-5.4-nano";
    addModelIdInput.dispatchEvent(new Event("input", { bubbles: true }));

    const addModelNameInput = addModelDialog?.querySelector<HTMLInputElement>("[data-model-dialog-name]");
    expect(addModelNameInput).not.toBeNull();
    if (!addModelNameInput) {
      return;
    }
    addModelNameInput.value = "gpt-5.4 nano";
    addModelNameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const addModelApiKeyInput = addModelDialog?.querySelector<HTMLInputElement>("[data-model-dialog-api-key]");
    expect(addModelApiKeyInput).not.toBeNull();
    if (!addModelApiKeyInput) {
      return;
    }
    addModelApiKeyInput.value = "sk-new-9999";
    addModelApiKeyInput.dispatchEvent(new Event("input", { bubbles: true }));

    const addModelEndpointInput = addModelDialog?.querySelector<HTMLInputElement>("[data-model-dialog-endpoint]");
    expect(addModelEndpointInput).not.toBeNull();
    if (!addModelEndpointInput) {
      return;
    }
    addModelEndpointInput.value = "https://api.openrouter.example/v1";
    addModelEndpointInput.dispatchEvent(new Event("input", { bubbles: true }));

    const addModelReasoningSelect = addModelDialog?.querySelector<HTMLSelectElement>("[data-model-dialog-reasoning]");
    expect(addModelReasoningSelect).not.toBeNull();
    if (!addModelReasoningSelect) {
      return;
    }
    addModelReasoningSelect.value = "medium";
    addModelReasoningSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const addModelForm = addModelDialog?.querySelector<HTMLFormElement>("form");
    expect(addModelForm).not.toBeNull();
    addModelForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onFormPatch).toHaveBeenCalledWith(
      ["models", "providers", "relay", "apiKey"],
      "sk-new-9999",
    );
    expect(onFormPatch).toHaveBeenCalledWith(
      ["models", "providers", "relay", "baseUrl"],
      "https://api.openrouter.example/v1",
    );
    expect(onFormPatch).toHaveBeenCalledWith(
      ["models", "providers", "relay", "models"],
      [
        {
          id: "gpt-5.4",
          name: "gpt-5.4 (xairouter)",
          reasoning: true,
          input: ["text"],
          contextWindow: 16000,
          maxTokens: 4096,
        },
        {
          id: "gpt-5.4-mini",
          name: "gpt-5.4 mini",
          reasoning: true,
          input: ["text"],
          contextWindow: 8000,
          maxTokens: 2048,
        },
        {
          id: "gpt-5.4-nano",
          name: "gpt-5.4 nano",
        },
      ],
    );
    expect(onFormPatch).toHaveBeenCalledWith(
      ["agents", "defaults", "models"],
      {
        "relay/gpt-5.4": {
          params: {
            reasoningEffort: "xhigh",
          },
        },
        "relay/gpt-5.4-mini": {
          params: {
            reasoningEffort: "high",
          },
        },
        "relay/gpt-5.4-nano": {
          params: {
            reasoningEffort: "medium",
          },
        },
      },
    );
  });

  it("renders a back-to-overview action for focused sections", () => {
    const container = document.createElement("div");
    const onSectionChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        activeSection: "models",
        showRootOverview: true,
        onSectionChange,
        schema: createModelConfigSchema(),
        formValue: {
          models: {
            providers: {
              relay: {
                models: [{ id: "gpt-5.4" }],
              },
            },
          },
        },
      }),
      container,
    );

    const backButton = container.querySelector<HTMLButtonElement>("[data-config-back]");
    expect(backButton).not.toBeNull();
    backButton?.click();
    expect(onSectionChange).toHaveBeenCalledWith(null);
  });

  it("renders compact overview cards on the config root", () => {
    const container = document.createElement("div");
    const onOverviewSectionOpen = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        showRootOverview: true,
        onOverviewSectionOpen,
        schema: createModelConfigSchema(),
        formValue: {
          models: {
            mode: "merge",
            providers: {
              relay: {
                models: [{ id: "gpt-5.4" }],
              },
            },
          },
          agents: {
            list: [
              { id: "main", name: "默认助手", default: true },
              { id: "xiaolong", name: "小龙" },
            ],
            defaults: {
              model: { primary: "relay/gpt-5.4" },
              workspace: "/Users/real/.openclaw/workspace",
              thinkingDefault: "xhigh",
            },
          },
          browser: {
            enabled: true,
            executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            defaultProfile: "openclaw",
          },
          gateway: {
            port: 18789,
            mode: "local",
            bind: "loopback",
            auth: { mode: "token" },
          },
          channels: {
            "dingtalk-connector": {
              enabled: true,
              accounts: {
                fengqingxia: {},
                xiaolong: {},
              },
            },
          },
          tools: {
            profile: "full",
            exec: {
              host: "gateway",
              security: "full",
              ask: "off",
              applyPatch: {
                enabled: true,
                allowModels: ["gpt-5.4", "relay/gpt-5.4"],
              },
            },
          },
        },
        originalValue: {},
      }),
      container,
    );

    expect(container.querySelector(".config-overview")).not.toBeNull();
    expect(container.textContent).toContain("配置速览");
    expect(container.textContent).toContain("代理");
    expect(container.textContent).toContain("钉钉");
    expect(container.textContent).toContain("2 个账号");

    const agentCard = Array.from(container.querySelectorAll<HTMLButtonElement>(".config-overview-card")).find(
      (entry) => entry.textContent?.includes("代理"),
    );
    expect(agentCard).not.toBeUndefined();
    agentCard?.click();
    expect(onOverviewSectionOpen).toHaveBeenCalledWith("agents");
  });

  it("shows a quick switch-to-Chinese action when locale is English", () => {
    const container = document.createElement("div");
    const onLocaleChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        locale: "en",
        onLocaleChange,
      }),
      container,
    );

    const button = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "切换中文",
    );
    expect(button).not.toBeUndefined();
    button?.click();
    expect(onLocaleChange).toHaveBeenCalledWith("zh-CN");
  });

  it("uses section header summary instead of duplicated hero inside a section", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        activeSection: "gateway",
        schema: {
          type: "object",
          properties: {
            gateway: {
              type: "object",
              properties: {
                port: { type: "number" },
              },
            },
          },
        },
        formValue: { gateway: { port: 8080 } },
        originalValue: { gateway: { port: 8080 } },
      }),
      container,
    );

    expect(container.querySelector(".config-header__title")?.textContent?.trim()).toBe("Gateway");
    expect(container.querySelector(".config-section-hero")).toBeNull();
    expect(container.querySelector(".config-section-card__header")).toBeNull();
    expect(container.querySelector(".config-inline-actions")).toBeNull();
  });

  it("shows env reveal action inline inside the content area", () => {
    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        activeSection: "env",
        schema: {
          type: "object",
          properties: {
            env: {
              type: "object",
              properties: {
                API_KEY: { type: "string" },
              },
            },
          },
        },
        formValue: { env: { API_KEY: "hidden" } },
        originalValue: { env: { API_KEY: "hidden" } },
      }),
      container,
    );

    expect(container.querySelector(".config-inline-actions .config-env-peek-btn")).not.toBeNull();
    expect(container.querySelector(".config-header__title")?.textContent?.trim()).toBe("Environment Variables");
  });

  it("clears the active search query", () => {
    const container = document.createElement("div");
    const onSearchChange = vi.fn();
    render(
      renderConfig({
        ...baseProps(),
        searchQuery: "gateway",
        onSearchChange,
      }),
      container,
    );

    const clearButton = container.querySelector<HTMLButtonElement>(".config-search__clear");
    expect(clearButton).toBeTruthy();
    clearButton?.click();
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("renders config shell content in simplified Chinese", async () => {
    await i18n.setLocale("zh-CN");

    const container = document.createElement("div");
    render(
      renderConfig({
        ...baseProps(),
        activeSection: "__appearance__",
      }),
      container,
    );

    expect(container.textContent).toContain("设置");
    expect(container.textContent).toContain("主题");
    expect(container.textContent).toContain("圆角");
    expect(container.textContent).toContain("连接");
    expect(container.textContent).toContain("重新加载");
    expect(container.textContent).toContain("原始");

    const input = container.querySelector<HTMLInputElement>(".config-search__input");
    expect(input?.placeholder).toBe("搜索设置...");
  });
});
