import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  DingTalkKnowledgeBaseSyncResult,
  KnowledgeSyncedDocumentEntry,
  KnowledgeSyncedListResult,
  KnowledgeSyncedWorkspaceEntry,
  SaveKnowledgeSourceOperatorParams,
} from "../controllers/knowledge.ts";
import type { AgentIdentityResult, AgentsListResult } from "../types.ts";
import { renderAgentContextCard } from "./agents-panels-status-files.ts";
import { buildAgentContext, normalizeAgentLabel } from "./agents-utils.ts";
import { resolveChannelConfigLocation } from "./channel-config-extras.ts";

const DINGTALK_ENTERPRISE_ID = "dingtalk-enterprise";
const DINGTALK_CONNECTOR_ID = "dingtalk-connector";
const DEFAULT_ACCOUNT_ID = "default";

type JsonRecord = Record<string, unknown>;

type KnowledgeSyncConfig = {
  enabled?: boolean;
  operatorId?: string;
  targetAgentId?: string;
  workspaceIds: string[];
  maxWorkspaces?: number;
  maxNodesPerWorkspace?: number;
};

type KnowledgeSource = {
  sourceKey: string;
  channelId: string;
  channelLabel: string;
  accountId: string;
  displayName: string;
  targetAgentId: string;
  targetExplicit: boolean;
  enabled: boolean;
  operatorId?: string;
  operatorExplicit: boolean;
  operatorPath: Array<string | number>;
  workspaceIds: string[];
  maxWorkspaces?: number;
  maxNodesPerWorkspace?: number;
};

type KnowledgeSourceStatus = {
  label: string;
  hint: string;
  tone: "ok" | "warn" | "muted";
  ready: boolean;
};

type KnowledgeLatestSyncSummary = {
  channelId: string;
  accountId: string;
  accountLabel?: string;
  outputDir: string;
  completedAt: string;
  workspaces: number;
  documents: number;
  metadataOnlyDocuments: number;
  visitedNodes: number;
  derived: boolean;
};

