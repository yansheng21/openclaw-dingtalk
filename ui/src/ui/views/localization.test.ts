/* @vitest-environment jsdom */

import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { DEFAULT_CRON_FORM } from "../app-defaults.ts";
import { pathForTab, tabFromPath, titleForTab } from "../navigation.ts";
import { renderAgents, type AgentsProps } from "./agents.ts";
import { filterChannelLogs, renderChannels } from "./channels.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { renderCron, type CronProps } from "./cron.ts";
import { renderInstances, type InstancesProps } from "./instances.ts";
import { renderKnowledge, type KnowledgeProps } from "./knowledge.ts";
import { renderLogs, type LogsProps } from "./logs.ts";
import { renderNodes, type NodesProps } from "./nodes.ts";
import { renderSessions, type SessionsProps } from "./sessions.ts";
import { renderSkills, type SkillsProps } from "./skills.ts";

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
    onOpenModelsConfig: () => undefined,
  };
}

function createInstancesProps(): InstancesProps {
  return {
    loading: false,
    entries: [],
    lastError: null,
    statusMessage: null,
    onRefresh: () => undefined,
  };
}

function createLogsProps(): LogsProps {
  return {
    loading: false,
    error: null,
    file: null,
    entries: [{ raw: "ok", message: "ok", level: "info" }],
    filterText: "",
    levelFilters: {
      trace: true,
      debug: true,
      info: true,
      warn: true,
      error: true,
      fatal: true,
    },
    autoFollow: true,
    truncated: false,
    onFilterTextChange: () => undefined,
    onLevelToggle: () => undefined,
    onToggleAutoFollow: () => undefined,
    onRefresh: () => undefined,
    onExport: () => undefined,
    onScroll: () => undefined,
  };
}

function createSkillsProps(): SkillsProps {
  return {
    connected: true,
    loading: false,
    report: {
      workspaceDir: "/tmp",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "Repo Skill",
          description: "Skill description",
          source: "openclaw-workspace",
          filePath: "/tmp/skill",
          baseDir: "/tmp",
          skillKey: "repo-skill",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], env: [], config: [], os: [] },
          missing: { bins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
      ],
    },
    error: null,
    filter: "",
    page: 0,
    configForm: {
      agents: {
        list: [{ id: "fengqingxia", skills: ["Repo Skill"] }],
      },
    },
    configLoading: false,
    selectedAgentReport: {
      workspaceDir: "/tmp",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "Repo Skill",
          description: "Skill description",
          source: "openclaw-workspace",
          filePath: "/tmp/skill",
          baseDir: "/tmp",
          skillKey: "repo-skill",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], env: [], config: [], os: [] },
          missing: { bins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
      ],
    },
    selectedAgentReportAgentId: "fengqingxia",
    selectedAgentLoading: false,
    agentsList: {
      defaultId: "fengqingxia",
      agents: [
        { id: "fengqingxia", name: "蜂擎侠" },
        { id: "xiaolong", name: "小龙" },
      ],
    },
    selectedAgentId: "fengqingxia",
    edits: {},
    busyKey: null,
    messages: {},
    onFilterChange: () => undefined,
    onPageChange: () => undefined,
    onAgentChange: () => undefined,
    onOpenAgentSkills: () => undefined,
    onRefresh: () => undefined,
    onToggle: () => undefined,
    onEdit: () => undefined,
    onSaveKey: () => undefined,
    onInstall: () => undefined,
  };
}

