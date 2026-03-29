import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { AgentIdentityResult, AgentsFilesListResult, AgentsListResult } from "../types.ts";
import {
  buildModelOptions,
  normalizeModelValue,
  parseFallbackList,
  resolveAgentConfig,
  resolveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.ts";

export function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  basePath: string;
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
    onSelectPanel,
  } = params;
  const config = resolveAgentConfig(configForm, agent.id);
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles || config.entry?.workspace || config.defaults?.workspace || "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : resolveModelLabel(config.defaults?.model);
  const defaultModel = resolveModelLabel(config.defaults?.model);
  const entryPrimary = resolveModelPrimary(config.entry?.model);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null);
  const effectivePrimary = entryPrimary ?? defaultPrimary ?? null;
  const modelFallbacks = resolveModelFallbacks(config.entry?.model);
  const fallbackChips = modelFallbacks ?? [];
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);
  const disabled = !configForm || configLoading || configSaving;

  const removeChip = (index: number) => {
    const next = fallbackChips.filter((_, i) => i !== index);
    onModelFallbacksChange(agent.id, next);
  };

  const handleChipKeydown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parsed = parseFallbackList(input.value);
      if (parsed.length > 0) {
        onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
        input.value = "";
      }
    }
  };

  return html`
    <section class="card">
      <div class="card-title">${t("agentsPage.overview.title")}</div>
      <div class="card-sub">${t("agentsPage.overview.subtitle")}</div>

      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.workspace")}</div>
          <div>
            <button
              type="button"
              class="workspace-link mono"
              @click=${() => onSelectPanel("files")}
              title=${t("agentsPage.overview.openFilesTab")}
            >${workspace}</button>
          </div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.primaryModel")}</div>
          <div class="mono">${model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agentsPage.shared.skillsFilter")}</div>
          <div>
            ${
              skillFilter
                ? t("agentsPage.shared.selectedCount", { count: String(skillCount ?? 0) })
                : t("agentsPage.shared.allSkills")
            }
          </div>
        </div>
      </div>

      ${
        configDirty
          ? html`
              <div class="callout warn" style="margin-top: 16px">
                ${t("agentsPage.overview.unsavedChanges")}
              </div>
            `
          : nothing
      }

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">${t("agentsPage.overview.modelSelection")}</div>
        <div class="agent-model-fields">
          <label class="field">
            <span>
              ${
                isDefault
                  ? t("agentsPage.overview.primaryModelDefaultLabel")
                  : t("agentsPage.overview.primaryModelLabel")
              }
            </span>
            <select
              .value=${isDefault ? (effectivePrimary ?? "") : (entryPrimary ?? "")}
              ?disabled=${disabled}
              @change=${(e: Event) =>
                onModelChange(agent.id, (e.target as HTMLSelectElement).value || null)}
            >
              ${
                isDefault
                  ? nothing
                  : html`
                      <option value="">
                        ${
                          defaultPrimary
                            ? t("agentsPage.overview.inheritDefaultWithValue", {
                                value: defaultPrimary,
                              })
                            : t("agentsPage.overview.inheritDefault")
                        }
                      </option>
                    `
              }
              ${buildModelOptions(configForm, effectivePrimary ?? undefined)}
            </select>
          </label>
          <div class="field">
            <span>${t("agentsPage.overview.fallbacks")}</span>
            <div class="agent-chip-input" @click=${(e: Event) => {
              const container = e.currentTarget as HTMLElement;
              const input = container.querySelector("input");
              if (input) {
                input.focus();
              }
            }}>
              ${fallbackChips.map(
                (chip, i) => html`
                  <span class="chip">
                    ${chip}
                    <button
                      type="button"
                      class="chip-remove"
                      ?disabled=${disabled}
                      @click=${() => removeChip(i)}
                    >&times;</button>
                  </span>
                `,
              )}
              <input
                ?disabled=${disabled}
                placeholder=${fallbackChips.length === 0
                  ? t("agentsPage.overview.fallbackPlaceholder")
                  : ""}
                @keydown=${handleChipKeydown}
                @blur=${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  const parsed = parseFallbackList(input.value);
                  if (parsed.length > 0) {
                    onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
                    input.value = "";
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div class="agent-model-actions">
          <button type="button" class="btn btn--sm" ?disabled=${configLoading} @click=${onConfigReload}>
            ${t("agentsPage.shared.reloadConfig")}
          </button>
          <button
            type="button"
            class="btn btn--sm primary"
            ?disabled=${configSaving || !configDirty}
            @click=${onConfigSave}
          >
            ${configSaving ? t("agentsPage.shared.saving") : t("agentsPage.shared.save")}
          </button>
        </div>
      </div>
    </section>
  `;
}
