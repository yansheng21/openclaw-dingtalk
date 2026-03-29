/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { renderChannels } from "./channels.ts";
import type { ChannelsProps } from "./channels.types.ts";

function createChannelsProps(): ChannelsProps {
  return {
    connected: true,
    loading: false,
    dingtalkTesting: false,
    dingtalkPreviewLoading: false,
    dingtalkPreviewResult: null,
    dingtalkPreviewPreset: "direct",
    snapshot: null,
    lastError: null,
    lastSuccessAt: null,
    whatsappMessage: null,
    whatsappQrDataUrl: null,
    whatsappConnected: null,
    whatsappBusy: false,
    configSchema: null,
    configSchemaLoading: false,
    configForm: null,
    configUiHints: {},
    configSaving: false,
    configFormDirty: false,
    nostrProfileFormState: null,
    nostrProfileAccountId: null,
    pageView: "list",
    selectedChannelId: null,
    selectedChannelAccountId: null,
    dingtalkViewMode: "details",
    listSearchQuery: "",
    listStatusFilter: "all",
    channelCreatePickerOpen: false,
    channelConfigEditorChannelId: null,
    dingtalkAccountEditorState: null,
    genericChannelAccountEditorState: null,
    logsLoading: false,
    logsError: null,
    logsFile: null,
    logsEntries: [],
    logsTruncated: false,
    logsLastFetchAt: null,
    logsAutoFollow: true,
    isSensitivePathRevealed: () => false,
    onToggleSensitivePath: () => undefined,
    onRefresh: () => undefined,
    onDingTalkTest: () => undefined,
    onDingTalkPreview: () => undefined,
    onDingTalkPreviewPresetChange: () => undefined,
    onOpenChannelDetail: () => undefined,
    onBackToChannelList: () => undefined,
    onSelectChannel: () => undefined,
    onSelectChannelAccount: () => undefined,
    onDingTalkViewModeChange: () => undefined,
    onListSearchQueryChange: () => undefined,
    onListStatusFilterChange: () => undefined,
    onOpenChannelCreatePicker: () => undefined,
    onCloseChannelCreatePicker: () => undefined,
    onStartChannelCreate: () => undefined,
    onOpenChannelConfigEditor: () => undefined,
    onCloseChannelConfigEditor: () => undefined,
    onOpenModelsConfig: () => undefined,
    onOpenDingTalkAccountEditor: () => undefined,
    onCloseDingTalkAccountEditor: () => undefined,
    onOpenGenericChannelAccountEditor: () => undefined,
    onCloseGenericChannelAccountEditor: () => undefined,
    onGenericChannelAccountEditorAccountIdChange: () => undefined,
    onGenericChannelAccountEditorDefaultChange: () => undefined,
    onGenericChannelAccountEditorPatch: () => undefined,
    onDingTalkAccountEditorFieldChange: () => undefined,
    onSaveDingTalkAccountEditor: () => undefined,
    onDeleteDingTalkAccount: () => undefined,
    onSaveGenericChannelAccountEditor: () => undefined,
    onDeleteGenericChannelAccount: () => undefined,
    onLogsRefresh: () => undefined,
    onLogsAutoFollowChange: () => undefined,
    onLogsScroll: () => undefined,
    onFocusLogsPanel: () => undefined,
    onWhatsAppStart: () => undefined,
    onWhatsAppWait: () => undefined,
    onWhatsAppLogout: () => undefined,
    onConfigPatch: () => undefined,
    onConfigRemove: () => undefined,
    onConfigSave: () => undefined,
    onConfigReload: () => undefined,
    onNostrProfileEdit: () => undefined,
    onNostrProfileCancel: () => undefined,
    onNostrProfileFieldChange: () => undefined,
    onNostrProfileSave: () => undefined,
    onNostrProfileImport: () => undefined,
    onNostrProfileToggleAdvanced: () => undefined,
  };
}