function createAgentsProps(): AgentsProps {
  return {
    basePath: "",
    loading: false,
    error: null,
    agentsList: {
      defaultId: "alpha",
      mainKey: "main",
      scope: "workspace",
      agents: [{ id: "alpha", name: "Alpha" } as never],
    },
    selectedAgentId: "alpha",
    activePanel: "overview",
    config: {
      form: null,
      loading: false,
      saving: false,
      dirty: false,
    },
    channels: {
      snapshot: null,
      loading: false,
      error: null,
      lastSuccess: null,
    },
    cron: {
      status: null,
      jobs: [],
      loading: false,
      error: null,
    },
    agentFiles: {
      list: null,
      loading: false,
      error: null,
      active: null,
      contents: {},
      drafts: {},
      saving: false,
    },
    agentIdentityLoading: false,
    agentIdentityError: null,
    agentIdentityById: {},
    agentSkills: {
      report: null,
      loading: false,
      error: null,
      agentId: null,
      filter: "",
    },
    toolsCatalog: {
      loading: false,
      error: null,
      result: null,
    },
    onRefresh: () => undefined,
    onSelectAgent: () => undefined,
    onSelectPanel: () => undefined,
    onLoadFiles: () => undefined,
    onSelectFile: () => undefined,
    onFileDraftChange: () => undefined,
    onFileReset: () => undefined,
    onFileSave: () => undefined,
    onToolsProfileChange: () => undefined,
    onToolsOverridesChange: () => undefined,
    onConfigReload: () => undefined,
    onConfigSave: () => undefined,
    onModelChange: () => undefined,
    onModelFallbacksChange: () => undefined,
    onChannelsRefresh: () => undefined,
    onCronRefresh: () => undefined,
    onCronRunNow: () => undefined,
    onSkillsFilterChange: () => undefined,
    onSkillsRefresh: () => undefined,
    onAgentSkillToggle: () => undefined,
    onAgentSkillsClear: () => undefined,
    onAgentSkillsDisableAll: () => undefined,
    onSetDefault: () => undefined,
    onCreateAgent: () => undefined,
    onSaveBinding: () => undefined,
    onRemoveBinding: () => undefined,
    onRequestUpdate: () => undefined,
  };
}

function createKnowledgeProps(): KnowledgeProps {
  return {
    loading: false,
    configLoading: false,
    agentsList: {
      defaultId: "alpha",
      mainKey: "main",
      scope: "workspace",
      agents: [{ id: "alpha", name: "Alpha" } as never, { id: "beta", name: "Beta" } as never],
    },
    selectedAgentId: "alpha",
    agentIdentityById: {},
    configForm: {
      agents: {
        defaultId: "alpha",
        defaults: {
          workspace: "/tmp/alpha",
          model: { primary: "relay/gpt-5.4" },
        },
      },
      channels: {
        "dingtalk-connector": {
          accounts: {
            "relay-main": {
              name: "总部知识库",
              knowledgeBaseSync: {
                operatorId: "union-main",
                targetAgentId: "alpha",
                workspaceIds: ["sales", "pricing"],
              },
            },
          },
        },
      },
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              accounts: {
                "relay-ops": {
                  name: "运营知识库",
                  knowledgeBaseSync: {
                    operatorId: "union-ops",
                    targetAgentId: "beta",
                  },
                },
              },
            },
          },
        },
      },
    },
    operatorDrafts: {},
    operatorSavingSourceKey: null,
    operatorSaveError: null,
    dataLoading: false,
    dataError: null,
    dataResult: {
      agentId: "alpha",
      workspaceDir: "/tmp/alpha",
      outputRootDir: "/tmp/alpha/memory/dingtalk-kb",
      workspaceCount: 1,
      documentCount: 3,
      metadataOnlyDocuments: 1,
      lastSyncedAt: "2026-03-29T00:00:00.000Z",
      workspaces: [
        {
          channelId: "dingtalk-connector",
          accountId: "relay-main",
          accountLabel: "总部知识库",
          workspaceId: "sales",
          workspaceName: "销售知识库",
          outputDir: "/tmp/alpha/memory/dingtalk-kb/dingtalk-connector/relay-main/sales",
          indexFilePath:
            "/tmp/alpha/memory/dingtalk-kb/dingtalk-connector/relay-main/sales/_workspace-index.md",
          syncedAt: "2026-03-29T00:00:00.000Z",
          visitedNodes: 12,
          documents: 3,
          metadataOnlyDocuments: 1,
          truncated: false,
          rootNodeId: "root-1",
          updatedAtMs: 1,
        },
      ],
      recentDocuments: [
        {
          channelId: "dingtalk-connector",
          accountId: "relay-main",
          accountLabel: "总部知识库",
          workspaceId: "sales",
          workspaceName: "销售知识库",
          title: "销售手册",
          nodeId: "doc-1",
          filePath:
            "/tmp/alpha/memory/dingtalk-kb/dingtalk-connector/relay-main/sales/销售手册--doc-1.md",
          logicalPath: "销售知识库 / 销售手册",
          type: "FILE",
          category: "DOCUMENT",
          extractedVia: "storage-download",
          syncedAt: "2026-03-29T00:00:00.000Z",
          modifiedAt: "2026-03-28T00:00:00.000Z",
          updatedAtMs: 1,
          preview: "标准说法。",
          url: "https://example.invalid/doc-1",
          metadataOnly: false,
        },
      ],
    },
    clearBusy: false,
    clearAgentId: null,
    clearError: null,
    syncBusy: false,
    syncAccountId: null,
    syncError: null,
    syncResult: null,
    onSelectAgent: () => undefined,
    onReload: () => undefined,
    onOpenSources: () => undefined,
    onOpenAgentFiles: () => undefined,
    onOpenSource: () => undefined,
    onClearData: () => undefined,
    onSyncSource: () => undefined,
    onOperatorDraftChange: () => undefined,
    onSaveOperator: () => undefined,
  };
}

