import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { SkillMessageMap } from "../controllers/skills.ts";
import { clampText } from "../format.ts";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { resolveAgentConfig } from "./agents-utils.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  resolveSkillStatus,
  skillSourceLabel,
} from "./skills-shared.ts";

export type SkillsProps = {
  connected: boolean;
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  page: number;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  selectedAgentReport: SkillStatusReport | null;
  selectedAgentReportAgentId: string | null;
  selectedAgentLoading: boolean;
  agentsList: {
    agents: Array<{ id: string; name?: string; identity?: { name?: string } }>;
    defaultId?: string;
  } | null;
  selectedAgentId: string | null;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  onFilterChange: (next: string) => void;
  onPageChange: (next: number) => void;
  onAgentChange: (agentId: string) => void;
  onOpenAgentSkills: (agentId: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
};

const SKILLS_PAGE_SIZE = 10;
const SUMMARY_PLACEHOLDER = "-";
const SOURCE_ORDER = new Map<string, number>([
  ["openclaw-workspace", 0],
  ["openclaw-bundled", 1],
  ["openclaw-managed", 2],
  ["openclaw-extra", 3],
]);

type SkillsSummary = {
  all: number;
  eligible: number;
  notReady: number;
  blocked: number;
  disabled: number;
};

type AgentSkillState = {
  kind: "loading" | "available" | "disabled" | "missing" | "notReady";
  label: string;
  tone: "" | "chip-ok" | "chip-warn" | "chip-danger";
  detail: string;
  metaLabel?: string;
  metaTone?: "neutral" | "ok" | "warn" | "danger";
};

type SelectedAgentContext = {
  selectedAgentId: string | null;
  selectedAgentLabel: string | null;
  configReady: boolean;
  reportReady: boolean;
  loading: boolean;
  usingAllowlist: boolean;
  allowSet: Set<string>;
  skillsByName: Map<string, SkillStatusEntry>;
  skillsByKey: Map<string, SkillStatusEntry>;
};

function compareSkills(left: SkillStatusEntry, right: SkillStatusEntry) {
  const leftOrder = SOURCE_ORDER.get(left.source) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = SOURCE_ORDER.get(right.source) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.name.localeCompare(right.name, "zh-Hans-CN-u-co-pinyin");
}

function summarizeSkills(skills: SkillStatusEntry[]): SkillsSummary {
  return skills.reduce<SkillsSummary>(
    (summary, skill) => {
      summary.all += 1;
      if (skill.disabled) {
        summary.disabled += 1;
      } else if (skill.blockedByAllowlist) {
        summary.blocked += 1;
      } else if (skill.eligible) {
        summary.eligible += 1;
      } else {
        summary.notReady += 1;
      }
      return summary;
    },
    { all: 0, eligible: 0, notReady: 0, blocked: 0, disabled: 0 },
  );
}

function renderSummaryItem(label: string, value: string | number) {
  return html`
    <div class="skills-summary-item">
      <div class="skills-summary-item__label">${label}</div>
      <div class="skills-summary-item__value">${value}</div>
    </div>
  `;
}

function renderSummaryPanel(params: {
  title: string;
  subtitle: string;
  hint: string;
  items: Array<{ label: string; value: string | number }>;
}) {
  return html`
    <section class="skills-summary-panel">
      <div class="skills-summary-panel__header">
        <div class="skills-summary-panel__eyebrow">${params.title}</div>
        <div class="skills-summary-panel__subtitle">${params.subtitle}</div>
      </div>
      <div class="skills-summary-panel__hint">${params.hint}</div>
      <div class="skills-summary">
        ${params.items.map((item) => renderSummaryItem(item.label, item.value))}
      </div>
    </section>
  `;
}

function renderMissingItems(items: string[]) {
  if (items.length === 0) {
    return html`<span class="skills-table__empty">${t("skillsPage.table.noMissing")}</span>`;
  }
  return html`
    <div class="skills-table__list">
      ${items.map((item) => html`<span class="chip">${item}</span>`)}
    </div>
  `;
}

function resolveAgentLabel(
  agents: SkillsProps["agentsList"] extends { agents: infer T } ? T : never,
  selectedAgentId: string | null,
  defaultId?: string,
) {
  if (!selectedAgentId) {
    return null;
  }
  const match = agents.find((agent) => agent.id === selectedAgentId);
  if (!match) {
    return selectedAgentId;
  }
  const label = match.identity?.name?.trim() || match.name?.trim() || match.id.trim();
  return defaultId === match.id ? `${label} (${t("skillsPage.defaultAgent")})` : label;
}

function buildSelectedAgentContext(
  props: SkillsProps,
  selectedAgentId: string | null,
  agentOptions: NonNullable<SkillsProps["agentsList"]>["agents"],
) {
  const selectedAgentLabel = resolveAgentLabel(
    agentOptions,
    selectedAgentId,
    props.agentsList?.defaultId,
  );
  const config = selectedAgentId ? resolveAgentConfig(props.configForm, selectedAgentId) : null;
  const allowlist = Array.isArray(config?.entry?.skills) ? config.entry?.skills : undefined;
  const allowSet = new Set((allowlist ?? []).map((entry) => entry.trim()).filter(Boolean));
  const configReady = Boolean(props.configForm) && !props.configLoading;
  const reportReady = Boolean(
    selectedAgentId &&
    props.selectedAgentReport &&
    props.selectedAgentReportAgentId === selectedAgentId,
  );
  const loading = Boolean(
    selectedAgentId &&
    (props.configLoading ||
      !props.configForm ||
      props.selectedAgentLoading ||
      props.selectedAgentReportAgentId !== selectedAgentId),
  );
  const skills = reportReady ? (props.selectedAgentReport?.skills ?? []) : [];
  return {
    selectedAgentId,
    selectedAgentLabel,
    configReady,
    reportReady,
    loading,
    usingAllowlist: allowlist !== undefined,
    allowSet,
    skillsByName: new Map(skills.map((skill) => [skill.name, skill])),
    skillsByKey: new Map(skills.map((skill) => [skill.skillKey, skill])),
  } satisfies SelectedAgentContext;
}

function resolveSelectedAgentSkillState(
  skill: SkillStatusEntry,
  context: SelectedAgentContext,
): AgentSkillState {
  if (!context.selectedAgentId) {
    return {
      kind: "loading",
      label: t("skillsPage.agentState.noAgent"),
      tone: "",
      detail: t("skillsPage.agentState.noAgentHint"),
    };
  }
  if (!context.configReady || !context.reportReady || context.loading) {
    return {
      kind: "loading",
      label: t("skillsPage.agentState.loading"),
      tone: "",
      detail: t("skillsPage.agentState.loadingHint"),
    };
  }
  const selectedSkill =
    context.skillsByKey.get(skill.skillKey) ?? context.skillsByName.get(skill.name) ?? null;
  if (!selectedSkill) {
    return {
      kind: "missing",
      label: t("skillsPage.agentState.missing"),
      tone: "chip-warn",
      detail: t("skillsPage.agentState.missingHint"),
      metaLabel: t("skillsPage.agentState.workspaceMissing"),
      metaTone: "warn",
    };
  }
  if (context.usingAllowlist && !context.allowSet.has(selectedSkill.name)) {
    return {
      kind: "disabled",
      label: t("skillsPage.agentState.disabled"),
      tone: "",
      detail: t("skillsPage.agentState.disabledHint"),
      metaLabel: t("skillsPage.agentState.allowlistBlocked"),
      metaTone: "danger",
    };
  }
  const status = resolveSkillStatus(selectedSkill);
  if (selectedSkill.eligible && !selectedSkill.disabled && !selectedSkill.blockedByAllowlist) {
    return {
      kind: "available",
      label: t("skillsPage.agentState.available"),
      tone: "chip-ok",
      detail: context.usingAllowlist
        ? t("skillsPage.agentState.allowlistHint")
        : t("skillsPage.agentState.inheritHint"),
      metaLabel: context.usingAllowlist
        ? t("skillsPage.agentState.allowlistAllowed")
        : t("skillsPage.agentState.inheritTag"),
      metaTone: context.usingAllowlist ? "ok" : "neutral",
    };
  }
  const details = [...computeSkillMissing(selectedSkill), ...computeSkillReasons(selectedSkill)];
  return {
    kind: "notReady",
    label: status.label,
    tone: status.tone,
    detail: details[0] ?? t("skillsPage.agentState.notReadyHint"),
    metaLabel: t("skillsPage.agentState.notReadyTag"),
    metaTone: "warn",
  };
}

function summarizeSelectedAgentSkills(
  skills: SkillStatusEntry[],
  context: SelectedAgentContext,
): { available: string | number; disabled: string | number; unavailable: string | number } {
  if (!context.selectedAgentId || !context.configReady || !context.reportReady || context.loading) {
    return {
      available: SUMMARY_PLACEHOLDER,
      disabled: SUMMARY_PLACEHOLDER,
      unavailable: SUMMARY_PLACEHOLDER,
    };
  }
  let available = 0;
  let disabled = 0;
  let unavailable = 0;
  for (const skill of skills) {
    const state = resolveSelectedAgentSkillState(skill, context);
    if (state.kind === "available") {
      available += 1;
    } else if (state.kind === "disabled") {
      disabled += 1;
    } else {
      unavailable += 1;
    }
  }
  return { available, disabled, unavailable };
}

function renderSelectedAgentCell(skill: SkillStatusEntry, context: SelectedAgentContext) {
  const state = resolveSelectedAgentSkillState(skill, context);
  return html`
    <div class="skills-table__agent">
      <div class="skills-table__agent-tags">
        <span
          class="skills-table__agent-pill skills-table__agent-pill--main skills-table__agent-pill--${state.metaTone ?? "neutral"}"
          data-skill-agent-status=${skill.skillKey}
        >
          ${state.label}
        </span>
        ${
          state.metaLabel
            ? html`
                <span class="skills-table__agent-pill skills-table__agent-pill--${state.metaTone ?? "neutral"}">
                  ${state.metaLabel}
                </span>
              `
            : nothing
        }
      </div>
      <div class="skills-table__agent-note">${state.detail}</div>
    </div>
  `;
}

export function renderSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();
  const hasActiveFilter = filter.length > 0;
  const filtered = filter
    ? skills.filter((skill) =>
        [skill.name, skill.description, skill.source, skill.skillKey]
          .join(" ")
          .toLowerCase()
          .includes(filter),
      )
    : skills;
  const orderedSkills = [...filtered].sort(compareSkills);
  const globalSummary = summarizeSkills(orderedSkills);
  const agentOptions = props.agentsList?.agents ?? [];
  const selectedAgentId =
    props.selectedAgentId ?? props.agentsList?.defaultId ?? agentOptions[0]?.id ?? null;
  const selectedAgent = buildSelectedAgentContext(props, selectedAgentId, agentOptions);
  const selectedAgentSummary = summarizeSelectedAgentSkills(orderedSkills, selectedAgent);
  const agentSummarySubtitle =
    selectedAgent.selectedAgentLabel ?? t("skillsPage.summarySections.agentNone");
  const agentSummaryHint = !selectedAgent.selectedAgentId
    ? t("skillsPage.summarySections.agentNoneHint")
    : selectedAgent.loading
      ? t("skillsPage.summarySections.agentLoading")
      : selectedAgent.usingAllowlist
        ? t("skillsPage.summarySections.agentAllowlist")
        : t("skillsPage.summarySections.agentInherited");
  const scopedSkills = selectedAgent.selectedAgentId
    ? !selectedAgent.configReady || !selectedAgent.reportReady || selectedAgent.loading
      ? []
      : orderedSkills.filter(
          (skill) => resolveSelectedAgentSkillState(skill, selectedAgent).kind === "available",
        )
    : orderedSkills;
  const totalRows = scopedSkills.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / SKILLS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(props.page, 0), totalPages - 1);
  const pageStart = currentPage * SKILLS_PAGE_SIZE;
  const paginatedSkills = scopedSkills.slice(pageStart, pageStart + SKILLS_PAGE_SIZE);
  const emptyState =
    !props.connected && !props.report
      ? t("skillsPage.notConnected")
      : selectedAgent.selectedAgentId &&
          (!selectedAgent.configReady || !selectedAgent.reportReady || selectedAgent.loading)
        ? t("skillsPage.agentLoadingOnly")
        : selectedAgent.selectedAgentId
          ? hasActiveFilter
            ? t("skillsPage.noSkillsForAgentFilter", {
                agent: selectedAgent.selectedAgentLabel ?? selectedAgent.selectedAgentId,
                filter: props.filter.trim(),
              })
            : t("skillsPage.noSkillsForAgent", {
                agent: selectedAgent.selectedAgentLabel ?? selectedAgent.selectedAgentId,
              })
          : hasActiveFilter
            ? t("skillsPage.noSkillsForFilter", { filter: props.filter.trim() })
            : t("skillsPage.noSkills");

  return html`
    <section class="card">
      <div class="skills-page__header">
        <div class="card-title">${t("skillsPage.title")}</div>
        <div class="card-sub">${t("skillsPage.subtitle")}</div>
      </div>

      <div class="skills-page__toolbar" style="margin-top: 14px;">
        <div class="skills-page__toolbar-row">
          <label class="field skills-page__search">
            <input
              .value=${props.filter}
              @input=${(e: Event) => props.onFilterChange((e.target as HTMLInputElement).value)}
              placeholder=${t("skillsPage.searchPlaceholder")}
              autocomplete="off"
              name="skills-filter"
            />
          </label>
          ${
            hasActiveFilter
              ? html`
                  <button class="btn" @click=${() => props.onFilterChange("")}>
                    ${t("skillsPage.clearFilter")}
                  </button>
                `
              : nothing
          }
          ${
            agentOptions.length > 0
              ? html`
                  <label class="field skills-page__agent-select">
                    <span>${t("skillsPage.agentLabel")}</span>
                    <select
                      .value=${selectedAgentId ?? ""}
                      data-skills-agent-select="true"
                      @change=${(e: Event) =>
                        props.onAgentChange((e.target as HTMLSelectElement).value)}
                    >
                      ${agentOptions.map((agent) => {
                        const label =
                          agent.identity?.name?.trim() || agent.name?.trim() || agent.id.trim();
                        const isDefault = props.agentsList?.defaultId === agent.id;
                        return html`
                          <option value=${agent.id}>
                            ${isDefault ? `${label} (${t("skillsPage.defaultAgent")})` : label}
                          </option>
                        `;
                      })}
                    </select>
                  </label>
                `
              : nothing
          }
          ${
            selectedAgentId
              ? html`
                  <button
                    class="btn"
                    data-skills-agent-open=${selectedAgentId}
                    @click=${() => props.onOpenAgentSkills(selectedAgentId)}
                  >
                    ${t("skillsPage.manageAgentSkills")}
                  </button>
                `
              : nothing
          }
          <a
            class="btn"
            href="https://clawhub.com"
            target="_blank"
            rel="noreferrer"
            title=${t("skillsPage.browseStoreTitle")}
          >${t("skillsPage.browseStore")}</a>
        </div>

        <div class="skills-page__toolbar-meta">
          <div class="muted">
            ${t("skillsPage.shownCount", { count: String(totalRows) })}
            ${
              orderedSkills.length !== totalRows || skills.length !== orderedSkills.length
                ? html`
                    <span>
                      / ${t("skillsPage.totalCount", { count: String(orderedSkills.length) })}
                    </span>
                  `
                : nothing
            }
          </div>
          <div class="muted">
            ${t("skillsPage.agentHint")}
            ${
              selectedAgent.selectedAgentLabel
                ? html`
                    <span>
                      ${t("skillsPage.agentScope", {
                        agent: selectedAgent.selectedAgentLabel,
                      })}
                    </span>
                  `
                : nothing
            }
          </div>
        </div>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      ${
        totalRows === 0
          ? html`
              <div class="muted" style="margin-top: 16px">
                ${emptyState}
              </div>
              ${
                hasActiveFilter
                  ? html`
                      <div style="margin-top: 10px;">
                        <button class="btn" @click=${() => props.onFilterChange("")}>
                          ${t("skillsPage.clearFilter")}
                        </button>
                      </div>
                    `
                  : nothing
              }
            `
          : html`
              <div class="skills-summary-panels" style="margin-top: 16px;">
                ${renderSummaryPanel({
                  title: t("skillsPage.summarySections.global"),
                  subtitle: t("skillsPage.summarySections.globalSubtitle"),
                  hint: t("skillsPage.summarySections.globalHint"),
                  items: [
                    { label: t("skillsPage.summary.all"), value: globalSummary.all },
                    { label: t("skillsPage.summary.eligible"), value: globalSummary.eligible },
                  ],
                })}
                ${renderSummaryPanel({
                  title: t("skillsPage.summarySections.agent"),
                  subtitle: agentSummarySubtitle,
                  hint: agentSummaryHint,
                  items: [
                    {
                      label: t("skillsPage.summary.agentAvailable"),
                      value: selectedAgentSummary.available,
                    },
                    {
                      label: t("skillsPage.summary.agentDisabled"),
                      value: selectedAgentSummary.disabled,
                    },
                    {
                      label: t("skillsPage.summary.agentUnavailable"),
                      value: selectedAgentSummary.unavailable,
                    },
                  ],
                })}
              </div>

              <div class="skills-page__table-header" style="margin-top: 16px;">
                <div>
                  <div class="skills-page__table-title">${t("skillsPage.tableSection.title")}</div>
                  <div class="skills-page__table-subtitle">
                    ${t("skillsPage.tableSection.subtitle")}
                  </div>
                </div>
                <div class="skills-page__table-actions">
                  <button
                    class="btn"
                    ?disabled=${props.loading || !props.connected}
                    @click=${props.onRefresh}
                  >
                    ${props.loading ? t("skillsPage.loading") : t("common.refresh")}
                  </button>
                </div>
              </div>

              <div class="knowledge-table-wrap" style="margin-top: 12px;">
                <table class="knowledge-table skills-table" data-skills-table="true">
                  <thead>
                    <tr>
                      <th>${t("skillsPage.table.skill")}</th>
                      <th>${t("skillsPage.table.source")}</th>
                      <th>${t("skillsPage.table.status")}</th>
                      <th>${t("skillsPage.table.currentAgent")}</th>
                      <th>${t("skillsPage.table.missing")}</th>
                      <th>${t("skillsPage.table.config")}</th>
                      <th>${t("skillsPage.table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paginatedSkills.map((skill) => renderSkillRow(skill, props, selectedAgent))}
                  </tbody>
                </table>
              </div>
              <div class="data-table-pagination" data-skills-pagination="true">
                <div class="data-table-pagination__info">
                  ${t("skillsPage.paginationInfo", {
                    start: String(pageStart + 1),
                    end: String(Math.min(pageStart + SKILLS_PAGE_SIZE, totalRows)),
                    total: String(totalRows),
                  })}
                  <span> · ${t("skillsPage.pageSize", { count: String(SKILLS_PAGE_SIZE) })}</span>
                </div>
                <div class="data-table-pagination__controls">
                  <button
                    ?disabled=${currentPage <= 0}
                    @click=${() => props.onPageChange(currentPage - 1)}
                  >
                    ${t("common.previous")}
                  </button>
                  <button
                    ?disabled=${currentPage >= totalPages - 1}
                    @click=${() => props.onPageChange(currentPage + 1)}
                  >
                    ${t("common.next")}
                  </button>
                </div>
              </div>
            `
      }
    </section>
  `;
}

function renderSkillRow(
  skill: SkillStatusEntry,
  props: SkillsProps,
  selectedAgent: SelectedAgentContext,
) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const missing = computeSkillMissing(skill);
  const status = resolveSkillStatus(skill);
  const showBundledBadge = Boolean(skill.bundled && skill.source !== "openclaw-bundled");

  return html`
    <tr data-skill-row=${skill.skillKey}>
      <td>
        <div class="skills-table__skill">
          <div class="skills-table__primary">
            ${skill.emoji ? `${skill.emoji} ` : ""}${skill.name}
          </div>
          <div class="skills-table__secondary">${clampText(skill.description, 140)}</div>
          <div class="skills-table__meta">
            <span class="mono">${skill.skillKey}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="skills-table__source">
          <div class="skills-table__primary">${skillSourceLabel(skill.source)}</div>
          <div class="skills-table__secondary mono">${skill.source}</div>
          ${
            showBundledBadge
              ? html`
                  <div class="skills-table__list">
                    <span class="chip">${t("skillsPage.status.bundled")}</span>
                  </div>
                `
              : nothing
          }
        </div>
      </td>
      <td>
        <div class="skills-table__status">
          <div class="skills-table__list">
            <span class="chip ${status.tone}" data-skill-status=${skill.skillKey}
              >${status.label}</span
            >
          </div>
          ${
            message
              ? html`
                  <div
                    class="skills-table__message ${
                      message.kind === "error"
                        ? "skills-table__message--error"
                        : "skills-table__message--success"
                    }"
                  >
                    ${message.message}
                  </div>
                `
              : nothing
          }
        </div>
      </td>
      <td>${renderSelectedAgentCell(skill, selectedAgent)}</td>
      <td>${renderMissingItems(missing)}</td>
      <td>
        ${
          skill.primaryEnv
            ? html`
                <div class="skills-table__config">
                  <div class="skills-table__secondary">
                    ${t("skillsPage.table.keyEnv")}
                    <span class="mono">${skill.primaryEnv}</span>
                  </div>
                  <input
                    class="knowledge-table__operator-input"
                    type="password"
                    data-skills-key-input=${skill.skillKey}
                    .value=${apiKey}
                    @input=${(e: Event) =>
                      props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
                  />
                  <button
                    class="btn primary"
                    ?disabled=${busy}
                    @click=${() => props.onSaveKey(skill.skillKey)}
                  >
                    ${t("skillsPage.saveKey")}
                  </button>
                </div>
              `
            : html`<span class="skills-table__empty">${t("skillsPage.table.noConfig")}</span>`
        }
      </td>
      <td>
        <div class="skills-table__actions">
          <button
            class="btn"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >
            ${skill.disabled ? t("skillsPage.enable") : t("skillsPage.disable")}
          </button>
          ${
            canInstall
              ? html`
                  <button
                    class="btn"
                    ?disabled=${busy}
                    @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
                  >
                    ${busy ? t("skillsPage.installing") : skill.install[0].label}
                  </button>
                `
              : nothing
          }
        </div>
      </td>
    </tr>
  `;
}
