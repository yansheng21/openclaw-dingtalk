import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
  ToolsCatalogResult,
} from "../types.ts";
import { renderAgentOverview } from "./agents-panels-overview.ts";
import {
  countExactBindingsForAgent,
  renderAgentBindings,
  type AgentBindingDraft,
} from "./agents-panels-bindings.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import { agentBadgeText, buildAgentContext, normalizeAgentLabel } from "./agents-utils.ts";

export type AgentsPanel =
  | "overview"
  | "bindings"
  | "files"
  | "tools"
  | "skills"
  | "channels"
  | "cron";

export type ConfigState = {
  form: Record<string, unknown> | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
};

export type ChannelsState = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
};

export type CronState = {
  status: CronStatus | null;
  jobs: CronJob[];
  loading: boolean;
  error: string | null;
};

export type AgentFilesState = {
  list: AgentsFilesListResult | null;
  loading: boolean;
  error: string | null;
  active: string | null;
  contents: Record<string, string>;
  drafts: Record<string, string>;
  saving: boolean;
};

export type AgentSkillsState = {
  report: SkillStatusReport | null;
  loading: boolean;
  error: string | null;
  agentId: string | null;
  filter: string;
};

export type ToolsCatalogState = {
  loading: boolean;
  error: string | null;
  result: ToolsCatalogResult | null;
};

type JsonRecord = Record<string, unknown>;

export type CreateAgentDraft = {
  id: string;
  name?: string;
  workspace: string;
  makeDefault: boolean;
  binding?: {
    channel: string;
    accountId: string;
  };
};