function createSessionsProps(): SessionsProps {
  return {
    loading: false,
    result: null,
    error: null,
    activeMinutes: "",
    limit: "120",
    includeGlobal: false,
    includeUnknown: false,
    basePath: "",
    searchQuery: "",
    sortColumn: "updated",
    sortDir: "desc",
    page: 0,
    pageSize: 10,
    selectedKeys: new Set<string>(),
    onFiltersChange: () => undefined,
    onSearchChange: () => undefined,
    onSortChange: () => undefined,
    onPageChange: () => undefined,
    onPageSizeChange: () => undefined,
    onRefresh: () => undefined,
    onPatch: () => undefined,
    onToggleSelect: () => undefined,
    onSelectPage: () => undefined,
    onDeselectPage: () => undefined,
    onDeselectAll: () => undefined,
    onDeleteSelected: () => undefined,
  };
}

function createNodesProps(): NodesProps {
  return {
    loading: false,
    nodes: [],
    devicesLoading: false,
    devicesError: null,
    devicesList: {
      pending: [],
      paired: [],
    },
    configForm: null,
    configLoading: false,
    configSaving: false,
    configDirty: false,
    configFormMode: "form",
    execApprovalsLoading: false,
    execApprovalsSaving: false,
    execApprovalsDirty: false,
    execApprovalsSnapshot: null,
    execApprovalsForm: null,
    execApprovalsSelectedAgent: null,
    execApprovalsTarget: "gateway",
    execApprovalsTargetNodeId: null,
    onRefresh: () => undefined,
    onDevicesRefresh: () => undefined,
    onDeviceApprove: () => undefined,
    onDeviceReject: () => undefined,
    onDeviceRotate: () => undefined,
    onDeviceRevoke: () => undefined,
    onLoadConfig: () => undefined,
    onLoadExecApprovals: () => undefined,
    onBindDefault: () => undefined,
    onBindAgent: () => undefined,
    onSaveBindings: () => undefined,
    onExecApprovalsTargetChange: () => undefined,
    onExecApprovalsSelectAgent: () => undefined,
    onExecApprovalsPatch: () => undefined,
    onExecApprovalsRemove: () => undefined,
    onSaveExecApprovals: () => undefined,
  };
}

