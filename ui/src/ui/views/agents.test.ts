import { render } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { renderAgents, type AgentsProps } from "./agents.ts";

function createSkill() {
  return {
    name: "Repo Skill",
    description: "Skill description",
    source: "workspace",
    filePath: "/tmp/skill",
    baseDir: "/tmp",
    skillKey: "repo-skill",
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: true,
    requirements: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    missing: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    configChecks: [],
    install: [],
  };
}

function createProps(overrides: Partial<AgentsProps> = {}): AgentsProps {
  return {
    basePath: "",
    loading: false,
    error: null,
    agentsList: {
      defaultId: "alpha",
      mainKey: "main",
      scope: "workspace",
      agents: [{ id: "alpha", name: "Alpha" } as never, { id: "beta", name: "Beta" } as never],
    },
    selectedAgentId: "beta",
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
    ...overrides,
  };
}

describe("renderAgents", () => {
  beforeEach(async () => {
    await i18n.setLocale("en");
  });

  it("shows the skills count only for the selected agent's report", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          agentSkills: {
            report: {
              workspaceDir: "/tmp/workspace",
              managedSkillsDir: "/tmp/skills",
              skills: [createSkill()],
            },
            loading: false,
            error: null,
            agentId: "alpha",
            filter: "",
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    const skillsTab = Array.from(container.querySelectorAll<HTMLButtonElement>(".agent-tab")).find(
      (button) => button.textContent?.includes("Skills"),
    );

    expect(skillsTab?.textContent?.trim()).toBe("Skills");
  });

  it("shows the selected agent's skills count when the report matches", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          agentSkills: {
            report: {
              workspaceDir: "/tmp/workspace",
              managedSkillsDir: "/tmp/skills",
              skills: [createSkill()],
            },
            loading: false,
            error: null,
            agentId: "beta",
            filter: "",
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    const skillsTab = Array.from(container.querySelectorAll<HTMLButtonElement>(".agent-tab")).find(
      (button) => button.textContent?.includes("Skills"),
    );

    expect(skillsTab?.textContent?.trim()).toContain("1");
  });

  it("opens the create-agent dialog and submits a new agent draft", async () => {
    const container = document.createElement("div");
    const onCreateAgent = vi.fn();
    const props = createProps({
      channels: {
        snapshot: {
          ts: 1,
          channelOrder: ["telegram", "feishu"],
          channelLabels: {},
          channels: {},
          channelAccounts: {
            telegram: [{ accountId: "work", displayName: "工作号" }],
          },
          channelDefaultAccountId: {},
        },
        loading: false,
        error: null,
        lastSuccess: null,
      },
      config: {
        form: {
          agents: {
            defaults: {
              workspace: "/tmp/openclaw/workspace",
            },
          },
        },
        loading: false,
        saving: false,
        dirty: false,
      },
      onCreateAgent,
    });
    render(renderAgents(props), container);
    await Promise.resolve();

    const openButton = container.querySelector<HTMLButtonElement>("[data-agent-create-open]");
    openButton?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-create-dialog]");
    expect(dialog?.hasAttribute("open")).toBe(true);

    const idInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-id]");
    const nameInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-name]");
    const workspaceInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-workspace]");
    const bindingChannelInput = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-channel]",
    );
    const bindingAccountInput = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-account]",
    );
    const form = dialog?.querySelector<HTMLFormElement>("form");

    bindingChannelInput!.value = "telegram";
    bindingChannelInput!.dispatchEvent(new Event("change", { bubbles: true }));
    bindingAccountInput!.value = "work";
    bindingAccountInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    expect(idInput!.value).toBe("work");
    expect(nameInput!.value).toBe("工作号");
    expect(workspaceInput!.value).toBe("/tmp/openclaw/workspace-work");

    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(onCreateAgent).toHaveBeenCalledWith({
      id: "work",
      name: "工作号",
      workspace: "/tmp/openclaw/workspace-work",
      makeDefault: false,
      binding: {
        channel: "telegram",
        accountId: "work",
      },
    });
    expect(dialog?.hasAttribute("open")).toBe(false);
  });

  it("shows channel account options from config and runtime snapshot", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          channels: {
            snapshot: {
              ts: 1,
              channelOrder: ["dingtalk-connector"],
              channelLabels: {},
              channels: {},
              channelAccounts: {
                "dingtalk-connector": [{ accountId: "xiaolong", displayName: "小龙" }],
              },
              channelDefaultAccountId: {},
            },
            loading: false,
            error: null,
            lastSuccess: null,
          },
          config: {
            form: {
              agents: {
                defaults: {
                  workspace: "/tmp/openclaw/workspace",
                },
              },
              channels: {
                "dingtalk-connector": {
                  accounts: {
                    fengqingxia: { displayName: "蜂擎侠" },
                    xiaolong: { displayName: "小龙" },
                  },
                },
              },
            },
            loading: false,
            saving: false,
            dirty: false,
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    container.querySelector<HTMLButtonElement>("[data-agent-create-open]")?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-create-dialog]");
    const channelSelect = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-channel]",
    );
    const accountSelect = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-account]",
    );

    channelSelect!.value = "dingtalk-connector";
    channelSelect!.dispatchEvent(new Event("change", { bubbles: true }));

    const values = Array.from(accountSelect?.querySelectorAll("option") ?? []).map((option) =>
      option.getAttribute("value"),
    );

    expect(values).toContain("fengqingxia");
    expect(values).toContain("xiaolong");
  });

  it("keeps manual agent fields when account selection changes", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          channels: {
            snapshot: {
              ts: 1,
              channelOrder: ["dingtalk-connector"],
              channelLabels: {},
              channels: {},
              channelAccounts: {
                "dingtalk-connector": [
                  { accountId: "fengqingxia", displayName: "蜂擎侠" },
                  { accountId: "xiaolong", displayName: "小龙" },
                ],
              },
              channelDefaultAccountId: {},
            },
            loading: false,
            error: null,
            lastSuccess: null,
          },
          config: {
            form: {
              agents: {
                defaults: {
                  workspace: "/tmp/openclaw/workspace",
                },
              },
            },
            loading: false,
            saving: false,
            dirty: false,
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    container.querySelector<HTMLButtonElement>("[data-agent-create-open]")?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-create-dialog]");
    const idInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-id]");
    const nameInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-name]");
    const workspaceInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-workspace]");
    const channelSelect = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-channel]",
    );
    const accountSelect = dialog?.querySelector<HTMLSelectElement>(
      "[data-agent-create-binding-account]",
    );

    idInput!.value = "custom-agent";
    idInput!.dispatchEvent(new Event("input", { bubbles: true }));
    nameInput!.value = "自定义代理";
    nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    workspaceInput!.value = "/tmp/custom-workspace";
    workspaceInput!.dispatchEvent(new Event("input", { bubbles: true }));

    channelSelect!.value = "dingtalk-connector";
    channelSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    accountSelect!.value = "xiaolong";
    accountSelect!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(idInput!.value).toBe("custom-agent");
    expect(nameInput!.value).toBe("自定义代理");
    expect(workspaceInput!.value).toBe("/tmp/custom-workspace");
  });

  it("blocks duplicate agent ids in the create-agent dialog", async () => {
    const container = document.createElement("div");
    const onCreateAgent = vi.fn();
    render(
      renderAgents(
        createProps({
          config: {
            form: {
              agents: {
                defaults: {
                  workspace: "/tmp/openclaw/workspace",
                },
              },
            },
            loading: false,
            saving: false,
            dirty: false,
          },
          onCreateAgent,
        }),
      ),
      container,
    );
    await Promise.resolve();

    container.querySelector<HTMLButtonElement>("[data-agent-create-open]")?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-create-dialog]");
    const idInput = dialog?.querySelector<HTMLInputElement>("[data-agent-create-id]");
    const form = dialog?.querySelector<HTMLFormElement>("form");
    const error = dialog?.querySelector<HTMLElement>("[data-agent-create-error]");

    idInput!.value = "alpha";
    idInput!.dispatchEvent(new Event("input", { bubbles: true }));
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onCreateAgent).not.toHaveBeenCalled();
    expect(error?.textContent).toContain("already exists");
    expect(dialog?.hasAttribute("open")).toBe(true);
  });

  it("shows the files workspace guide and core file descriptions", async () => {
    const container = document.createElement("div");
    render(
      renderAgents(
        createProps({
          activePanel: "files",
          agentFiles: {
            list: {
              agentId: "beta",
              workspace: "/tmp/openclaw/workspace-beta",
              files: [
                {
                  name: "SOUL.md",
                  path: "/tmp/openclaw/workspace-beta/SOUL.md",
                  missing: false,
                  size: 120,
                  updatedAtMs: Date.now(),
                },
                {
                  name: "IDENTITY.md",
                  path: "/tmp/openclaw/workspace-beta/IDENTITY.md",
                  missing: true,
                },
                {
                  name: "TOOLS.md",
                  path: "/tmp/openclaw/workspace-beta/TOOLS.md",
                  missing: false,
                  size: 80,
                  updatedAtMs: Date.now(),
                },
              ],
            },
            loading: false,
            error: null,
            active: null,
            contents: {},
            drafts: {},
            saving: false,
          },
        }),
      ),
      container,
    );
    await Promise.resolve();

    const text = container.textContent ?? "";
    expect(text).toContain("Each agent should own its bootstrap files");
    expect(text).toContain("Persona");
    expect(text).toContain("Identity");
    expect(text).toContain("Tool Notes");
    expect(text).toContain("Open Skills");
  });

  it("opens the bindings dialog and submits an exact account binding", async () => {
    const container = document.createElement("div");
    const onSaveBinding = vi.fn();
    render(
      renderAgents(
        createProps({
          activePanel: "bindings",
          config: {
            form: {
              bindings: [],
            },
            loading: false,
            saving: false,
            dirty: false,
          },
          channels: {
            snapshot: {
              ts: 1,
              channelOrder: ["dingtalk-connector", "telegram"],
              channelLabels: {
                "dingtalk-connector": "DingTalk",
              },
              channels: {},
              channelAccounts: {
                "dingtalk-connector": [{ accountId: "xiaolong" } as never],
              },
              channelDefaultAccountId: {},
            },
            loading: false,
            error: null,
            lastSuccess: null,
          },
          onSaveBinding,
        }),
      ),
      container,
    );
    await Promise.resolve();

    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Add Binding"),
    );
    addButton?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-binding-dialog]");
    expect(dialog?.hasAttribute("open")).toBe(true);

    const channelInput = dialog?.querySelector<HTMLInputElement>("[data-agent-binding-channel]");
    const accountInput = dialog?.querySelector<HTMLInputElement>("[data-agent-binding-account]");
    const commentInput = dialog?.querySelector<HTMLInputElement>("[data-agent-binding-comment]");
    const form = dialog?.querySelector<HTMLFormElement>("form");

    channelInput!.value = "telegram";
    accountInput!.value = "ops";
    commentInput!.value = "Ops bot";

    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onSaveBinding).toHaveBeenCalledWith("beta", null, {
      channel: "telegram",
      accountId: "ops",
      comment: "Ops bot",
    });
    expect(dialog?.hasAttribute("open")).toBe(false);
  });

  it("blocks duplicate exact bindings owned by another agent", async () => {
    const container = document.createElement("div");
    const onSaveBinding = vi.fn();
    render(
      renderAgents(
        createProps({
          activePanel: "bindings",
          config: {
            form: {
              bindings: [
                {
                  agentId: "alpha",
                  match: {
                    channel: "dingtalk-connector",
                    accountId: "fengqingxia",
                  },
                },
              ],
            },
            loading: false,
            saving: false,
            dirty: false,
          },
          onSaveBinding,
        }),
      ),
      container,
    );
    await Promise.resolve();

    const addButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Add Binding"),
    );
    addButton?.click();
    await Promise.resolve();

    const dialog = container.querySelector<HTMLDialogElement>("[data-agent-binding-dialog]");
    const channelInput = dialog?.querySelector<HTMLInputElement>("[data-agent-binding-channel]");
    const accountInput = dialog?.querySelector<HTMLInputElement>("[data-agent-binding-account]");
    const form = dialog?.querySelector<HTMLFormElement>("form");
    const error = dialog?.querySelector<HTMLElement>("[data-agent-binding-error]");

    channelInput!.value = "dingtalk-connector";
    accountInput!.value = "fengqingxia";
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onSaveBinding).not.toHaveBeenCalled();
    expect(error?.textContent).toContain("alpha");
    expect(dialog?.hasAttribute("open")).toBe(true);
  });
});
