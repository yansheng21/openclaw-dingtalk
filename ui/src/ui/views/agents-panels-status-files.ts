import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter.ts";
import type {
  AgentFileEntry,
  AgentsFilesListResult,
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
} from "../types.ts";
import { formatBytes, type AgentContext } from "./agents-utils.ts";
import { resolveChannelExtras as resolveChannelExtrasFromConfig } from "./channel-config-extras.ts";

type AgentCoreFilePreset = {
  name: string;
  titleKey:
    | "bootstrapTitle"
    | "agentsTitle"
    | "soulTitle"
    | "identityTitle"
    | "userTitle"
    | "toolsTitle"
    | "heartbeatTitle"
    | "memoryTitle";
  descriptionKey:
    | "bootstrapDesc"
    | "agentsDesc"
    | "soulDesc"
    | "identityDesc"
    | "userDesc"
    | "toolsDesc"
    | "heartbeatDesc"
    | "memoryDesc";
};

const CORE_FILE_PRESETS: AgentCoreFilePreset[] = [
  { name: "BOOTSTRAP.md", titleKey: "bootstrapTitle", descriptionKey: "bootstrapDesc" },
  { name: "AGENTS.md", titleKey: "agentsTitle", descriptionKey: "agentsDesc" },
  { name: "SOUL.md", titleKey: "soulTitle", descriptionKey: "soulDesc" },
  { name: "IDENTITY.md", titleKey: "identityTitle", descriptionKey: "identityDesc" },
  { name: "USER.md", titleKey: "userTitle", descriptionKey: "userDesc" },
  { name: "TOOLS.md", titleKey: "toolsTitle", descriptionKey: "toolsDesc" },
  { name: "HEARTBEAT.md", titleKey: "heartbeatTitle", descriptionKey: "heartbeatDesc" },
  { name: "MEMORY.md", titleKey: "memoryTitle", descriptionKey: "memoryDesc" },
];

export function renderAgentContextCard(context: AgentContext, subtitle: string) {
  return html`
    <section class="card">
      <div class="card-title">${t("agentsPage.context.title")}</div>
      <div class="card-sub">${subtitle}</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.workspace")}</div>
          <div class="mono">${context.workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.primaryModel")}</div>
          <div class="mono">${context.model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.context.identityName")}</div>
          <div>${context.identityName}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.context.identityAvatar")}</div>
          <div>${context.identityAvatar}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.skillsFilter")}</div>
          <div>${context.skillsLabel}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.default")}</div>
          <div>${context.isDefault ? t("common.yes") : t("common.no")}</div>
        </div>
      </div>
    </section>
  `;
}

type ChannelSummaryEntry = {
  id: string;
  label: string;
  accounts: ChannelAccountSnapshot[];
};

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot, id: string) {
  const meta = snapshot.channelMeta?.find((entry) => entry.id === id);
  if (meta?.label) {
    return meta.label;
  }
  return snapshot.channelLabels?.[id] ?? id;
}

function resolveChannelEntries(snapshot: ChannelsStatusSnapshot | null): ChannelSummaryEntry[] {
  if (!snapshot) {
    return [];
  }
  const ids = new Set<string>();
  for (const id of snapshot.channelOrder ?? []) {
    ids.add(id);
  }
  for (const entry of snapshot.channelMeta ?? []) {
    ids.add(entry.id);
  }
  for (const id of Object.keys(snapshot.channelAccounts ?? {})) {
    ids.add(id);
  }
  const ordered: string[] = [];
  const seed = snapshot.channelOrder?.length ? snapshot.channelOrder : Array.from(ids);
  for (const id of seed) {
    if (!ids.has(id)) {
      continue;
    }
    ordered.push(id);
    ids.delete(id);
  }
  for (const id of ids) {
    ordered.push(id);
  }
  return ordered.map((id) => ({
    id,
    label: resolveChannelLabel(snapshot, id),
    accounts: snapshot.channelAccounts?.[id] ?? [],
  }));
}

const CHANNEL_EXTRA_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;

function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]) {
  let connected = 0;
  let configured = 0;
  let enabled = 0;
  for (const account of accounts) {
    const probeOk =
      account.probe && typeof account.probe === "object" && "ok" in account.probe
        ? Boolean((account.probe as { ok?: unknown }).ok)
        : false;
    const isConnected = account.connected === true || account.running === true || probeOk;
    if (isConnected) {
      connected += 1;
    }
    if (account.configured) {
      configured += 1;
    }
    if (account.enabled) {
      enabled += 1;
    }
  }
  return {
    total: accounts.length,
    connected,
    configured,
    enabled,
  };
}