function createCronProps(): CronProps {
  return {
    basePath: "",
    loading: false,
    jobsLoadingMore: false,
    status: null,
    jobs: [],
    jobsTotal: 0,
    jobsHasMore: false,
    jobsQuery: "",
    jobsEnabledFilter: "all",
    jobsScheduleKindFilter: "all",
    jobsLastStatusFilter: "all",
    jobsSortBy: "nextRunAtMs",
    jobsSortDir: "asc",
    error: null,
    busy: false,
    form: { ...DEFAULT_CRON_FORM, scheduleKind: "cron", payloadKind: "agentTurn" },
    fieldErrors: {},
    canSubmit: true,
    editingJobId: null,
    channels: [],
    channelLabels: {},
    runsJobId: null,
    runs: [],
    runsTotal: 0,
    runsHasMore: false,
    runsLoadingMore: false,
    runsScope: "all",
    runsStatuses: [],
    runsDeliveryStatuses: [],
    runsStatusFilter: "all",
    runsQuery: "",
    runsSortDir: "desc",
    agentSuggestions: [],
    modelSuggestions: [],
    thinkingSuggestions: [],
    timezoneSuggestions: [],
    deliveryToSuggestions: [],
    accountSuggestions: [],
    onFormChange: () => undefined,
    onRefresh: () => undefined,
    onAdd: () => undefined,
    onEdit: () => undefined,
    onClone: () => undefined,
    onCancelEdit: () => undefined,
    onToggle: () => undefined,
    onRun: () => undefined,
    onRemove: () => undefined,
    onLoadRuns: () => undefined,
    onLoadMoreJobs: () => undefined,
    onJobsFiltersChange: () => undefined,
    onJobsFiltersReset: () => undefined,
    onLoadMoreRuns: () => undefined,
    onRunsFiltersChange: () => undefined,
  };
}

function renderText(template: unknown): string {
  const container = document.createElement("div");
  render(template, container);
  return container.textContent ?? "";
}

