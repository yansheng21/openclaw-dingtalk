/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/index.ts";
import { renderSkills } from "./skills.ts";

const AGENT_CONFIG_FORM = {
  agents: {
    list: [
      { id: "fengqingxia", skills: ["weather"] },
      { id: "xiaolong", skills: ["github"] },
    ],
  },
};

describe("skills view", () => {
  it("renders agent controls for per-agent skill management", async () => {
    await i18n.setLocale("zh-CN");
    const onAgentChange = vi.fn();
    const onOpenAgentSkills = vi.fn();
    const container = document.createElement("div");

    render(
      renderSkills({
        connected: true,
        loading: false,
        report: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [],
        },
        error: null,
        filter: "",
        page: 0,
        configForm: null,
        configLoading: false,
        selectedAgentReport: null,
        selectedAgentReportAgentId: null,
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [
            { id: "fengqingxia", name: "蜂擎侠" },
            { id: "xiaolong", name: "小龙" },
          ],
        },
        selectedAgentId: "xiaolong",
        edits: {},
        busyKey: null,
        messages: {},
        onFilterChange: () => undefined,
        onPageChange: () => undefined,
        onAgentChange,
        onOpenAgentSkills,
        onRefresh: () => undefined,
        onToggle: () => undefined,
        onEdit: () => undefined,
        onSaveKey: () => undefined,
        onInstall: () => undefined,
      }),
      container,
    );

    const select = container.querySelector<HTMLSelectElement>("[data-skills-agent-select='true']");
    expect(select).not.toBeNull();
    expect(
      Array.from(select?.querySelectorAll("option") ?? []).map((option) => option.value),
    ).toEqual(["fengqingxia", "xiaolong"]);

    select!.value = "fengqingxia";
    select!.dispatchEvent(new Event("change"));
    expect(onAgentChange).toHaveBeenCalledWith("fengqingxia");

    const openButton = container.querySelector<HTMLButtonElement>(
      "[data-skills-agent-open='xiaolong']",
    );
    expect(openButton?.textContent).toContain("进入代理技能配置");
    openButton?.click();
    expect(onOpenAgentSkills).toHaveBeenCalledWith("xiaolong");
  });

  it("renders the global skills page as a traditional table", async () => {
    await i18n.setLocale("zh-CN");
    const container = document.createElement("div");

    render(
      renderSkills({
        connected: true,
        loading: false,
        report: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [
            {
              name: "weather",
              description: "Weather helper",
              source: "openclaw-bundled",
              filePath: "/tmp/weather/SKILL.md",
              baseDir: "/tmp/weather",
              skillKey: "weather",
              always: false,
              disabled: false,
              blockedByAllowlist: false,
              eligible: true,
              requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
              missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
              configChecks: [],
              install: [],
            },
          ],
        },
        error: null,
        filter: "",
        page: 0,
        configForm: AGENT_CONFIG_FORM,
        configLoading: false,
        selectedAgentReport: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [
            {
              name: "weather",
              description: "Weather helper",
              source: "openclaw-bundled",
              filePath: "/tmp/weather/SKILL.md",
              baseDir: "/tmp/weather",
              skillKey: "weather",
              always: false,
              disabled: false,
              blockedByAllowlist: false,
              eligible: true,
              requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
              missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
              configChecks: [],
              install: [],
            },
          ],
        },
        selectedAgentReportAgentId: "fengqingxia",
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [{ id: "fengqingxia", name: "蜂擎侠" }],
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
      }),
      container,
    );

    const table = container.querySelector<HTMLTableElement>("[data-skills-table='true']");
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain("技能");
    expect(table?.textContent).toContain("来源");
    expect(table?.textContent).toContain("状态");
    expect(table?.textContent).toContain("当前代理");
    expect(table?.textContent).toContain("缺失项");
    expect(table?.textContent).toContain("配置 / 密钥");
    expect(table?.textContent).toContain("操作");
    expect(container.querySelector(".agent-skills-groups")).toBeNull();
  });

  it("reflects the selected agent allowlist in the current agent column", async () => {
    await i18n.setLocale("zh-CN");
    const container = document.createElement("div");
    const report = {
      workspaceDir: "/tmp",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "github",
          description: "GitHub helper",
          source: "openclaw-bundled",
          filePath: "/tmp/github/SKILL.md",
          baseDir: "/tmp/github",
          skillKey: "github",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
        {
          name: "weather",
          description: "Weather helper",
          source: "openclaw-bundled",
          filePath: "/tmp/weather/SKILL.md",
          baseDir: "/tmp/weather",
          skillKey: "weather",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
      ],
    };

    render(
      renderSkills({
        connected: true,
        loading: false,
        report,
        error: null,
        filter: "",
        page: 0,
        configForm: AGENT_CONFIG_FORM,
        configLoading: false,
        selectedAgentReport: report,
        selectedAgentReportAgentId: "xiaolong",
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [
            { id: "fengqingxia", name: "蜂擎侠" },
            { id: "xiaolong", name: "小龙" },
          ],
        },
        selectedAgentId: "xiaolong",
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
      }),
      container,
    );

    expect(container.textContent).toContain("当前代理可用");
    expect(container.textContent).toContain("可用");
    expect(container.textContent).toContain("github");
    expect(container.textContent).not.toContain("weather");
    expect(container.textContent).toContain("小龙");
  });

  it("paginates skills with 10 rows per page", async () => {
    await i18n.setLocale("zh-CN");
    const onPageChange = vi.fn();
    const container = document.createElement("div");

    render(
      renderSkills({
        connected: true,
        loading: false,
        report: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: Array.from({ length: 11 }, (_, index) => ({
            name: `skill-${index + 1}`,
            description: `Skill ${index + 1}`,
            source: "openclaw-bundled",
            filePath: `/tmp/skill-${index + 1}/SKILL.md`,
            baseDir: `/tmp/skill-${index + 1}`,
            skillKey: `skill-${index + 1}`,
            always: false,
            disabled: false,
            blockedByAllowlist: false,
            eligible: true,
            requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
            missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
            configChecks: [],
            install: [],
          })),
        },
        error: null,
        filter: "",
        page: 0,
        configForm: AGENT_CONFIG_FORM,
        configLoading: false,
        selectedAgentReport: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: Array.from({ length: 11 }, (_, index) => ({
            name: `skill-${index + 1}`,
            description: `Skill ${index + 1}`,
            source: "openclaw-bundled",
            filePath: `/tmp/skill-${index + 1}/SKILL.md`,
            baseDir: `/tmp/skill-${index + 1}`,
            skillKey: `skill-${index + 1}`,
            always: false,
            disabled: false,
            blockedByAllowlist: false,
            eligible: true,
            requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
            missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
            configChecks: [],
            install: [],
          })),
        },
        selectedAgentReportAgentId: "fengqingxia",
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [{ id: "fengqingxia", name: "蜂擎侠" }],
        },
        selectedAgentId: "fengqingxia",
        configForm: {
          agents: {
            list: [{ id: "fengqingxia" }],
          },
        },
        edits: {},
        busyKey: null,
        messages: {},
        onFilterChange: () => undefined,
        onPageChange,
        onAgentChange: () => undefined,
        onOpenAgentSkills: () => undefined,
        onRefresh: () => undefined,
        onToggle: () => undefined,
        onEdit: () => undefined,
        onSaveKey: () => undefined,
        onInstall: () => undefined,
      }),
      container,
    );

    const rows = container.querySelectorAll("tbody tr[data-skill-row]");
    expect(rows).toHaveLength(10);
    expect(container.textContent).toContain("1-10 / 共 11 条");
    expect(container.textContent).toContain("每页 10 条");

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".data-table-pagination__controls button"),
    );
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(false);
    buttons[1]?.click();
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("shows clear filter affordance when the search filter hides all skills", async () => {
    await i18n.setLocale("zh-CN");
    const onFilterChange = vi.fn();
    const container = document.createElement("div");

    render(
      renderSkills({
        connected: true,
        loading: false,
        report: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [
            {
              name: "weather",
              description: "Weather helper",
              source: "openclaw-bundled",
              filePath: "/tmp/weather/SKILL.md",
              baseDir: "/tmp/weather",
              skillKey: "weather",
              always: false,
              disabled: false,
              blockedByAllowlist: false,
              eligible: true,
              requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
              missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
              configChecks: [],
              install: [],
            },
          ],
        },
        error: null,
        filter: "admin",
        page: 0,
        configForm: AGENT_CONFIG_FORM,
        configLoading: false,
        selectedAgentReport: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [
            {
              name: "weather",
              description: "Weather helper",
              source: "openclaw-bundled",
              filePath: "/tmp/weather/SKILL.md",
              baseDir: "/tmp/weather",
              skillKey: "weather",
              always: false,
              disabled: false,
              blockedByAllowlist: false,
              eligible: true,
              requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
              missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
              configChecks: [],
              install: [],
            },
          ],
        },
        selectedAgentReportAgentId: "fengqingxia",
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [{ id: "fengqingxia", name: "蜂擎侠" }],
        },
        selectedAgentId: "fengqingxia",
        edits: {},
        busyKey: null,
        messages: {},
        onFilterChange,
        onPageChange: () => undefined,
        onAgentChange: () => undefined,
        onOpenAgentSkills: () => undefined,
        onRefresh: () => undefined,
        onToggle: () => undefined,
        onEdit: () => undefined,
        onSaveKey: () => undefined,
        onInstall: () => undefined,
      }),
      container,
    );

    expect(container.textContent).toContain("蜂擎侠");
    expect(container.textContent).toContain("没有匹配“admin”且可用的技能");
    expect(container.textContent).toContain("共 0 个");

    const clearButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.textContent?.includes("清除筛选"),
    );
    expect(clearButtons.length).toBeGreaterThan(0);
    clearButtons[0]?.click();
    expect(onFilterChange).toHaveBeenCalledWith("");
  });

  it("labels missing requirements as not ready instead of blocked", async () => {
    await i18n.setLocale("zh-CN");
    const container = document.createElement("div");

    render(
      renderSkills({
        connected: true,
        loading: false,
        report: {
          workspaceDir: "/tmp",
          managedSkillsDir: "/tmp/skills",
          skills: [
            {
              name: "github",
              description: "GitHub helper",
              source: "openclaw-bundled",
              filePath: "/tmp/github/SKILL.md",
              baseDir: "/tmp/github",
              skillKey: "github",
              always: false,
              disabled: false,
              blockedByAllowlist: false,
              eligible: false,
              requirements: { bins: ["gh"], anyBins: [], env: [], config: [], os: [] },
              missing: { bins: ["gh"], anyBins: [], env: [], config: [], os: [] },
              configChecks: [],
              install: [],
            },
          ],
        },
        error: null,
        filter: "",
        page: 0,
        configForm: null,
        configLoading: false,
        selectedAgentReport: null,
        selectedAgentReportAgentId: null,
        selectedAgentLoading: false,
        agentsList: null,
        selectedAgentId: null,
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
      }),
      container,
    );

    expect(container.textContent).toContain("未就绪");
    expect(container.textContent).not.toContain("已拦截");
    expect(container.textContent).toContain("命令:gh");
  });

  it("shows only skills available to the selected agent", async () => {
    await i18n.setLocale("zh-CN");
    const container = document.createElement("div");
    const report = {
      workspaceDir: "/tmp",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "github",
          description: "GitHub helper",
          source: "openclaw-bundled",
          filePath: "/tmp/github/SKILL.md",
          baseDir: "/tmp/github",
          skillKey: "github",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
        {
          name: "weather",
          description: "Weather helper",
          source: "openclaw-bundled",
          filePath: "/tmp/weather/SKILL.md",
          baseDir: "/tmp/weather",
          skillKey: "weather",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
      ],
    };

    render(
      renderSkills({
        connected: true,
        loading: false,
        report,
        error: null,
        filter: "",
        page: 0,
        configForm: AGENT_CONFIG_FORM,
        configLoading: false,
        selectedAgentReport: report,
        selectedAgentReportAgentId: "xiaolong",
        selectedAgentLoading: false,
        agentsList: {
          defaultId: "fengqingxia",
          agents: [
            { id: "fengqingxia", name: "蜂擎侠" },
            { id: "xiaolong", name: "小龙" },
          ],
        },
        selectedAgentId: "xiaolong",
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
      }),
      container,
    );

    const rows = Array.from(container.querySelectorAll("tbody tr[data-skill-row]"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("github");
    expect(container.textContent).toContain("已显示 1 个");
    expect(container.textContent).toContain("共 2 个");
    expect(container.textContent).not.toContain("weather");
  });
});