export type AgentsProps = {
  basePath: string;
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  config: ConfigState;
  channels: ChannelsState;
  cron: CronState;
  agentFiles: AgentFilesState;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkills: AgentSkillsState;
  toolsCatalog: ToolsCatalogState;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onCronRunNow: (jobId: string) => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
  onSetDefault: (agentId: string) => void;
  onCreateAgent: (draft: CreateAgentDraft) => void;
  onSaveBinding: (agentId: string, bindingIndex: number | null, draft: AgentBindingDraft) => void;
  onRemoveBinding: (bindingIndex: number) => void;
  onRequestUpdate?: () => void;
};

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const requestUpdate = props.onRequestUpdate ?? (() => undefined);
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const actionsMenuOpen = Boolean(selectedAgent && actionsMenuAgentId === selectedAgent.id);
  const selectedSkillCount =
    selectedId && props.agentSkills.agentId === selectedId
      ? (props.agentSkills.report?.skills?.length ?? null)
      : null;

  const channelEntryCount = props.channels.snapshot
    ? Object.keys(props.channels.snapshot.channelAccounts ?? {}).length
    : null;
  const cronJobCount = selectedId
    ? props.cron.jobs.filter((j) => j.agentId === selectedId).length
    : null;
  const tabCounts: Record<string, number | null> = {
    bindings: selectedId ? countExactBindingsForAgent(props.config.form, selectedId) : null,
    files: props.agentFiles.list?.files?.length ?? null,
    skills: selectedSkillCount,
    channels: channelEntryCount,
    cron: cronJobCount || null,
  };

  return html`
    <div class="agents-layout">
      <section class="agents-toolbar">
        <div class="agents-toolbar-row">
          <span class="agents-toolbar-label">${t("agentsPage.toolbar.agentLabel")}</span>
          <div class="agents-control-row">
            <div class="agents-control-select">
              <select
                class="agents-select"
                .value=${selectedId ?? ""}
                ?disabled=${props.loading || agents.length === 0}
                @change=${(e: Event) => {
                  actionsMenuAgentId = null;
                  props.onSelectAgent((e.target as HTMLSelectElement).value);
                }}
              >
                ${
                  agents.length === 0
                    ? html`
                        <option value="">${t("agentsPage.toolbar.noAgents")}</option>
                      `
                    : agents.map(
                        (agent) => html`
                        <option value=${agent.id} ?selected=${agent.id === selectedId}>
                          ${normalizeAgentLabel(agent)}${agentBadgeText(agent.id, defaultId) ? ` (${agentBadgeText(agent.id, defaultId)})` : ""}
                        </option>
                      `,
                      )
                }
              </select>
            </div>
            <div class="agents-control-actions">
              ${
                selectedAgent
                  ? html`
                      <div class="agent-actions-wrap">
                        <button
                          class="agent-actions-toggle"
                          type="button"
                          @click=${() => {
                            actionsMenuAgentId =
                              actionsMenuAgentId === selectedAgent.id ? null : selectedAgent.id;
                            requestUpdate();
                          }}
                        >⋯</button>
                        ${
                          actionsMenuOpen
                            ? html`
                                <div class="agent-actions-menu">
                                  <button type="button" @click=${() => {
                                    void navigator.clipboard.writeText(selectedAgent.id);
                                    actionsMenuAgentId = null;
                                    requestUpdate();
                                  }}>${t("agentsPage.toolbar.copyAgentId")}</button>
                                  <button
                                    type="button"
                                    ?disabled=${Boolean(defaultId && selectedAgent.id === defaultId)}
                                    @click=${() => {
                                      props.onSetDefault(selectedAgent.id);
                                      actionsMenuAgentId = null;
                                      requestUpdate();
                                    }}
                                  >
                                    ${
                                      defaultId && selectedAgent.id === defaultId
                                        ? t("agentsPage.toolbar.alreadyDefault")
                                        : t("agentsPage.toolbar.setAsDefault")
                                    }
                                  </button>
                                </div>
                              `
                            : nothing
                        }
                      </div>
                    `
                  : nothing
              }
              <button
                class="btn btn--sm primary"
                type="button"
                data-agent-create-open
                ?disabled=${props.config.loading || !props.config.form}
                @click=${(event: Event) => {
                  const dialog = (event.currentTarget as HTMLElement)
                    .closest(".agents-layout")
                    ?.querySelector<HTMLDialogElement>("[data-agent-create-dialog]");
                  if (!(dialog instanceof HTMLDialogElement)) {
                    return;
                  }
                  actionsMenuAgentId = null;
                  requestUpdate();
                  seedCreateAgentDialog(dialog, props.config.form);
                  showDialog(dialog);
                  dialog.querySelector<HTMLInputElement>("[data-agent-create-id]")?.focus();
                }}
              >
                ${t("agentsPage.toolbar.addAgent")}
              </button>
              <button class="btn btn--sm agents-refresh-btn" ?disabled=${props.loading} @click=${props.onRefresh}>
                ${props.loading ? t("agentsPage.shared.loading") : t("common.refresh")}
              </button>
            </div>
          </div>
        </div>
        ${
          props.error
            ? html`<div class="callout danger" style="margin-top: 8px;">${props.error}</div>`
            : nothing
        }
      </section>
      ${renderCreateAgentDialog(props, agents)}
      <section class="agents-main">
        ${
          !selectedAgent
            ? html`
                <div class="card">
                  <div class="card-title">${t("agentsPage.toolbar.selectAgentTitle")}</div>
                  <div class="card-sub">${t("agentsPage.toolbar.selectAgentSubtitle")}</div>
                </div>
              `
            : html`
                ${renderAgentTabs(props.activePanel, (panel) => props.onSelectPanel(panel), tabCounts)}
                ${
                  props.activePanel === "overview"
                    ? renderAgentOverview({
                        agent: selectedAgent,
                        basePath: props.basePath,
                        defaultId,
                        configForm: props.config.form,
                        agentFilesList: props.agentFiles.list,
                        agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                        agentIdentityError: props.agentIdentityError,
                        agentIdentityLoading: props.agentIdentityLoading,
                        configLoading: props.config.loading,
                        configSaving: props.config.saving,
                        configDirty: props.config.dirty,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                        onModelChange: props.onModelChange,
                        onModelFallbacksChange: props.onModelFallbacksChange,
                        onSelectPanel: props.onSelectPanel,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "bindings"
                    ? renderAgentBindings({
                        agentId: selectedAgent.id,
                        context: buildAgentContext(
                          selectedAgent,
                          props.config.form,
                          props.agentFiles.list,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        configForm: props.config.form,
                        configLoading: props.config.loading,
                        configSaving: props.config.saving,
                        configDirty: props.config.dirty,
                        snapshot: props.channels.snapshot,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                        onSaveBinding: props.onSaveBinding,
                        onRemoveBinding: props.onRemoveBinding,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "files"
                    ? renderAgentFiles({
                        agentId: selectedAgent.id,
                        agentFilesList: props.agentFiles.list,
                        agentFilesLoading: props.agentFiles.loading,
                        agentFilesError: props.agentFiles.error,
                        agentFileActive: props.agentFiles.active,
                        agentFileContents: props.agentFiles.contents,
                        agentFileDrafts: props.agentFiles.drafts,
                        agentFileSaving: props.agentFiles.saving,
                        onLoadFiles: props.onLoadFiles,
                        onSelectFile: props.onSelectFile,
                        onFileDraftChange: props.onFileDraftChange,
                        onFileReset: props.onFileReset,
                        onFileSave: props.onFileSave,
                        onOpenTools: () => props.onSelectPanel("tools"),
                        onOpenSkills: () => props.onSelectPanel("skills"),
                      })
                    : nothing
                }
                ${
                  props.activePanel === "tools"
                    ? renderAgentTools({
                        agentId: selectedAgent.id,
                        configForm: props.config.form,
                        configLoading: props.config.loading,
                        configSaving: props.config.saving,
                        configDirty: props.config.dirty,
                        toolsCatalogLoading: props.toolsCatalog.loading,
                        toolsCatalogError: props.toolsCatalog.error,
                        toolsCatalogResult: props.toolsCatalog.result,
                        onProfileChange: props.onToolsProfileChange,
                        onOverridesChange: props.onToolsOverridesChange,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "skills"
                    ? renderAgentSkills({
                        agentId: selectedAgent.id,
                        report: props.agentSkills.report,
                        loading: props.agentSkills.loading,
                        error: props.agentSkills.error,
                        activeAgentId: props.agentSkills.agentId,
                        configForm: props.config.form,
                        configLoading: props.config.loading,
                        configSaving: props.config.saving,
                        configDirty: props.config.dirty,
                        filter: props.agentSkills.filter,
                        onFilterChange: props.onSkillsFilterChange,
                        onRefresh: props.onSkillsRefresh,
                        onToggle: props.onAgentSkillToggle,
                        onClear: props.onAgentSkillsClear,
                        onDisableAll: props.onAgentSkillsDisableAll,
                        onConfigReload: props.onConfigReload,
                        onConfigSave: props.onConfigSave,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "channels"
                    ? renderAgentChannels({
                        context: buildAgentContext(
                          selectedAgent,
                          props.config.form,
                          props.agentFiles.list,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        configForm: props.config.form,
                        snapshot: props.channels.snapshot,
                        loading: props.channels.loading,
                        error: props.channels.error,
                        lastSuccess: props.channels.lastSuccess,
                        onRefresh: props.onChannelsRefresh,
                      })
                    : nothing
                }
                ${
                  props.activePanel === "cron"
                    ? renderAgentCron({
                        context: buildAgentContext(
                          selectedAgent,
                          props.config.form,
                          props.agentFiles.list,
                          defaultId,
                          props.agentIdentityById[selectedAgent.id] ?? null,
                        ),
                        agentId: selectedAgent.id,
                        jobs: props.cron.jobs,
                        status: props.cron.status,
                        loading: props.cron.loading,
                        error: props.cron.error,
                        onRefresh: props.onCronRefresh,
                        onRunNow: props.onCronRunNow,
                      })
                    : nothing
                }
              `
        }
      </section>
    </div>
  `;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function showDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function hideDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

function suggestAgentWorkspace(config: Record<string, unknown> | null, agentId: string): string {
  const suffix = agentId.trim() || "new-agent";
  const defaults = asRecord(asRecord(config?.agents)?.defaults);
  const baseWorkspace = asString(defaults?.workspace);
  if (!baseWorkspace) {
    return `workspace-${suffix}`;
  }
  return `${baseWorkspace}-${suffix}`;
}

function setCreateAgentError(dialog: HTMLDialogElement, message: string | null) {
  const error = dialog.querySelector<HTMLElement>("[data-agent-create-error]");
  if (!error) {
    return;
  }
  if (!message) {
    error.textContent = "";
    error.setAttribute("hidden", "");
    return;
  }
  error.textContent = message;
  error.removeAttribute("hidden");
}

function seedCreateAgentDialog(
  dialog: HTMLDialogElement,
  config: Record<string, unknown> | null,
  seed?: Partial<CreateAgentDraft>,
) {
  const idInput = dialog.querySelector<HTMLInputElement>("[data-agent-create-id]");
  const nameInput = dialog.querySelector<HTMLInputElement>("[data-agent-create-name]");
  const workspaceInput = dialog.querySelector<HTMLInputElement>("[data-agent-create-workspace]");
  const defaultInput = dialog.querySelector<HTMLInputElement>("[data-agent-create-default]");
  const bindingChannelInput = dialog.querySelector<HTMLInputElement>(
    "[data-agent-create-binding-channel]",
  );
  const bindingAccountInput = dialog.querySelector<HTMLInputElement>(
    "[data-agent-create-binding-account]",
  );
  const id = seed?.id?.trim() ?? "";
  if (idInput) {
    idInput.value = id;
  }
  if (nameInput) {
    nameInput.value = seed?.name?.trim() ?? "";
  }
  if (workspaceInput) {
    workspaceInput.value = seed?.workspace?.trim() || suggestAgentWorkspace(config, id);
    workspaceInput.dataset.autogenerated = seed?.workspace?.trim() ? "false" : "true";
  }
  if (defaultInput) {
    defaultInput.checked = Boolean(seed?.makeDefault);
  }
  if (bindingChannelInput) {
    bindingChannelInput.value = seed?.binding?.channel?.trim() ?? "";
  }
  if (bindingAccountInput) {
    bindingAccountInput.value = seed?.binding?.accountId?.trim() ?? "";
  }
  setCreateAgentError(dialog, null);
}

function validateCreateAgentDraft(
  draft: CreateAgentDraft,
  agents: AgentsListResult["agents"],
): { field: "id" | "workspace"; message: string } | null {
  if (!draft.id.trim()) {
    return { field: "id", message: t("agentsPage.create.requiredId") };
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(draft.id.trim())) {
    return { field: "id", message: t("agentsPage.create.invalidId") };
  }
  if (agents.some((agent) => agent.id === draft.id.trim())) {
    return { field: "id", message: t("agentsPage.create.duplicateId") };
  }
  if (!draft.workspace.trim()) {
    return { field: "workspace", message: t("agentsPage.create.requiredWorkspace") };
  }
  const bindingChannel = draft.binding?.channel?.trim() ?? "";
  const bindingAccountId = draft.binding?.accountId?.trim() ?? "";
  if ((bindingChannel && !bindingAccountId) || (!bindingChannel && bindingAccountId)) {
    return { field: "workspace", message: t("agentsPage.create.bindingIncomplete") };
  }
  return null;
}

function renderCreateAgentDialog(
  props: AgentsProps,
  agents: AgentsListResult["agents"],
): TemplateResult {
  const channelOptions = Array.from(
    new Set(
      [
        ...(props.channels.snapshot?.channelOrder ?? []),
        ...Object.keys(props.channels.snapshot?.channelAccounts ?? {}),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  return html`
    <dialog
      class="agent-create-dialog"
      data-agent-create-dialog
      @click=${(event: Event) => {
        const dialog = event.currentTarget as HTMLDialogElement;
        if (event.target === dialog) {
          hideDialog(dialog);
        }
      }}
    >
      <form
        class="agent-create-dialog__panel"
        method="dialog"
        @submit=${(event: Event) => {
          event.preventDefault();
          const form = event.currentTarget as HTMLFormElement;
          const dialog = form.closest("dialog");
          if (!(dialog instanceof HTMLDialogElement)) {
            return;
          }
          const idInput = form.querySelector<HTMLInputElement>("[data-agent-create-id]");
          const nameInput = form.querySelector<HTMLInputElement>("[data-agent-create-name]");
          const workspaceInput = form.querySelector<HTMLInputElement>("[data-agent-create-workspace]");
          const defaultInput = form.querySelector<HTMLInputElement>("[data-agent-create-default]");
          const bindingChannelInput = form.querySelector<HTMLInputElement>(
            "[data-agent-create-binding-channel]",
          );
          const bindingAccountInput = form.querySelector<HTMLInputElement>(
            "[data-agent-create-binding-account]",
          );
          const bindingChannel = bindingChannelInput?.value.trim() ?? "";
          const bindingAccountId = bindingAccountInput?.value.trim() ?? "";
          const draft: CreateAgentDraft = {
            id: idInput?.value.trim() ?? "",
            name: nameInput?.value.trim() || undefined,
            workspace: workspaceInput?.value.trim() ?? "",
            makeDefault: Boolean(defaultInput?.checked),
            ...(bindingChannel && bindingAccountId
              ? {
                  binding: {
                    channel: bindingChannel,
                    accountId: bindingAccountId,
                  },
                }
              : {}),
          };
          const error = validateCreateAgentDraft(draft, agents);
          if (error) {
            setCreateAgentError(dialog, error.message);
            if (error.field === "id") {
              idInput?.focus();
            } else {
              workspaceInput?.focus();
            }
            return;
          }
          props.onCreateAgent(draft);
          hideDialog(dialog);
          seedCreateAgentDialog(dialog, props.config.form);
        }}
      >
        <div class="agent-create-dialog__head">
          <div>
            <div class="agent-create-dialog__title">${t("agentsPage.create.title")}</div>
            <div class="agent-create-dialog__sub">${t("agentsPage.create.subtitle")}</div>
          </div>
          <button
            type="button"
            class="btn btn--sm"
            @click=${(event: Event) => {
              const dialog = (event.currentTarget as HTMLElement).closest("dialog");
              if (dialog instanceof HTMLDialogElement) {
                hideDialog(dialog);
              }
            }}
          >
            ${t("agentsPage.shared.close")}
          </button>
        </div>
        <div class="agent-create-dialog__body">
          <label class="field">
            <span>${t("agentsPage.create.idLabel")}</span>
            <input
              data-agent-create-id
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="xiaolong"
              @input=${(event: Event) => {
                const input = event.currentTarget as HTMLInputElement;
                const dialog = input.closest("dialog");
                if (!(dialog instanceof HTMLDialogElement)) {
                  return;
                }
                const workspaceInput = dialog.querySelector<HTMLInputElement>(
                  "[data-agent-create-workspace]",
                );
                setCreateAgentError(dialog, null);
                if (workspaceInput && workspaceInput.dataset.autogenerated !== "false") {
                  workspaceInput.value = suggestAgentWorkspace(props.config.form, input.value);
                  workspaceInput.dataset.autogenerated = "true";
                }
              }}
            />
            <small>${t("agentsPage.create.idHelp")}</small>
          </label>
          <label class="field">
            <span>${t("agentsPage.create.nameLabel")}</span>
            <input
              data-agent-create-name
              type="text"
              autocomplete="off"
              placeholder="小龙"
              @input=${(event: Event) => {
                const dialog = (event.currentTarget as HTMLElement).closest("dialog");
                if (dialog instanceof HTMLDialogElement) {
                  setCreateAgentError(dialog, null);
                }
              }}
            />
            <small>${t("agentsPage.create.nameHelp")}</small>
          </label>
          <label class="field">
            <span>${t("agentsPage.create.workspaceLabel")}</span>
            <input
              data-agent-create-workspace
              type="text"
              autocomplete="off"
              spellcheck="false"
              @input=${(event: Event) => {
                const input = event.currentTarget as HTMLInputElement;
                const dialog = input.closest("dialog");
                input.dataset.autogenerated = "false";
                if (dialog instanceof HTMLDialogElement) {
                  setCreateAgentError(dialog, null);
                }
              }}
            />
            <small>${t("agentsPage.create.workspaceHelp")}</small>
          </label>
          <label class="field checkbox agent-create-dialog__checkbox">
            <input data-agent-create-default type="checkbox" />
            <span>${t("agentsPage.create.defaultLabel")}</span>
          </label>
          <div class="agent-create-dialog__binding">
            <div class="agent-create-dialog__binding-title">
              ${t("agentsPage.create.bindingTitle")}
            </div>
            <div class="agent-create-dialog__binding-sub">
              ${t("agentsPage.create.bindingSub")}
            </div>
            <div class="channels-form-grid" style="margin-top: 12px;">
              <label class="field">
                <span>${t("agentsPage.create.bindingChannelLabel")}</span>
                <input
                  data-agent-create-binding-channel
                  type="text"
                  list="agent-create-binding-channels"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="telegram"
                  @input=${(event: Event) => {
                    const dialog = (event.currentTarget as HTMLElement).closest("dialog");
                    if (dialog instanceof HTMLDialogElement) {
                      setCreateAgentError(dialog, null);
                    }
                  }}
                />
              </label>
              <label class="field">
                <span>${t("agentsPage.create.bindingAccountLabel")}</span>
                <input
                  data-agent-create-binding-account
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="work"
                  @input=${(event: Event) => {
                    const dialog = (event.currentTarget as HTMLElement).closest("dialog");
                    if (dialog instanceof HTMLDialogElement) {
                      setCreateAgentError(dialog, null);
                    }
                  }}
                />
              </label>
            </div>
            <datalist id="agent-create-binding-channels">
              ${channelOptions.map((channel) => html`<option value=${channel}></option>`)}
            </datalist>
          </div>
          <div class="agent-create-dialog__hint">${t("agentsPage.create.bindingHint")}</div>
          <div
            class="callout danger"
            data-agent-create-error
            hidden
          ></div>
        </div>
        <div class="agent-create-dialog__actions">
          <button
            type="button"
            class="btn btn--sm"
            @click=${(event: Event) => {
              const dialog = (event.currentTarget as HTMLElement).closest("dialog");
              if (dialog instanceof HTMLDialogElement) {
                hideDialog(dialog);
              }
            }}
          >
            ${t("agentsPage.create.cancel")}
          </button>
          <button type="submit" class="btn btn--sm primary" data-agent-create-save>
            ${t("agentsPage.create.create")}
          </button>
        </div>
      </form>
    </dialog>
  `;
}

let actionsMenuAgentId: string | null = null;

function renderAgentTabs(
  active: AgentsPanel,
  onSelect: (panel: AgentsPanel) => void,
  counts: Record<string, number | null>,
) {
  const tabs: Array<{ id: AgentsPanel; label: string }> = [
    { id: "overview", label: t("tabs.overview") },
    { id: "bindings", label: t("agentsPage.tabs.bindings") },
    { id: "files", label: t("agentsPage.tabs.files") },
    { id: "tools", label: t("agentsPage.tabs.tools") },
    { id: "skills", label: t("tabs.skills") },
    { id: "channels", label: t("tabs.channels") },
    { id: "cron", label: t("agentsPage.tabs.cron") },
  ];
  return html`
    <div class="agent-tabs">
      ${tabs.map(
        (tab) => html`
          <button
            class="agent-tab ${active === tab.id ? "active" : ""}"
            type="button"
            @click=${() => onSelect(tab.id)}
          >
            ${tab.label}${counts[tab.id] != null ? html`<span class="agent-tab-count">${counts[tab.id]}</span>` : nothing}
          </button>
        `,
      )}
    </div>
  `;
}