describe("view localization", () => {
  beforeEach(async () => {
    await i18n.setLocale("zh-CN");
  });

  it("renders channel view content in simplified Chinese with DingTalk Stream as the primary entry", () => {
    const container = document.createElement("div");
    render(renderChannels(createChannelsProps()), container);

    const text = container.textContent ?? "";
    const rows = Array.from(container.querySelectorAll(".channels-table__row"));

    expect(text).toContain("选择接入");
    expect(text).toContain("接入项");
    expect(text).toContain("进入频道");
    expect(text).toContain("频道级配置");
    expect(text).not.toContain("频道概览");
    expect(text).not.toContain("接入目录");
    expect(text).not.toContain("集中管理钉钉等接入渠道的状态、配置和联调日志。");
    expect(text).not.toContain("先选接入项，再处理状态、配置和日志，不再一次性摊开整页。");
    expect(rows[0]?.children.item(1)?.textContent?.trim()).toBe("钉钉");
    expect(text).toContain("适合本机、内网或没有公网入口的环境，直接走 Stream 模式接入钉钉。");
    expect(text).not.toContain("只有在需要公网可访问回调地址时，才使用这条高级链路。");
    expect(text).toContain("刷新");
    expect(text).toContain("待接入");
    expect(text).toContain("不适用");
  });

  it("renders integration picker content in simplified Chinese", () => {
    const props = createChannelsProps();
    props.channelCreatePickerOpen = true;
    const container = document.createElement("div");
    render(renderChannels(props), container);

    const text = container.textContent ?? "";
    const cards = Array.from(container.querySelectorAll(".channels-create-picker__card"));
    const titles = cards.map(
      (card) => card.querySelector(".channels-create-picker__title")?.textContent?.trim() ?? "",
    );
    const subtitles = cards.map(
      (card) => card.querySelector(".channels-create-picker__sub")?.textContent?.trim() ?? "",
    );

    expect(text).toContain("选择接入");
    expect(text).toContain("默认推荐“钉钉 Stream”");
    expect(titles[0]).toBe("钉钉");
    expect(subtitles[0]).toBe("钉钉 Stream（推荐）");
    expect(titles).not.toContain("钉钉回调（高级）");
    expect(text).toContain("推荐入口");
    expect(text).not.toContain("高级入口");
    expect(text).toContain("开始配置");
  });

  it("renders Feishu as 飞书 in simplified Chinese channel views", () => {
    const props = createChannelsProps();
    props.snapshot = {
      ts: Date.now(),
      channelOrder: ["feishu"],
      channelLabels: { feishu: "Feishu" },
      channelDetailLabels: { feishu: "Feishu Bot" },
      channelMeta: [
        {
          id: "feishu",
          label: "Feishu",
          detailLabel: "Feishu Bot",
          selectionLabel: "Feishu/Lark (飞书)",
          blurb: "Feishu integration",
        },
      ],
      channels: {
        feishu: {
          configured: false,
        },
      },
      channelAccounts: {
        feishu: [],
      },
      channelDefaultAccountId: {
        feishu: "default",
      },
    };

    const text = renderText(renderChannels(props));

    expect(text).toContain("飞书");
    expect(text).toContain("飞书企业消息、文档、知识库和云盘能力接入。");
  });

  it("renders DingTalk detail workbench content in English", async () => {
    await i18n.setLocale("en");
    const props = createChannelsProps();
    props.pageView = "detail";
    props.selectedChannelId = "dingtalk-enterprise";
    props.selectedChannelAccountId = "corp-main";
    props.snapshot = {
      ts: Date.now(),
      channelOrder: ["dingtalk-enterprise"],
      channelLabels: { "dingtalk-enterprise": "DingTalk" },
      channelMeta: [
        {
          id: "dingtalk-enterprise",
          label: "DingTalk",
          detailLabel:
            "Enterprise DingTalk onboarding, config debugging, and runtime logs live here.",
        },
      ],
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
            name: "HQ Approval Bot",
            configured: true,
            running: true,
            probe: {
              ok: true,
              credentialMode: "appSecret",
              missingRequired: [],
            },
          },
        ],
      },
      channelDefaultAccountId: {
        "dingtalk-enterprise": "corp-main",
      },
    };

    const text = renderText(renderChannels(props));

    expect(text).toContain("Integration overview");
    expect(text).toContain("Debug checklist");
    expect(text).toContain("Recent events");
    expect(text).toContain("Test passed");
    expect(text).toContain("Detected credential mode: AppKey + AppSecret.");
  });

  it("renders a compact channel detail directory in simplified Chinese", () => {
    const props = createChannelsProps();
    props.pageView = "detail";
    props.selectedChannelId = "telegram";
    props.snapshot = {
      ts: Date.now(),
      channelOrder: ["telegram"],
      channelLabels: { telegram: "Telegram" },
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
            name: "Ops Bot",
            configured: true,
            running: true,
            connected: true,
          },
        ],
      },
      channelDefaultAccountId: {
        telegram: "ops-bot",
      },
    };

    const text = renderText(renderChannels(props));

    expect(text).toContain("接入实例");
    expect(text).toContain("Ops Bot");
    expect(text).not.toContain("当前频道");
    expect(text).not.toContain("一个渠道下的多个机器人、账号或连接都统一收在这里。");
    expect(text).not.toContain("先从这里选中具体接入实例，再进入对应详情、编辑和联调。");
    expect(text).not.toContain(
      "一个频道可以有多个实例。先在下面选中具体机器人实例，再进入详情、编辑和联调。",
    );
  });

  it("renders a compact selected instance detail view in simplified Chinese", () => {
    const props = createChannelsProps();
    props.pageView = "detail";
    props.selectedChannelId = "telegram";
    props.selectedChannelAccountId = "ops-bot";
    props.logsEntries = [
      {
        raw: "telegram worker started",
        message: "telegram worker started",
        level: "info",
      },
    ];
    props.snapshot = {
      ts: Date.now(),
      channelOrder: ["telegram"],
      channelLabels: { telegram: "Telegram" },
      channels: {
        telegram: {
          configured: true,
          running: true,
          connected: true,
        },
      },
      channelAccounts: {
        telegram: [
          {
            accountId: "ops-bot",
            name: "Ops Bot",
            configured: true,
            running: true,
            connected: true,
          },
        ],
      },
      channelDefaultAccountId: {
        telegram: "ops-bot",
      },
    };

    const container = document.createElement("div");
    render(renderChannels(props), container);
    const text = container.textContent ?? "";

    expect(text).toContain("Ops Bot");
    expect(text).toContain("简化配置");
    expect(text).toContain("频道日志");
    expect(text).not.toContain("频道状态和配置。");
    expect(text).not.toContain("先走频道级公共配置；实例级账号、凭据和策略请在实例编辑器里维护。");
    expect(text).not.toContain("对当前频道做过滤后的实时网关日志。");
    expect(container.querySelector(".channels-detail-page")).toBeTruthy();
    expect(container.querySelector(".channels-modal--detail")).toBeTruthy();
  });

  it("keeps channel detail as a page and only opens instance detail in a modal", () => {
    const props = createChannelsProps();
    props.pageView = "detail";
    props.selectedChannelId = "telegram";
    props.snapshot = {
      ts: Date.now(),
      channelOrder: ["telegram"],
      channelLabels: { telegram: "Telegram" },
      channelDetailLabels: { telegram: "Telegram Bot" },
      channels: {
        telegram: {
          configured: true,
          running: true,
        },
      },
      channelAccounts: {
        telegram: [],
      },
      channelDefaultAccountId: {
        telegram: "default",
      },
    };

    const container = document.createElement("div");
    render(renderChannels(props), container);

    expect(container.querySelector(".channels-list-page")).toBeFalsy();
    expect(container.querySelector(".channels-detail-page")).toBeTruthy();
    expect(container.querySelector(".channels-modal--detail")).toBeFalsy();
  });

  it("renders instances view content in simplified Chinese", () => {
    const text = renderText(renderInstances(createInstancesProps()));

    expect(text).toContain("已连接实例");
    expect(text).toContain("来自网关和客户端的在线信标。");
    expect(text).toContain("尚无实例上报。");
    expect(text).toContain("刷新");
  });

  it("renders logs and skills views in simplified Chinese", () => {
    const logsText = renderText(renderLogs(createLogsProps()));
    const skillsText = renderText(renderSkills(createSkillsProps()));

    expect(logsText).toContain("日志");
    expect(logsText).toContain("自动跟随");
    expect(logsText).toContain("信息");
    expect(skillsText).toContain("技能");
    expect(skillsText).toContain("工作区来源");
    expect(skillsText).toContain("可用");
  });

  it("renders agents view shell in simplified Chinese", () => {
    const text = renderText(renderAgents(createAgentsProps()));

    expect(text).toContain("代理");
    expect(text).toContain("概览");
    expect(text).toContain("主模型");
    expect(text).toContain("技能筛选");
    expect(text).toContain("重新加载配置");
  });

  it("renders knowledge view content in simplified Chinese and scopes sources by agent", () => {
    const container = document.createElement("div");
    render(renderKnowledge(createKnowledgeProps()), container);

    const text = container.textContent ?? "";
    const rowIds = Array.from(
      container.querySelectorAll<HTMLTableRowElement>("tbody tr[data-knowledge-source]"),
    ).map((row) => row.getAttribute("data-knowledge-source"));

    expect(text).toContain("知识库");
    expect(text).toContain("知识源列表");
    expect(text).toContain("已同步数据");
    expect(text).toContain("销售知识库");
    expect(text).toContain("销售手册");
    expect(text).toContain("总部知识库");
    expect(text).toContain("钉钉 Stream");
    expect(text).not.toContain("运营知识库");
    expect(rowIds).toEqual(["dingtalk-connector:relay-main"]);
  });

  it("uses the knowledge tab label and route", async () => {
    await i18n.setLocale("zh-CN");

    expect(titleForTab("knowledge")).toBe("知识库");
    expect(pathForTab("knowledge")).toBe("/knowledge");
    expect(tabFromPath("/knowledge")).toBe("knowledge");
  });

  it("fires knowledge sync using the selected agent binding", () => {
    const onSyncSource = vi.fn();
    const container = document.createElement("div");
    render(
      renderKnowledge({
        ...createKnowledgeProps(),
        onSyncSource,
      }),
      container,
    );

    container
      .querySelector<HTMLButtonElement>('[data-knowledge-sync="dingtalk-connector:relay-main"]')
      ?.click();

    expect(onSyncSource).toHaveBeenCalledWith({
      channelId: "dingtalk-connector",
      accountId: "relay-main",
      agentId: "alpha",
      operatorId: "union-main",
      workspaceIds: ["sales", "pricing"],
      maxWorkspaces: undefined,
      maxNodesPerWorkspace: undefined,
    });
  });

  it("edits and saves operatorId from the knowledge list", () => {
    const onOperatorDraftChange = vi.fn();
    const onSaveOperator = vi.fn();
    const container = document.createElement("div");

    render(
      renderKnowledge({
        ...createKnowledgeProps(),
        operatorDrafts: { "dingtalk-connector:relay-main": "union-updated" },
        onOperatorDraftChange,
        onSaveOperator,
      }),
      container,
    );

    const input = container.querySelector<HTMLInputElement>(
      '[data-knowledge-operator-input="dingtalk-connector:relay-main"]',
    );
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    container
      .querySelector<HTMLButtonElement>(
        '[data-knowledge-operator-save="dingtalk-connector:relay-main"]',
      )
      ?.click();

    expect(onOperatorDraftChange).toHaveBeenCalled();
    expect(onSaveOperator).toHaveBeenCalledWith({
      sourceKey: "dingtalk-connector:relay-main",
      operatorPath: [
        "channels",
        "dingtalk-connector",
        "accounts",
        "relay-main",
        "knowledgeBaseSync",
        "operatorId",
      ],
      operatorId: "union-updated",
    });
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-knowledge-sync="dingtalk-connector:relay-main"]',
      )?.disabled,
    ).toBe(true);
  });

  it("shows historical cache warning when cached data exists without a current binding", () => {
    const container = document.createElement("div");
    render(
      renderKnowledge({
        ...createKnowledgeProps(),
        selectedAgentId: "beta",
        dataResult: {
          ...createKnowledgeProps().dataResult!,
          agentId: "beta",
          workspaceDir: "/tmp/beta",
          outputRootDir: "/tmp/beta/memory/dingtalk-kb",
          workspaces: [
            {
              ...createKnowledgeProps().dataResult!.workspaces[0],
              accountId: "relay-main",
            },
          ],
        },
        syncResult: null,
      }),
      container,
    );

    const text = container.textContent ?? "";
    expect(text).toContain("历史缓存");
    expect(text).toContain("根据工作区里最近落盘的知识库数据回推");
  });

  it("confirms and clears knowledge cache for the selected agent", () => {
    const onClearData = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const container = document.createElement("div");

    render(
      renderKnowledge({
        ...createKnowledgeProps(),
        onClearData,
      }),
      container,
    );

    container.querySelector<HTMLButtonElement>(".knowledge-section-header__actions .btn")?.click();

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClearData).toHaveBeenCalledWith("alpha");

    confirmSpy.mockRestore();
  });

  it("renders sessions, nodes, and cron views in simplified Chinese", () => {
    const sessionsText = renderText(renderSessions(createSessionsProps()));
    const nodesText = renderText(renderNodes(createNodesProps()));
    const cronText = renderText(renderCron(createCronProps()));

    expect(sessionsText).toContain("会话");
    expect(sessionsText).toContain("活跃时长");
    expect(sessionsText).toContain("未找到会话。");

    expect(nodesText).toContain("节点");
    expect(nodesText).toContain("设备");
    expect(nodesText).toContain("Exec 审批");

    expect(cronText).toContain("新建任务");
    expect(cronText).toContain("会话键");
    expect(cronText).toContain("失败告警");
  });

  it("filters channel logs using channel-specific keywords", () => {
    const entries = [
      { raw: "telegram worker started", message: "telegram worker started" },
      {
        raw: "dingtalk-connector mode: stream connect success",
        message: "dingtalk-connector mode: stream connect success",
      },
      {
        raw: "dingtalk-enterprise callback received",
        message: "dingtalk-enterprise callback received",
      },
      { raw: "discord bot ready", message: "discord bot ready" },
    ];

    expect(filterChannelLogs(entries, "telegram", null)).toHaveLength(1);
    expect(filterChannelLogs(entries, "telegram", null)[0]?.message).toContain("telegram");
    expect(filterChannelLogs(entries, "dingtalk-connector", null)).toHaveLength(1);
    expect(filterChannelLogs(entries, "dingtalk-connector", null)[0]?.message).toContain("stream");
    expect(filterChannelLogs(entries, "dingtalk-enterprise", null)).toHaveLength(1);
    expect(filterChannelLogs(entries, "dingtalk-enterprise", null)[0]?.message).toContain(
      "callback",
    );
  });
});