export function renderAgentChannels(params: {
  context: AgentContext;
  configForm: Record<string, unknown> | null;
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
  onRefresh: () => void;
}) {
  const entries = resolveChannelEntries(params.snapshot);
  const lastSuccessLabel = params.lastSuccess
    ? formatRelativeTimestamp(params.lastSuccess)
    : t("agentsPage.channels.never");
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(params.context, t("agentsPage.channels.contextSubtitle"))}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agentsPage.channels.title")}</div>
            <div class="card-sub">${t("agentsPage.channels.subtitle")}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? t("agentsPage.shared.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="muted" style="margin-top: 8px;">
          ${t("agentsPage.channels.lastRefresh")}: ${lastSuccessLabel}
        </div>
        ${
          params.error
            ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
            : nothing
        }
        ${
          !params.snapshot
            ? html`
                <div class="callout info" style="margin-top: 12px">
                  ${t("agentsPage.channels.loadHint")}
                </div>
              `
            : nothing
        }
        ${
          entries.length === 0
            ? html`<div class="muted" style="margin-top: 16px">${t("agentsPage.channels.noChannels")}</div>`
            : html`
                <div class="list" style="margin-top: 16px;">
                  ${entries.map((entry) => {
                    const summary = summarizeChannelAccounts(entry.accounts);
                    const status = summary.total
                      ? t("agentsPage.channels.connectedCount", {
                          connected: String(summary.connected),
                          total: String(summary.total),
                        })
                      : t("agentsPage.channels.noAccounts");
                    const configLabel = summary.configured
                      ? t("agentsPage.channels.configuredCount", {
                          count: String(summary.configured),
                        })
                      : t("agentsPage.channels.notConfigured");
                    const enabled = summary.total
                      ? t("agentsPage.channels.enabledCount", { count: String(summary.enabled) })
                      : t("agentsPage.channels.disabled");
                    const extras = resolveChannelExtrasFromConfig({
                      configForm: params.configForm,
                      channelId: entry.id,
                      fields: CHANNEL_EXTRA_FIELDS,
                    });
                    return html`
                      <div class="list-item">
                        <div class="list-main">
                          <div class="list-title">${entry.label}</div>
                          <div class="list-sub mono">${entry.id}</div>
                        </div>
                        <div class="list-meta">
                          <div>${status}</div>
                          <div>${configLabel}</div>
                          <div>${enabled}</div>
                          ${
                            summary.configured === 0
                              ? html`
                                  <div>
                                    <a
                                      href="https://docs.openclaw.ai/channels"
                                      target="_blank"
                                      rel="noopener"
                                      style="color: var(--accent); font-size: 12px"
                                      >${t("agentsPage.channels.setupGuide")}</a
                                    >
                                  </div>
                                `
                              : nothing
                          }
                          ${
                            extras.length > 0
                              ? extras.map(
                                  (extra) => html`<div>${extra.label}: ${extra.value}</div>`,
                                )
                              : nothing
                          }
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
        }
      </section>
    </section>
  `;
}

export function renderAgentCron(params: {
  context: AgentContext;
  agentId: string;
  jobs: CronJob[];
  status: CronStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRunNow: (jobId: string) => void;
}) {
  const jobs = params.jobs.filter((job) => job.agentId === params.agentId);
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(params.context, t("agentsPage.cron.contextSubtitle"))}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agentsPage.cron.title")}</div>
            <div class="card-sub">${t("agentsPage.cron.subtitle")}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? t("agentsPage.shared.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("agentsPage.cron.enabled")}</div>
            <div class="stat-value">
              ${params.status
                ? (params.status.enabled ? t("common.yes") : t("common.no"))
                : t("common.na")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("agentsPage.cron.jobs")}</div>
            <div class="stat-value">${params.status?.jobs ?? t("common.na")}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("agentsPage.cron.nextWake")}</div>
            <div class="stat-value">${formatNextRun(params.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        ${
          params.error
            ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
            : nothing
        }
      </section>
    </section>
    <section class="card">
      <div class="card-title">${t("agentsPage.cron.agentJobsTitle")}</div>
      <div class="card-sub">${t("agentsPage.cron.agentJobsSubtitle")}</div>
      ${
        jobs.length === 0
          ? html`<div class="muted" style="margin-top: 16px">${t("agentsPage.cron.noJobs")}</div>`
          : html`
              <div class="list" style="margin-top: 16px;">
                ${jobs.map(
                  (job) => html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${job.name}</div>
                        ${
                          job.description
                            ? html`<div class="list-sub">${job.description}</div>`
                            : nothing
                        }
                        <div class="chip-row" style="margin-top: 6px;">
                          <span class="chip">${formatCronSchedule(job)}</span>
                          <span class="chip ${job.enabled ? "chip-ok" : "chip-warn"}">
                            ${job.enabled ? t("common.enabled") : t("common.disabled")}
                          </span>
                          <span class="chip">${job.sessionTarget}</span>
                        </div>
                      </div>
                      <div class="list-meta">
                        <div class="mono">${formatCronState(job)}</div>
                        <div class="muted">${formatCronPayload(job)}</div>
                        <button
                          class="btn btn--sm"
                          style="margin-top: 6px;"
                          ?disabled=${!job.enabled}
                          @click=${() => params.onRunNow(job.id)}
                        >${t("agentsPage.cron.runNow")}</button>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
      }
    </section>
  `;
}

export function renderAgentFiles(params: {
  agentId: string;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onOpenTools: () => void;
  onOpenSkills: () => void;
}) {
  const list = params.agentFilesList?.agentId === params.agentId ? params.agentFilesList : null;
  const files = orderAgentFiles(list?.files ?? []);
  const active = params.agentFileActive ?? null;
  const activeEntry = active ? (files.find((file) => file.name === active) ?? null) : null;
  const baseContent = active ? (params.agentFileContents[active] ?? "") : "";
  const draft = active ? (params.agentFileDrafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("agentsPage.files.title")}</div>
          <div class="card-sub">${t("agentsPage.files.subtitle")}</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${params.agentFilesLoading}
          @click=${() => params.onLoadFiles(params.agentId)}
        >
          ${params.agentFilesLoading ? t("agentsPage.shared.loading") : t("common.refresh")}
        </button>
      </div>
      ${
        list
          ? html`
              <div class="muted mono" style="margin-top: 8px;">
                ${t("agentsPage.shared.workspace")}: ${list.workspace}
              </div>
            `
          : nothing
      }
      ${
        params.agentFilesError
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.agentFilesError}</div>`
          : nothing
      }
      ${
        !list
          ? html`
              <div class="callout info" style="margin-top: 12px">
                ${t("agentsPage.files.loadHint")}
              </div>
            `
          : html`
              <div class="agent-files-callout">
                <div>
                  <div class="agent-files-callout__title">
                    ${t("agentsPage.files.workspaceGuidanceTitle")}
                  </div>
                  <div class="agent-files-callout__text">
                    ${t("agentsPage.files.workspaceGuidance")}
                  </div>
                </div>
                <div class="agent-files-callout__actions">
                  <button class="btn btn--sm" type="button" @click=${params.onOpenTools}>
                    ${t("agentsPage.files.openTools")}
                  </button>
                  <button class="btn btn--sm" type="button" @click=${params.onOpenSkills}>
                    ${t("agentsPage.files.openSkills")}
                  </button>
                </div>
              </div>
              <div class="agent-files-grid" style="margin-top: 16px;">
                <div class="agent-files-list">
                  ${
                    files.length === 0
                      ? html`<div class="muted">${t("agentsPage.files.noFiles")}</div>`
                      : files.map((file) =>
                          renderAgentFileRow(file, active, () => params.onSelectFile(file.name)),
                        )
                  }
                </div>
                <div class="agent-files-editor">
                  ${
                    !activeEntry
                      ? html`<div class="muted">${t("agentsPage.files.selectFile")}</div>`
                      : html`
                          <div class="agent-file-header">
                            <div>
                              <div class="agent-file-title mono">${activeEntry.name}</div>
                              <div class="agent-file-sub mono">${activeEntry.path}</div>
                            </div>
                            <div class="agent-file-actions">
                              <button
                                class="btn btn--sm"
                                title=${t("agentsPage.files.previewRendered")}
                                @click=${(e: Event) => {
                                  const btn = e.currentTarget as HTMLElement;
                                  const dialog = btn
                                    .closest(".agent-files-editor")
                                    ?.querySelector("dialog");
                                  if (dialog) {
                                    dialog.showModal();
                                  }
                                }}
                              >
                                ${icons.eye} ${t("agentsPage.shared.preview")}
                              </button>
                              <button
                                class="btn btn--sm"
                                ?disabled=${!isDirty}
                                @click=${() => params.onFileReset(activeEntry.name)}
                              >
                                ${t("agentsPage.shared.reset")}
                              </button>
                              <button
                                class="btn btn--sm primary"
                                ?disabled=${params.agentFileSaving || !isDirty}
                                @click=${() => params.onFileSave(activeEntry.name)}
                              >
                                ${params.agentFileSaving
                                  ? t("agentsPage.shared.saving")
                                  : t("agentsPage.shared.save")}
                              </button>
                            </div>
                          </div>
                          ${
                            activeEntry.missing
                              ? html`
                                  <div class="callout info" style="margin-top: 10px">
                                    ${t("agentsPage.files.fileMissing")}
                                  </div>
                                `
                              : nothing
                          }
                          <label class="field agent-file-field" style="margin-top: 12px;">
                            <span>${t("agentsPage.shared.content")}</span>
                            <textarea
                              class="agent-file-textarea"
                              .value=${draft}
                              @input=${(e: Event) =>
                                params.onFileDraftChange(
                                  activeEntry.name,
                                  (e.target as HTMLTextAreaElement).value,
                                )}
                            ></textarea>
                          </label>
                          <dialog
                            class="md-preview-dialog"
                            @click=${(e: Event) => {
                              const dialog = e.currentTarget as HTMLDialogElement;
                              if (e.target === dialog) {
                                dialog.close();
                              }
                            }}
                          >
                            <div class="md-preview-dialog__panel">
                              <div class="md-preview-dialog__header">
                                <div class="md-preview-dialog__title mono">${activeEntry.name}</div>
                                <button
                                  class="btn btn--sm"
                                  @click=${(e: Event) => {
                                    (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                  }}
                                >${icons.x} ${t("agentsPage.shared.close")}</button>
                              </div>
                              <div class="md-preview-dialog__body sidebar-markdown">
                                ${unsafeHTML(toSanitizedMarkdownHtml(draft))}
                              </div>
                            </div>
                          </dialog>
                        `
                  }
                </div>
              </div>
            `
      }
    </section>
  `;
}

function orderAgentFiles(files: AgentFileEntry[]): AgentFileEntry[] {
  const byName = new Map(files.map((file) => [file.name, file]));
  const ordered = CORE_FILE_PRESETS.map((preset) => byName.get(preset.name)).filter(
    (entry): entry is AgentFileEntry => Boolean(entry),
  );
  const orderedNames = new Set(ordered.map((entry) => entry.name));
  const extras = files
    .filter((entry) => !orderedNames.has(entry.name))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...extras];
}

function resolveCoreFilePreset(file: AgentFileEntry): AgentCoreFilePreset | null {
  return CORE_FILE_PRESETS.find((preset) => preset.name === file.name) ?? null;
}

function renderAgentFileRow(file: AgentFileEntry, active: string | null, onSelect: () => void) {
  const preset = resolveCoreFilePreset(file);
  const status = file.missing
    ? t("agentsPage.files.missing")
    : `${formatBytes(file.size)} · ${formatRelativeTimestamp(file.updatedAtMs ?? null)}`;
  return html`
    <button
      type="button"
      class="agent-file-row ${active === file.name ? "active" : ""}"
      @click=${onSelect}
    >
      <div>
        ${
          preset
            ? html`
                <div class="agent-file-label">${t(`agentsPage.files.${preset.titleKey}`)}</div>
                <div class="agent-file-name mono">${file.name}</div>
                <div class="agent-file-desc">
                  ${t(`agentsPage.files.${preset.descriptionKey}`)}
                </div>
              `
            : html`<div class="agent-file-name mono">${file.name}</div>`
        }
        <div class="agent-file-meta">${status}</div>
      </div>
      ${
        file.missing
          ? html`
              <span class="agent-pill warn">${t("agentsPage.files.missingBadge")}</span>
            `
          : nothing
      }
    </button>
  `;
}