export type KnowledgeProps = {
  loading: boolean;
  configLoading: boolean;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  configForm: Record<string, unknown> | null;
  operatorDrafts: Record<string, string>;
  operatorSavingSourceKey: string | null;
  operatorSaveError: string | null;
  dataLoading: boolean;
  dataError: string | null;
  dataResult: KnowledgeSyncedListResult | null;
  clearBusy: boolean;
  clearAgentId: string | null;
  clearError: string | null;
  syncBusy: boolean;
  syncAccountId: string | null;
  syncError: string | null;
  syncResult: DingTalkKnowledgeBaseSyncResult | null;
  onSelectAgent: (agentId: string) => void;
  onReload: () => void;
  onOpenSources: () => void;
  onOpenAgentFiles: (agentId: string) => void;
  onOpenSource: (channelId: string, accountId: string) => void;
  onClearData: (agentId: string) => void;
  onSyncSource: (params: {
    channelId: string;
    accountId: string;
    agentId: string;
    operatorId?: string;
    workspaceIds: string[];
    maxWorkspaces?: number;
    maxNodesPerWorkspace?: number;
  }) => void;
  onOperatorDraftChange: (sourceKey: string, value: string) => void;
  onSaveOperator: (params: SaveKnowledgeSourceOperatorParams) => void;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeSyncConfig(value: unknown): KnowledgeSyncConfig {
  const raw = asRecord(value);
  return {
    ...(asBoolean(raw?.enabled) !== undefined ? { enabled: asBoolean(raw?.enabled) } : {}),
    ...(asString(raw?.operatorId) ? { operatorId: asString(raw?.operatorId) } : {}),
    ...(asString(raw?.targetAgentId) ? { targetAgentId: asString(raw?.targetAgentId) } : {}),
    workspaceIds: asStringArray(raw?.workspaceIds),
    ...(asNumber(raw?.maxWorkspaces) ? { maxWorkspaces: asNumber(raw?.maxWorkspaces) } : {}),
    ...(asNumber(raw?.maxNodesPerWorkspace)
      ? { maxNodesPerWorkspace: asNumber(raw?.maxNodesPerWorkspace) }
      : {}),
  };
}

function mergeSyncConfig(
  base: KnowledgeSyncConfig,
  override: KnowledgeSyncConfig,
): KnowledgeSyncConfig {
  return {
    ...base,
    ...override,
    workspaceIds: override.workspaceIds.length > 0 ? override.workspaceIds : base.workspaceIds,
  };
}

function hasBaseDingTalkAccount(config: JsonRecord | null): boolean {
  if (!config) {
    return false;
  }
  const keys = [
    "name",
    "appKey",
    "appSecret",
    "clientId",
    "clientSecret",
    "agentId",
    "robotCode",
    "tenantId",
    "callbackBaseUrl",
  ];
  return keys.some((key) => Boolean(asString(config[key])));
}

function resolveDefaultAgentId(
  agentsList: AgentsListResult | null,
  configForm: Record<string, unknown> | null,
): string {
  const agentsConfig = asRecord(configForm?.agents);
  const configDefaultId = asString(agentsConfig?.defaultId);
  return configDefaultId ?? agentsList?.defaultId ?? agentsList?.agents?.[0]?.id ?? "main";
}

function agentLabel(agentsList: AgentsListResult | null, agentId: string): string {
  const agent = agentsList?.agents?.find((entry) => entry.id === agentId);
  return agent ? normalizeAgentLabel(agent) : agentId;
}

function collectKnowledgeSources(
  configForm: Record<string, unknown> | null,
  agentsList: AgentsListResult | null,
): KnowledgeSource[] {
  const defaultAgentId = resolveDefaultAgentId(agentsList, configForm);
  const sources: KnowledgeSource[] = [];
  const collectFromChannel = (channelId: string, channelLabel: string) => {
    const location = resolveChannelConfigLocation(configForm, channelId);
    const config = location?.value ?? null;
    if (!config || !location) {
      return;
    }
    const baseSync = normalizeSyncConfig(config.knowledgeBaseSync);
    const accounts = asRecord(config.accounts);
    const defaultAccountId = asString(config.defaultAccount) ?? DEFAULT_ACCOUNT_ID;

    if (hasBaseDingTalkAccount(config) || !accounts || Object.keys(accounts).length === 0) {
      sources.push({
        sourceKey: `${channelId}:${defaultAccountId}`,
        channelId,
        channelLabel,
        accountId: defaultAccountId,
        displayName: asString(config.name) ?? defaultAccountId,
        targetAgentId: baseSync.targetAgentId ?? defaultAgentId,
        targetExplicit: Boolean(baseSync.targetAgentId),
        enabled: baseSync.enabled !== false,
        operatorId: baseSync.operatorId,
        operatorExplicit: Boolean(baseSync.operatorId),
        operatorPath: [...location.path, "knowledgeBaseSync", "operatorId"],
        workspaceIds: baseSync.workspaceIds,
        maxWorkspaces: baseSync.maxWorkspaces,
        maxNodesPerWorkspace: baseSync.maxNodesPerWorkspace,
      });
    }

    for (const [accountId, rawAccount] of Object.entries(accounts ?? {})) {
      const account = asRecord(rawAccount);
      const accountSync = normalizeSyncConfig(account?.knowledgeBaseSync);
      const mergedSync = mergeSyncConfig(baseSync, accountSync);
      sources.push({
        sourceKey: `${channelId}:${accountId}`,
        channelId,
        channelLabel,
        accountId,
        displayName: asString(account?.name) ?? accountId,
        targetAgentId: mergedSync.targetAgentId ?? defaultAgentId,
        targetExplicit: Boolean(mergedSync.targetAgentId),
        enabled: mergedSync.enabled !== false,
        operatorId: mergedSync.operatorId,
        operatorExplicit: Boolean(accountSync.operatorId),
        operatorPath: [...location.path, "accounts", accountId, "knowledgeBaseSync", "operatorId"],
        workspaceIds: mergedSync.workspaceIds,
        maxWorkspaces: mergedSync.maxWorkspaces,
        maxNodesPerWorkspace: mergedSync.maxNodesPerWorkspace,
      });
    }
  };

  collectFromChannel(DINGTALK_CONNECTOR_ID, t("knowledgePage.channels.connector"));
  collectFromChannel(DINGTALK_ENTERPRISE_ID, t("knowledgePage.channels.enterprise"));

  return sources.toSorted((left, right) =>
    `${left.channelId}:${left.displayName}:${left.accountId}`.localeCompare(
      `${right.channelId}:${right.displayName}:${right.accountId}`,
    ),
  );
}

function resolveSourceStatus(source: KnowledgeSource): KnowledgeSourceStatus {
  if (!source.enabled) {
    return {
      label: t("knowledgePage.status.disabled"),
      hint: t("knowledgePage.status.disabledHint"),
      tone: "muted",
      ready: false,
    };
  }
  if (!source.operatorId) {
    return {
      label: t("knowledgePage.status.missingOperator"),
      hint: t("knowledgePage.status.missingOperatorHint"),
      tone: "warn",
      ready: false,
    };
  }
  return {
    label: t("knowledgePage.status.ready"),
    hint: t("knowledgePage.status.readyHint"),
    tone: "ok",
    ready: true,
  };
}

function formatScope(source: KnowledgeSource): string {
  if (source.workspaceIds.length === 0) {
    return t("knowledgePage.table.all");
  }
  if (source.workspaceIds.length === 1) {
    return source.workspaceIds[0] ?? t("knowledgePage.table.all");
  }
  return t("knowledgePage.table.workspaceCount", {
    count: String(source.workspaceIds.length),
  });
}

function formatLimits(source: KnowledgeSource): string {
  const parts: string[] = [];
  if (source.maxWorkspaces) {
    parts.push(t("knowledgePage.limits.maxWorkspaces", { count: String(source.maxWorkspaces) }));
  }
  if (source.maxNodesPerWorkspace) {
    parts.push(
      t("knowledgePage.limits.maxNodes", { count: String(source.maxNodesPerWorkspace) }),
    );
  }
  return parts.length > 0
    ? parts.join(t("knowledgePage.limits.separator"))
    : t("knowledgePage.limits.unlimited");
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function dirnamePath(value: string): string {
  const normalized = value.replace(/[\\/]+$/, "");
  const lastSeparator = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return lastSeparator > 0 ? normalized.slice(0, lastSeparator) : normalized;
}

function resolveOperatorDraft(
  drafts: Record<string, string>,
  source: KnowledgeSource,
): string {
  return drafts[source.sourceKey] ?? source.operatorId ?? "";
}

function operatorConfigState(source: KnowledgeSource): string {
  if (source.operatorExplicit) {
    return t("knowledgePage.table.operatorConfigured");
  }
  if (source.operatorId) {
    return t("knowledgePage.table.operatorInherited");
  }
  return t("knowledgePage.table.operatorUnset");
}

function resolveChannelLabel(channelId: string): string {
  if (channelId === DINGTALK_CONNECTOR_ID) {
    return t("knowledgePage.channels.connector");
  }
  if (channelId === DINGTALK_ENTERPRISE_ID) {
    return t("knowledgePage.channels.enterprise");
  }
  return channelId;
}

function formatExtractedVia(value: string | undefined): string {
  if (!value) {
    return t("knowledgePage.data.unknown");
  }
  if (value === "node-content") {
    return t("knowledgePage.data.extractedNode");
  }
  if (value === "storage-download") {
    return t("knowledgePage.data.extractedDownload");
  }
  if (value === "metadata-only") {
    return t("knowledgePage.data.extractedMetadata");
  }
  return value;
}

function renderSyncedWorkspaceRow(entry: KnowledgeSyncedWorkspaceEntry) {
  return html`
    <tr data-knowledge-workspace=${`${entry.channelId}:${entry.accountId}:${entry.workspaceId}`}>
      <td>
        <div class="knowledge-table__source">
          <div class="knowledge-table__primary">${entry.workspaceName}</div>
          <div class="knowledge-table__secondary mono">${entry.workspaceId}</div>
        </div>
      </td>
      <td>
        <div class="knowledge-table__source">
          <div class="knowledge-table__primary">${entry.accountLabel ?? entry.accountId}</div>
          <div class="knowledge-table__secondary mono">
            ${resolveChannelLabel(entry.channelId)} / ${entry.accountId}
          </div>
        </div>
      </td>
      <td>${String(entry.documents)}</td>
      <td>${String(entry.metadataOnlyDocuments)}</td>
      <td>${entry.syncedAt ? formatDateTime(entry.syncedAt) : t("knowledgePage.data.none")}</td>
      <td>
        <div class="knowledge-table__secondary mono">${entry.outputDir}</div>
      </td>
    </tr>
  `;
}

function renderSyncedDocumentCard(entry: KnowledgeSyncedDocumentEntry) {
  return html`
    <article class="knowledge-doc-card">
      <div class="knowledge-doc-card__header">
        <div>
          <h4 class="knowledge-doc-card__title">${entry.title}</h4>
          <div class="knowledge-doc-card__meta">
            ${entry.accountLabel ?? entry.accountId} · ${entry.workspaceName}
          </div>
        </div>
        <span class="chip ${entry.metadataOnly ? "chip-warn" : "chip-ok"}">
          ${formatExtractedVia(entry.extractedVia)}
        </span>
      </div>
      <div class="knowledge-doc-card__body">
        <div class="knowledge-doc-card__row">
          <span>${resolveChannelLabel(entry.channelId)}</span>
          <span class="mono">${entry.accountId}</span>
        </div>
        ${
          entry.logicalPath
            ? html`<div class="knowledge-doc-card__path mono">${entry.logicalPath}</div>`
            : nothing
        }
        ${
          entry.preview
            ? html`<p class="knowledge-doc-card__preview">${entry.preview}</p>`
            : html`
                <p class="knowledge-doc-card__preview knowledge-doc-card__preview--muted">
                  ${t("knowledgePage.data.metadataOnlyHint")}
                </p>
              `
        }
        <div class="knowledge-doc-card__footer">
          <span>${entry.syncedAt ? formatDateTime(entry.syncedAt) : t("knowledgePage.data.none")}</span>
          <span class="mono">${entry.filePath}</span>
        </div>
      </div>
    </article>
  `;
}

function normalizeLatestSyncSummary(
  value: DingTalkKnowledgeBaseSyncResult | null,
): KnowledgeLatestSyncSummary | null {
  if (!value) {
    return null;
  }
  return {
    channelId: value.channelId ?? DINGTALK_ENTERPRISE_ID,
    accountId: value.accountId,
    outputDir: value.outputRootDir,
    completedAt: value.completedAt,
    workspaces: value.totals.workspaces,
    documents: value.totals.documentsWritten,
    metadataOnlyDocuments: value.totals.metadataOnlyDocuments,
    visitedNodes: value.totals.visitedNodes,
    derived: false,
  };
}

function deriveLatestSyncSummary(
  value: KnowledgeSyncedListResult | null,
): KnowledgeLatestSyncSummary | null {
  if (!value || value.workspaces.length === 0) {
    return null;
  }
  const sorted = [...value.workspaces].toSorted((left, right) => {
    const leftAt = Date.parse(left.syncedAt ?? "") || left.updatedAtMs;
    const rightAt = Date.parse(right.syncedAt ?? "") || right.updatedAtMs;
    return rightAt - leftAt;
  });
  const latest = sorted[0];
  if (!latest) {
    return null;
  }
  const latestAtMs = Date.parse(latest.syncedAt ?? "") || latest.updatedAtMs;
  const sameSourceRecent = value.workspaces.filter((entry) => {
    if (entry.channelId !== latest.channelId || entry.accountId !== latest.accountId) {
      return false;
    }
    const entryAtMs = Date.parse(entry.syncedAt ?? "") || entry.updatedAtMs;
    return Math.abs(latestAtMs - entryAtMs) <= 10 * 60 * 1000;
  });
  const group = sameSourceRecent.length > 0 ? sameSourceRecent : [latest];
  return {
    channelId: latest.channelId,
    accountId: latest.accountId,
    accountLabel: latest.accountLabel,
    outputDir: dirnamePath(latest.outputDir),
    completedAt: latest.syncedAt ?? new Date(latest.updatedAtMs).toISOString(),
    workspaces: group.length,
    documents: group.reduce((sum, entry) => sum + entry.documents, 0),
    metadataOnlyDocuments: group.reduce((sum, entry) => sum + entry.metadataOnlyDocuments, 0),
    visitedNodes: group.reduce((sum, entry) => sum + (entry.visitedNodes ?? 0), 0),
    derived: true,
  };
}

export function renderKnowledge(props: KnowledgeProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((entry) => entry.id === selectedId) ?? null)
    : null;
  const resolvedSelectedId = selectedId ?? selectedAgent?.id ?? null;
  const selectedAgentId = resolvedSelectedId ?? "";
  const sources = collectKnowledgeSources(props.configForm, props.agentsList);
  const selectedSources = resolvedSelectedId
    ? sources.filter((source) => source.targetAgentId === resolvedSelectedId)
    : [];
  const readyCount = selectedSources.filter((source) => resolveSourceStatus(source).ready).length;
  const defaultAgentId = resolveDefaultAgentId(props.agentsList, props.configForm);
  const selectedContext =
    selectedAgent && resolvedSelectedId
      ? buildAgentContext(
          selectedAgent,
          props.configForm,
          null,
          defaultId,
          props.agentIdentityById[resolvedSelectedId] ?? null,
        )
      : null;
  const visibleResult =
    props.syncResult && (!resolvedSelectedId || props.syncResult.agentId === resolvedSelectedId)
      ? props.syncResult
      : null;
  const visibleData =
    props.dataResult && (!resolvedSelectedId || props.dataResult.agentId === resolvedSelectedId)
      ? props.dataResult
      : null;
  const latestResult = deriveLatestSyncSummary(visibleData) ?? normalizeLatestSyncSummary(visibleResult);
  const selectedSourceKeys = new Set(
    selectedSources.map((source) => `${source.channelId}:${source.accountId}`),
  );
  const cachedSourceEntries =
    visibleData?.workspaces.filter(
      (entry, index, entries) =>
        entries.findIndex(
          (candidate) =>
            candidate.channelId === entry.channelId && candidate.accountId === entry.accountId,
        ) === index,
    ) ?? [];
  const historicalCacheSources = cachedSourceEntries.filter(
    (entry) => !selectedSourceKeys.has(`${entry.channelId}:${entry.accountId}`),
  );
  const hasHistoricalCache = historicalCacheSources.length > 0;
  const hasOnlyHistoricalCache = hasHistoricalCache && selectedSources.length === 0;
  const operatorSaveBusy = Boolean(props.operatorSavingSourceKey);

  return html`
    <div class="agents-layout knowledge-page">
      <section class="agents-toolbar">
        <div class="agents-toolbar-row">
          <span class="agents-toolbar-label">${t("knowledgePage.toolbar.agentLabel")}</span>
          <div class="agents-control-row">
            <div class="agents-control-select">
              <select
                class="agents-select"
                .value=${resolvedSelectedId ?? ""}
                ?disabled=${props.loading || props.configLoading || agents.length === 0}
                @change=${(event: Event) =>
                  props.onSelectAgent((event.target as HTMLSelectElement).value)}
              >
                ${
                  agents.length === 0
                    ? html`<option value="">${t("knowledgePage.emptyState.title")}</option>`
                    : agents.map(
                        (agent) => html`
                          <option value=${agent.id}>${normalizeAgentLabel(agent)}</option>
                        `,
                      )
                }
              </select>
            </div>
            <div class="agents-control-actions">
              <button class="btn btn--sm" type="button" @click=${props.onReload}>
                ${t("knowledgePage.toolbar.reload")}
              </button>
              <button class="btn btn--sm" type="button" @click=${props.onOpenSources}>
                ${t("knowledgePage.toolbar.manageSources")}
              </button>
              <button
                class="btn btn--sm"
                type="button"
                ?disabled=${!resolvedSelectedId}
                @click=${() => selectedAgentId && props.onOpenAgentFiles(selectedAgentId)}
              >
                ${t("knowledgePage.toolbar.openFiles")}
              </button>
            </div>
          </div>
        </div>
      </section>

      ${
        props.syncError
          ? html`<div class="callout danger">${props.syncError}</div>`
          : nothing
      }

      ${
        props.operatorSaveError
          ? html`<div class="callout danger">${props.operatorSaveError}</div>`
          : nothing
      }

      ${
        props.dataError
          ? html`<div class="callout danger">${props.dataError}</div>`
          : nothing
      }

      ${
        props.clearError
          ? html`<div class="callout danger">${props.clearError}</div>`
          : nothing
      }

      ${
        !props.configForm && !props.configLoading
          ? html`<div class="callout info">${t("knowledgePage.errors.loadConfig")}</div>`
          : nothing
      }

      ${
        !selectedAgent || !selectedContext
          ? html`
              <section class="card">
                <div class="card-title">${t("knowledgePage.emptyState.title")}</div>
                <div class="card-sub">${t("knowledgePage.emptyState.subtitle")}</div>
              </section>
            `
          : html`
              <div class="agents-main">
                ${renderAgentContextCard(selectedContext, t("knowledgePage.contextSubtitle"))}

                <section class="card">
                  <div class="card-title">${t("knowledgePage.summary.title")}</div>
                  <div class="card-sub">${t("knowledgePage.summary.subtitle")}</div>
                  <div class="agent-bindings-summary">
                    <div class="agent-bindings-stat">
                      <div class="label">${t("knowledgePage.summary.sources")}</div>
                      <div class="agent-bindings-stat__value">${String(selectedSources.length)}</div>
                    </div>
                    <div class="agent-bindings-stat">
                      <div class="label">${t("knowledgePage.summary.ready")}</div>
                      <div class="agent-bindings-stat__value">${String(readyCount)}</div>
                    </div>
                    <div class="agent-bindings-stat">
                      <div class="label">${t("knowledgePage.summary.defaultAgent")}</div>
                      <div class="agent-bindings-stat__value">
                        ${agentLabel(props.agentsList, defaultAgentId)}
                      </div>
                      <div class="agent-bindings-table__secondary">
                        ${t("knowledgePage.summary.defaultAgentHint")}
                      </div>
                    </div>
                  </div>
                </section>

                <section class="card">
                  <div class="card-title">${t("knowledgePage.table.title")}</div>
                  <div class="card-sub">${t("knowledgePage.table.subtitle")}</div>
                  <div class="knowledge-table-wrap" style="margin-top: 16px;">
                    <table class="knowledge-table">
                      <thead>
                        <tr>
                          <th>${t("knowledgePage.table.source")}</th>
                          <th>${t("knowledgePage.table.operator")}</th>
                          <th>${t("knowledgePage.table.scope")}</th>
                          <th>${t("knowledgePage.table.limits")}</th>
                          <th>${t("knowledgePage.table.status")}</th>
                          <th>${t("knowledgePage.table.actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${
                          selectedSources.length === 0
                            ? html`
                                <tr>
                                  <td colspan="6" class="knowledge-table__empty">
                                    ${t("knowledgePage.table.empty")}
                                  </td>
                                </tr>
                              `
                            : selectedSources.map((source) => {
                                const status = resolveSourceStatus(source);
                                const operatorDraft = resolveOperatorDraft(props.operatorDrafts, source);
                                const operatorDirty = operatorDraft.trim() !== (source.operatorId ?? "");
                                const savingOperator =
                                  props.operatorSavingSourceKey === source.sourceKey;
                                const syncing =
                                  props.syncBusy && props.syncAccountId === source.sourceKey;
                                return html`
                                  <tr data-knowledge-source=${source.sourceKey}>
                                    <td>
                                      <div class="knowledge-table__source">
                                        <div class="knowledge-table__primary">
                                          ${source.displayName}
                                        </div>
                                        <div class="knowledge-table__secondary mono">
                                          ${source.channelLabel} / ${source.accountId}
                                        </div>
                                        <div class="chip-row">
                                          <span class="chip">
                                            ${
                                              source.targetExplicit
                                                ? t("knowledgePage.table.explicit")
                                                : t("knowledgePage.table.inherited")
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div class="knowledge-table__operator">
                                        <input
                                          class="knowledge-table__operator-input mono"
                                          type="text"
                                          data-knowledge-operator-input=${source.sourceKey}
                                          .value=${operatorDraft}
                                          ?disabled=${props.configLoading || operatorSaveBusy}
                                          placeholder=${t("knowledgePage.table.operatorPlaceholder")}
                                          @input=${(event: Event) =>
                                            props.onOperatorDraftChange(
                                              source.sourceKey,
                                              (event.target as HTMLInputElement).value,
                                            )}
                                          @keydown=${(event: KeyboardEvent) => {
                                            if (
                                              event.key !== "Enter" ||
                                              !operatorDirty ||
                                              props.configLoading ||
                                              operatorSaveBusy
                                            ) {
                                              return;
                                            }
                                            event.preventDefault();
                                            props.onSaveOperator({
                                              sourceKey: source.sourceKey,
                                              operatorPath: source.operatorPath,
                                              operatorId: operatorDraft,
                                            });
                                          }}
                                        />
                                        <div class="knowledge-table__operator-meta">
                                          <span class="knowledge-table__secondary">
                                            ${operatorConfigState(source)}
                                          </span>
                                          ${
                                            operatorDirty
                                              ? html`
                                                  <span class="chip chip-warn">
                                                    ${t("knowledgePage.table.unsaved")}
                                                  </span>
                                                `
                                              : nothing
                                          }
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div class="knowledge-table__primary">${formatScope(source)}</div>
                                      ${
                                        source.workspaceIds.length > 1
                                          ? html`
                                              <div class="knowledge-table__secondary mono">
                                                ${source.workspaceIds.join(", ")}
                                              </div>
                                            `
                                          : nothing
                                      }
                                    </td>
                                    <td>
                                      <span>${formatLimits(source)}</span>
                                    </td>
                                    <td>
                                      <div class="knowledge-table__status">
                                        <span class="chip ${status.tone === "ok" ? "chip-ok" : status.tone === "warn" ? "chip-warn" : ""}">
                                          ${status.label}
                                        </span>
                                        <div class="knowledge-table__secondary">${status.hint}</div>
                                      </div>
                                    </td>
                                    <td>
                                      <div class="knowledge-table__actions">
                                        <button
                                          class="btn btn--sm"
                                          type="button"
                                          data-knowledge-operator-save=${source.sourceKey}
                                          ?disabled=${!operatorDirty || props.configLoading || operatorSaveBusy}
                                          @click=${() =>
                                            props.onSaveOperator({
                                              sourceKey: source.sourceKey,
                                              operatorPath: source.operatorPath,
                                              operatorId: operatorDraft,
                                            })}
                                        >
                                          ${savingOperator ? t("common.loading") : t("common.save")}
                                        </button>
                                        <button
                                          class="btn btn--sm primary"
                                          type="button"
                                          data-knowledge-sync=${source.sourceKey}
                                          ?disabled=${!status.ready || props.syncBusy || operatorDirty || operatorSaveBusy}
                                          @click=${() =>
                                            props.onSyncSource({
                                              channelId: source.channelId,
                                              accountId: source.accountId,
                                              agentId: selectedAgentId,
                                              operatorId: source.operatorId,
                                              workspaceIds: source.workspaceIds,
                                              maxWorkspaces: source.maxWorkspaces,
                                              maxNodesPerWorkspace: source.maxNodesPerWorkspace,
                                            })}
                                        >
                                          ${
                                            syncing
                                              ? t("common.loading")
                                              : t("knowledgePage.table.syncNow")
                                          }
                                        </button>
                                        <button
                                          class="btn btn--sm"
                                          type="button"
                                          @click=${() =>
                                            props.onOpenSource(source.channelId, source.accountId)}
                                        >
                                          ${t("knowledgePage.table.openSource")}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                `;
                              })
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                <section class="card">
                  <div class="knowledge-section-header">
                    <div>
                      <div class="card-title">${t("knowledgePage.data.title")}</div>
                      <div class="card-sub">${t("knowledgePage.data.subtitle")}</div>
                    </div>
                    <div class="knowledge-section-header__actions">
                      <button
                        class="btn btn--sm danger"
                        type="button"
                        ?disabled=${!resolvedSelectedId || props.clearBusy || !visibleData || visibleData.workspaceCount === 0}
                        @click=${() => {
                          if (!resolvedSelectedId) {
                            return;
                          }
                          const confirmed = window.confirm(
                            t("knowledgePage.data.clearConfirm", {
                              agent: agentLabel(props.agentsList, resolvedSelectedId),
                            }),
                          );
                          if (!confirmed) {
                            return;
                          }
                          props.onClearData(resolvedSelectedId);
                        }}
                      >
                        ${
                          props.clearBusy && props.clearAgentId === resolvedSelectedId
                            ? t("knowledgePage.data.clearing")
                            : t("knowledgePage.data.clear")
                        }
                      </button>
                    </div>
                  </div>
                  ${
                    hasOnlyHistoricalCache
                      ? html`
                          <div class="callout info" style="margin-top: 16px;">
                            ${t("knowledgePage.data.historicalOnlyHint")}
                          </div>
                        `
                      : hasHistoricalCache
                        ? html`
                            <div class="callout info" style="margin-top: 16px;">
                              ${t("knowledgePage.data.historicalMixedHint")}
                            </div>
                          `
                        : nothing
                  }
                  ${
                    props.dataLoading
                      ? html`
                          <div class="knowledge-table__empty" style="margin-top: 16px;">
                            ${t("common.loading")}
                          </div>
                        `
                      : visibleData && (visibleData.workspaceCount > 0 || visibleData.recentDocuments.length > 0)
                        ? html`
                            <div class="agent-bindings-summary" style="margin-top: 16px;">
                              <div class="agent-bindings-stat">
                                <div class="label">${t("knowledgePage.data.workspaces")}</div>
                                <div class="agent-bindings-stat__value">${String(visibleData.workspaceCount)}</div>
                              </div>
                              <div class="agent-bindings-stat">
                                <div class="label">${t("knowledgePage.data.documents")}</div>
                                <div class="agent-bindings-stat__value">${String(visibleData.documentCount)}</div>
                              </div>
                              <div class="agent-bindings-stat">
                                <div class="label">${t("knowledgePage.data.metadataOnly")}</div>
                                <div class="agent-bindings-stat__value">
                                  ${String(visibleData.metadataOnlyDocuments)}
                                </div>
                              </div>
                              <div class="agent-bindings-stat">
                                <div class="label">${t("knowledgePage.data.lastSyncedAt")}</div>
                                <div class="agent-bindings-stat__value">
                                  ${visibleData.lastSyncedAt
                                    ? formatDateTime(visibleData.lastSyncedAt)
                                    : t("knowledgePage.data.none")}
                                </div>
                              </div>
                            </div>

                            <div class="knowledge-table-wrap" style="margin-top: 16px;">
                              <table class="knowledge-table">
                                <thead>
                                  <tr>
                                    <th>${t("knowledgePage.data.workspaceName")}</th>
                                    <th>${t("knowledgePage.data.source")}</th>
                                    <th>${t("knowledgePage.data.documents")}</th>
                                    <th>${t("knowledgePage.data.metadataOnly")}</th>
                                    <th>${t("knowledgePage.data.lastSyncedAt")}</th>
                                    <th>${t("knowledgePage.data.outputDir")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${visibleData.workspaces.map((entry) => renderSyncedWorkspaceRow(entry))}
                                </tbody>
                              </table>
                            </div>

                            <div class="knowledge-doc-grid">
                              ${visibleData.recentDocuments.map((entry) => renderSyncedDocumentCard(entry))}
                            </div>
                          `
                        : html`
                            <div class="knowledge-table__empty" style="margin-top: 16px;">
                              ${t("knowledgePage.data.empty")}
                            </div>
                          `
                  }
                </section>

                <section class="card">
                  <div class="card-title">${t("knowledgePage.result.title")}</div>
                  <div class="card-sub">${t("knowledgePage.result.subtitle")}</div>
                  ${
                    latestResult
                      ? html`
                          ${
                            latestResult.derived
                              ? html`
                                  <div class="callout info" style="margin-top: 16px;">
                                    ${t("knowledgePage.result.derivedHint")}
                                  </div>
                                `
                              : nothing
                          }
                          <div class="agents-overview-grid knowledge-result-grid" style="margin-top: 16px;">
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.source")}</div>
                              <div>${latestResult.accountLabel ?? latestResult.accountId}</div>
                              <div class="knowledge-table__secondary mono">
                                ${resolveChannelLabel(latestResult.channelId)} / ${latestResult.accountId}
                              </div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.output")}</div>
                              <div class="mono">${latestResult.outputDir}</div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.completed")}</div>
                              <div>${formatDateTime(latestResult.completedAt)}</div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.workspaces")}</div>
                              <div>${String(latestResult.workspaces)}</div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.docs")}</div>
                              <div>${String(latestResult.documents)}</div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.metadataOnly")}</div>
                              <div>${String(latestResult.metadataOnlyDocuments)}</div>
                            </div>
                            <div class="agent-kv">
                              <div class="label">${t("knowledgePage.result.visited")}</div>
                              <div>${String(latestResult.visitedNodes)}</div>
                            </div>
                          </div>
                        `
                      : html`
                          <div class="knowledge-table__empty" style="margin-top: 16px;">
                            ${t("knowledgePage.result.noResult")}
                          </div>
                        `
                  }
                </section>
              </div>
            `
      }
    </div>
  `;
}