describe("channels regressions", () => {
  beforeEach(async () => {
    await i18n.setLocale("zh-CN");
  });

  it("shows the channel account count in the list account column", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-connector"],
        channelLabels: {
          "dingtalk-connector": "钉钉",
        },
        channels: {
          "dingtalk-connector": {
            configured: true,
          },
        },
        channelAccounts: {
          "dingtalk-connector": [
            {
              accountId: "corp-main",
              name: "企业钉钉",
              configured: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-connector": "corp-main",
        },
      },
    };

    render(renderChannels(props), container);

    const row = container.querySelector(".channels-table__row");
    expect(row).not.toBeNull();
    expect(row?.children.item(3)?.textContent?.trim()).toBe("账号 (1)");
  });

  it("shows DingTalk Stream as the only visible DingTalk entry in the channel list", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise", "dingtalk-connector"],
        channelLabels: {
          "dingtalk-enterprise": "DingTalk Enterprise",
          "dingtalk-connector": "DingTalk Stream",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: false,
          },
          "dingtalk-connector": {
            configured: false,
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [],
          "dingtalk-connector": [],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "default",
          "dingtalk-connector": "default",
        },
      },
    };

    render(renderChannels(props), container);

    const rows = Array.from(container.querySelectorAll(".channels-table__row"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.children.item(1)?.textContent?.trim()).toBe("钉钉");
  });

  it("renders preview tool classes from the backend field names", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-enterprise",
      selectedChannelAccountId: "corp-main",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise"],
        channelLabels: {
          "dingtalk-enterprise": "钉钉",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: true,
            defaultAccountId: "corp-main",
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [
            {
              accountId: "corp-main",
              name: "企业钉钉",
              configured: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "corp-main",
        },
      },
      dingtalkPreviewResult: {
        accepted: true,
        claims: {
          channel: "dingtalk-enterprise",
          accountId: "corp-main",
          subjectId: "dingtalk-enterprise:corp-main:staff-1",
          displayName: "张三",
          conversationId: "conv-1",
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
          deniedToolClasses: ["host-exec"],
          reason: "ok",
        },
        approval: {
          required: false,
          level: "none",
          requestId: null,
        },
        auditEvent: {
          eventId: "evt-1",
          outcome: "accepted",
          summary: "preview",
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("browser-automation");
    expect(text).toContain("host-exec");
  });

  it("renders a generic integration-instance directory for multi-account Telegram channels", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "telegram",
      snapshot: {
        ts: 1,
        channelOrder: ["telegram"],
        channelLabels: {
          telegram: "Telegram",
        },
        channels: {
          telegram: {
            configured: true,
            running: true,
          },
        },
        channelAccounts: {
          telegram: [
            {
              accountId: "ops-bot",
              name: "运维机器人",
              displayName: "运维机器人（主）",
              configured: true,
              running: true,
            },
            {
              accountId: "sales-bot",
              name: "销售机器人",
              configured: true,
              running: false,
            },
          ],
        },
        channelDefaultAccountId: {
          telegram: "ops-bot",
        },
      },
      logsEntries: [
        {
          time: "2026-03-25T02:00:00.000Z",
          level: "info",
          subsystem: "telegram",
          message: "ops-bot received update",
          raw: "ops-bot received update",
        },
      ],
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("接入实例");
    expect(text).toContain("运维机器人（主）");
    expect(text).toContain("销售机器人");
    expect(text).not.toContain("先从这里选中具体接入实例");
    expect(text).not.toContain("一个频道可以有多个实例");
  });

  it("prefers displayName for dingtalk-connector instances and shows masked client secret state", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-connector",
      selectedChannelAccountId: "__default__",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-connector"],
        channelLabels: {
          "dingtalk-connector": "钉钉",
        },
        channels: {
          "dingtalk-connector": {
            configured: true,
            running: true,
          },
        },
        channelAccounts: {
          "dingtalk-connector": [
            {
              accountId: "__default__",
              name: "主龙虾",
              displayName: "蜂擎侠",
              configured: true,
              running: true,
              clientId: "ding3y4yjkosukghgvbc",
              clientSecretConfigured: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-connector": "__default__",
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("蜂擎侠");
    expect(text).toContain("客户端 ID");
    expect(text).toContain("ding3y4yjkosukghgvbc");
    expect(text).toContain("客户端密钥");
    expect(text).toContain("已配置（已隐藏）");
    expect(text).toContain("允许来源");
    expect(text).toContain("未单独限制（继承上层策略）");
  });

  it("shows the currently bound agent for channel instances", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-connector",
      selectedChannelAccountId: null,
      configForm: {
        agents: {
          defaultId: "main",
          list: [
            { id: "main", name: "默认助手" },
            { id: "fengqingxia", name: "蜂擎侠" },
          ],
        },
        bindings: [
          {
            agentId: "fengqingxia",
            match: {
              channel: "dingtalk-connector",
              accountId: "corp-main",
            },
          },
        ],
      },
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-connector"],
        channelLabels: {
          "dingtalk-connector": "钉钉",
        },
        channels: {
          "dingtalk-connector": {
            configured: true,
            connected: true,
          },
        },
        channelAccounts: {
          "dingtalk-connector": [
            {
              accountId: "corp-main",
              name: "企业钉钉",
              displayName: "蜂擎侠实例",
              configured: true,
              connected: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-connector": "corp-main",
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("当前绑定 Agent");
    expect(text).toContain("蜂擎侠");
    expect(text).toContain("精确绑定");
  });

  it("shows the bound agent in the instance detail modal and hides create actions there", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-connector",
      selectedChannelAccountId: "corp-main",
      configForm: {
        agents: {
          defaultId: "main",
          list: [
            { id: "main", name: "默认助手" },
            { id: "fengqingxia", name: "蜂擎侠" },
          ],
        },
        bindings: [
          {
            agentId: "fengqingxia",
            match: {
              channel: "dingtalk-connector",
              accountId: "corp-main",
            },
          },
        ],
      },
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-connector"],
        channelLabels: {
          "dingtalk-connector": "钉钉",
        },
        channels: {
          "dingtalk-connector": {
            configured: true,
            connected: true,
            running: true,
          },
        },
        channelAccounts: {
          "dingtalk-connector": [
            {
              accountId: "corp-main",
              name: "企业钉钉",
              displayName: "蜂擎侠实例",
              configured: true,
              connected: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-connector": "corp-main",
        },
      },
    };

    render(renderChannels(props), container);

    const modal = container.querySelector(".channels-modal--detail");
    expect(modal).toBeTruthy();
    const text = modal?.textContent ?? "";
    expect(text).toContain("当前绑定 Agent");
    expect(text).toContain("蜂擎侠");
    expect(text).toContain("精确绑定");
    expect(text).not.toContain("新增实例");
  });

  it("shows the instance list before DingTalk detail even when only one robot exists", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-enterprise",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise"],
        channelLabels: {
          "dingtalk-enterprise": "钉钉回调（高级）",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: true,
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [
            {
              accountId: "corp-main",
              name: "总部审批机器人",
              configured: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "corp-main",
        },
      },
      logsEntries: [
        {
          time: "2026-03-25T02:00:00.000Z",
          level: "info",
          subsystem: "dingtalk-enterprise",
          message: "corp-main callback ok",
          raw: "corp-main callback ok",
        },
      ],
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("总部审批机器人");
    expect(text).toContain("corp-main");
    expect(text).not.toContain("接入概览");
  });

  it("shows generic multi-instance actions for account-based Telegram channels", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "telegram",
      selectedChannelAccountId: "ops-bot",
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              telegram: {
                type: "object",
                properties: {
                  defaultAccount: { type: "string" },
                  accounts: {
                    type: "object",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        botToken: { type: "string" },
                        enabled: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      configForm: {
        channels: {
          telegram: {
            defaultAccount: "ops-bot",
            accounts: {
              "ops-bot": {
                botToken: "123:abc",
                enabled: true,
              },
            },
          },
        },
      },
      snapshot: {
        ts: 1,
        channelOrder: ["telegram"],
        channelLabels: {
          telegram: "Telegram",
        },
        channels: {
          telegram: {
            configured: true,
            running: true,
          },
        },
        channelAccounts: {
          telegram: [
            {
              accountId: "ops-bot",
              name: "运维机器人",
              configured: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          telegram: "ops-bot",
        },
      },
    };

    render(renderChannels(props), container);

    const actionTexts = Array.from(
      container.querySelectorAll(".channels-selection__actions .btn"),
    ).map((button) => button.textContent?.trim() ?? "");
    const rowActionText = container.querySelector(".channels-table__actions")?.textContent ?? "";

    expect(actionTexts).toContain("编辑实例");
    expect(actionTexts).toContain("新增实例");
    expect(actionTexts).not.toContain("频道级配置");
    expect(rowActionText).toContain("进入详情");
  });

  it("prefills and saves a generic display name alongside the instance id", async () => {
    const container = document.createElement("div");
    const onSaveGenericChannelAccountEditor = vi.fn();
    const onCloseGenericChannelAccountEditor = vi.fn();
    const onGenericChannelAccountEditorPatch = vi.fn();
    const props: ChannelsProps = {
      ...createChannelsProps(),
      genericChannelAccountEditorState: {
        channelId: "telegram",
        mode: "edit",
        originalAccountId: "ops-bot",
        accountId: "ops-bot",
        setAsDefault: true,
        values: {
          displayName: "运维机器人",
          botToken: "123:abc",
          enabled: true,
        },
        saving: false,
        error: null,
      },
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              telegram: {
                type: "object",
                properties: {
                  defaultAccount: { type: "string" },
                  accounts: {
                    type: "object",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        displayName: { type: "string" },
                        botToken: { type: "string" },
                        enabled: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      configForm: {
        channels: {
          telegram: {
            defaultAccount: "ops-bot",
            accounts: {
              "ops-bot": {
                displayName: "运维机器人",
                botToken: "123:abc",
                enabled: true,
              },
            },
          },
        },
      },
      snapshot: {
        ts: 1,
        channelOrder: ["telegram"],
        channelLabels: {
          telegram: "Telegram",
        },
        channels: {
          telegram: {
            configured: true,
          },
        },
        channelAccounts: {
          telegram: [
            {
              accountId: "ops-bot",
              name: "运维机器人",
              configured: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          telegram: "ops-bot",
        },
      },
      onSaveGenericChannelAccountEditor,
      onCloseGenericChannelAccountEditor,
      onGenericChannelAccountEditorPatch,
    };

    render(renderChannels(props), container);

    expect(container.textContent ?? "").toContain("显示名称");
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder="总部审批机器人"]')?.value,
    ).toBe("运维机器人");

    const saveButton = container.querySelector<HTMLButtonElement>(
      ".channels-modal__actions .btn.primary",
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    expect(onSaveGenericChannelAccountEditor).toHaveBeenCalledTimes(1);
  });

  it("can save a new instance with an auto-created agent draft", async () => {
    const container = document.createElement("div");
    const onSaveGenericChannelAccountEditor = vi.fn();
    const onGenericChannelAccountEditorCreateAgentToggle = vi.fn();
    const onGenericChannelAccountEditorAgentFieldChange = vi.fn();
    const props: ChannelsProps = {
      ...createChannelsProps(),
      genericChannelAccountEditorState: {
        channelId: "dingtalk-connector",
        mode: "create",
        originalAccountId: null,
        accountId: "xiaolong",
        setAsDefault: false,
        values: {
          displayName: "小龙",
          clientId: "cid",
        },
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
      onSaveGenericChannelAccountEditor,
      onGenericChannelAccountEditorCreateAgentToggle,
      onGenericChannelAccountEditorAgentFieldChange,
    };

    render(renderChannels(props), container);

    expect(container.textContent ?? "").toContain("同时创建独立 Agent 并绑定当前实例");

    const saveButton = container.querySelector<HTMLButtonElement>(
      ".channels-modal__actions .btn.primary",
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    expect(onSaveGenericChannelAccountEditor).toHaveBeenCalledWith({
      createAgent: {
        id: "xiaolong",
        name: "小龙",
        workspace: "/tmp/workspace-xiaolong",
      },
    });
  });

  it("prioritizes create-instance actions when entering a channel instance list", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-enterprise",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise"],
        channelLabels: {
          "dingtalk-enterprise": "钉钉回调（高级）",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: true,
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [
            {
              accountId: "corp-main",
              name: "总部审批机器人",
              configured: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "corp-main",
        },
      },
    };

    render(renderChannels(props), container);

    const actionTexts = Array.from(
      container.querySelectorAll(".channels-selection__actions .btn"),
    ).map((button) => button.textContent?.trim() ?? "");

    expect(actionTexts).toContain("新增实例");
    expect(actionTexts).not.toContain("频道级配置");
    expect(actionTexts).not.toContain("编辑实例");
  });

  it("shows no channel-level config section for multi-instance channels before an instance is selected", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "telegram",
      snapshot: {
        ts: 1,
        channelOrder: ["telegram"],
        channelLabels: {
          telegram: "Telegram",
        },
        channels: {
          telegram: {
            configured: true,
            connected: true,
          },
        },
        channelAccounts: {
          telegram: [
            {
              accountId: "ops-bot",
              name: "运维机器人",
              configured: true,
              connected: true,
              running: true,
            },
          ],
        },
        channelDefaultAccountId: {
          telegram: "ops-bot",
        },
      },
      configForm: {
        channels: {
          telegram: {
            dmPolicy: "pairing",
            defaultAccount: "ops-bot",
            accounts: {
              ops: {
                token: "secret",
              },
            },
          },
        },
      },
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              telegram: {
                type: "object",
                properties: {
                  dmPolicy: { type: "string" },
                  defaultAccount: { type: "string" },
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
    };

    render(renderChannels(props), container);

    const titles = Array.from(container.querySelectorAll(".card-title")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    const simpleConfigTitles = titles.filter((title) => title === "简化配置");

    expect(simpleConfigTitles).toHaveLength(0);
  });

  it("keeps channel-level config available for single-instance channels", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "whatsapp",
      snapshot: {
        ts: 1,
        channelOrder: ["whatsapp"],
        channelLabels: {
          whatsapp: "WhatsApp",
        },
        channels: {
          whatsapp: {
            configured: true,
            connected: true,
          },
        },
        channelAccounts: {
          whatsapp: [],
        },
        channelDefaultAccountId: {
          whatsapp: "default",
        },
      },
      configForm: {
        channels: {
          whatsapp: {
            streamMode: "buffered",
          },
        },
      },
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              whatsapp: {
                type: "object",
                properties: {
                  streamMode: { type: "string" },
                },
              },
            },
          },
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("简化配置");
    expect(text).toContain("频道级配置");
  });

  it("shows session isolation warnings for multi-instance accounts without per-account DM scope", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-connector",
      selectedChannelAccountId: "ops-bot",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-connector"],
        channelLabels: {
          "dingtalk-connector": "钉钉",
        },
        channels: {
          "dingtalk-connector": {
            configured: true,
            connected: true,
          },
        },
        channelAccounts: {
          "dingtalk-connector": [
            {
              accountId: "ops-bot",
              name: "运维机器人",
              configured: true,
              connected: true,
              running: true,
              isDefaultAccount: true,
              dmScope: "per-channel-peer",
              sessionScopeSummary: "按渠道+私聊对象",
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-connector": "ops-bot",
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("当前私聊会话还不是按账号隔离");
  });

  it("keeps the config modal open when save does not succeed", async () => {
    const container = document.createElement("div");
    const onCloseChannelConfigEditor = vi.fn();
    const onConfigSave = vi.fn(async () => false);
    const props: ChannelsProps = {
      ...createChannelsProps(),
      channelConfigEditorChannelId: "telegram",
      configFormDirty: true,
      configForm: {
        channels: {
          telegram: {
            token: "abc",
          },
        },
      },
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              telegram: {
                type: "object",
                properties: {
                  token: { type: "string" },
                },
              },
            },
          },
        },
      },
      onConfigSave,
      onCloseChannelConfigEditor,
    };

    render(renderChannels(props), container);

    const saveButton = container.querySelector<HTMLButtonElement>(
      ".channels-modal__actions .btn.primary",
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(onConfigSave).toHaveBeenCalledTimes(1);
    expect(onCloseChannelConfigEditor).not.toHaveBeenCalled();
  });

  it("closes the config modal after a successful save", async () => {
    const container = document.createElement("div");
    const onCloseChannelConfigEditor = vi.fn();
    const onConfigSave = vi.fn(async () => true);
    const props: ChannelsProps = {
      ...createChannelsProps(),
      channelConfigEditorChannelId: "telegram",
      configFormDirty: true,
      configForm: {
        channels: {
          telegram: {
            token: "abc",
          },
        },
      },
      configSchema: {
        type: "object",
        properties: {
          channels: {
            type: "object",
            properties: {
              telegram: {
                type: "object",
                properties: {
                  token: { type: "string" },
                },
              },
            },
          },
        },
      },
      onConfigSave,
      onCloseChannelConfigEditor,
    };

    render(renderChannels(props), container);

    const saveButton = container.querySelector<HTMLButtonElement>(
      ".channels-modal__actions .btn.primary",
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(onCloseChannelConfigEditor).toHaveBeenCalledTimes(1);
  });

  it("renders the new DingTalk editor guidance and callback preview", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      dingtalkAccountEditorState: {
        mode: "create",
        originalAccountId: null,
        saving: false,
        error: null,
        revealedSensitiveFields: {},
        values: {
          accountId: "corp-main",
          name: "总部审批机器人",
          enabled: true,
          appKey: "dingappkey",
          appSecret: "secret-value",
          clientId: "",
          clientSecret: "",
          agentId: "123456",
          robotCode: "",
          tenantId: "",
          callbackBaseUrl: "https://gateway.example.com/",
          messageCallbackPath: "/webhooks/dingtalk/messages",
          cardCallbackPath: "/webhooks/dingtalk/cards/actions",
          oaCallbackPath: "/webhooks/dingtalk/oa/events",
          setAsDefault: true,
          dmPolicy: "",
          groupPolicy: "",
          sessionScope: "",
        },
      },
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("高级回调接入先准备三块内容");
    expect(text).toContain("当前仅展示该账号生效的会话范围");
    const callbackItems = container.querySelectorAll(".dingtalk-editor-callbacks__item");
    const sessionScopeSelect = Array.from(container.querySelectorAll("select")).find((select) =>
      select.previousElementSibling?.textContent?.includes("会话范围"),
    );
    expect(sessionScopeSelect).toBeUndefined();
    expect(callbackItems).toHaveLength(3);
    expect(text).toContain(
      "https://gateway.example.com/webhooks/dingtalk/accounts/corp-main/messages",
    );
    expect(text).toContain(
      "https://gateway.example.com/webhooks/dingtalk/accounts/corp-main/cards/actions",
    );
    expect(text).toContain(
      "https://gateway.example.com/webhooks/dingtalk/accounts/corp-main/oa/events",
    );
  });

  it("keeps Client Secret visible in the DingTalk editor", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      dingtalkAccountEditorState: {
        mode: "edit",
        originalAccountId: "corp-main",
        saving: false,
        error: null,
        revealedSensitiveFields: {},
        values: {
          accountId: "corp-main",
          name: "总部审批机器人",
          enabled: true,
          appKey: "dingappkey",
          appSecret: "secret-value",
          clientId: "client-id",
          clientSecret: "client-secret",
          agentId: "123456",
          robotCode: "",
          tenantId: "",
          callbackBaseUrl: "",
          messageCallbackPath: "/webhooks/dingtalk/messages",
          cardCallbackPath: "/webhooks/dingtalk/cards/actions",
          oaCallbackPath: "/webhooks/dingtalk/oa/events",
          setAsDefault: false,
          dmPolicy: "",
          groupPolicy: "",
          sessionScope: "",
        },
      },
    };

    render(renderChannels(props), container);

    const revealButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.field__reveal[aria-label="显示值"]'),
    );
    const clientSecretInput = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((input) => input.value === "client-secret");

    expect(revealButtons).toHaveLength(1);
    expect(clientSecretInput).toBeDefined();
    expect(clientSecretInput?.type).toBe("text");
  });

  it("renders the DingTalk detail workbench with summary and checklist", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-enterprise",
      selectedChannelAccountId: "corp-main",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise"],
        channelLabels: {
          "dingtalk-enterprise": "钉钉",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: true,
            connected: false,
            defaultAccountId: "corp-main",
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [
            {
              accountId: "corp-main",
              name: "总部审批机器人",
              configured: true,
              connected: false,
              running: true,
              probe: {
                ok: false,
                credentialMode: "none",
                missingRequired: ["appSecret", "callbackBaseUrl"],
              },
            },
          ],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "corp-main",
        },
      },
      logsEntries: [
        {
          time: "2026-03-25T02:00:00.000Z",
          level: "warn",
          subsystem: "dingtalk-enterprise",
          message: "corp-main callback missing",
          raw: "corp-main callback missing",
        },
      ],
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("接入概览");
    expect(text).toContain("联调清单");
    expect(text).toContain("先进入编辑，补齐这些必填项");
    expect(text).toContain("当前仅识别到 0/3 条回调");
  });

  it("renders the DingTalk empty state as a workbench before any account exists", () => {
    const container = document.createElement("div");
    const props: ChannelsProps = {
      ...createChannelsProps(),
      pageView: "detail",
      selectedChannelId: "dingtalk-enterprise",
      snapshot: {
        ts: 1,
        channelOrder: ["dingtalk-enterprise"],
        channelLabels: {
          "dingtalk-enterprise": "钉钉",
        },
        channels: {
          "dingtalk-enterprise": {
            configured: false,
          },
        },
        channelAccounts: {
          "dingtalk-enterprise": [],
        },
        channelDefaultAccountId: {
          "dingtalk-enterprise": "default",
        },
      },
      logsEntries: [
        {
          time: "2026-03-25T02:00:00.000Z",
          level: "info",
          subsystem: "dingtalk-enterprise",
          message: "runtime placeholder mounted",
          raw: "runtime placeholder mounted",
        },
      ],
    };

    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    expect(text).toContain("接入概览");
    expect(text).toContain("联调清单");
    expect(text).toContain("尚未创建账号");
    expect(text).toContain("先新增一个高级回调账号");
    expect(text).toContain("频道日志");
  });
});
