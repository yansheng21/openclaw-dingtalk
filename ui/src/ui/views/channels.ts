import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  LogEntry,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
} from "../types.ts";
import {
  channelSupportsAccountInstances,
  renderChannelAccountConfigForm,
  renderChannelConfigForm,
  renderChannelConfigSection,
} from "./channels.config.ts";
import { renderDingTalkCard } from "./channels.dingtalk.ts";
import { renderDiscordCard } from "./channels.discord.ts";
import { renderGoogleChatCard } from "./channels.googlechat.ts";
import { renderIMessageCard } from "./channels.imessage.ts";
import { renderChannelLogsPanel } from "./channels.logs.ts";
import { renderNostrCard } from "./channels.nostr.ts";
import {
  channelEnabled,
  formatBooleanLabel,
  formatChannelStateLabel,
  renderChannelAccountCount,
  type ChannelStateLabel,
} from "./channels.shared.ts";
import { renderSignalCard } from "./channels.signal.ts";
import { renderSlackCard } from "./channels.slack.ts";
import { renderTelegramCard } from "./channels.telegram.ts";
import type {
  ChannelListStatusFilter,
  ChannelKey,
  ChannelsChannelData,
  ChannelsProps,
  DingTalkAccountEditorValues,
} from "./channels.types.ts";
import { renderWhatsAppCard } from "./channels.whatsapp.ts";
import { analyzeConfigSchema } from "./config-form.ts";

type OrderedChannel = {
  key: ChannelKey;
  enabled: boolean;
  order: number;
};

type ChannelListEntry = {
  id: string;
  channelKey: ChannelKey;
  channelLabel: string;
  label: string;
  subtitle: string;
  accountId: string | null;
  accountDisplay: string;
  stateLabel: string;
  tone: "ok" | "warn" | "muted";
  connectedCount: number;
  logCount: number;
  lastActivityAt: number | null;
  supportsInstanceEditor: boolean;
  supportsDelete: boolean;
};

type JsonRecord = Record<string, unknown>;

type BoundAgentSummary = {
  id: string;
  label: string;
  source: "exact" | "default";
};

const PRIORITY_CHANNEL_IDS = ["dingtalk-connector", "dingtalk-enterprise"] as const;
const HIDDEN_CHANNEL_IDS = new Set<ChannelKey>(["dingtalk-enterprise"]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLookup(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function renderChannels(props: ChannelsProps) {
  const normalizedConfigSchema = analyzeConfigSchema(props.configSchema).schema;
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  const whatsapp = (channels?.whatsapp ?? undefined) as WhatsAppStatus | undefined;
  const telegram = (channels?.telegram ?? undefined) as TelegramStatus | undefined;
  const discord = (channels?.discord ?? null) as DiscordStatus | null;
  const googlechat = (channels?.googlechat ?? null) as GoogleChatStatus | null;
  const slack = (channels?.slack ?? null) as SlackStatus | null;
  const signal = (channels?.signal ?? null) as SignalStatus | null;
  const imessage = (channels?.imessage ?? null) as IMessageStatus | null;
  const nostr = (channels?.nostr ?? null) as NostrStatus | null;
  const channelOrder = resolveChannelOrder(props.snapshot);
  const orderedChannels: OrderedChannel[] = channelOrder
    .filter((key) => !HIDDEN_CHANNEL_IDS.has(key) || key === props.selectedChannelId)
    .map((key, index) => ({
      key,
      enabled: channelEnabled(key, props),
      order: index,
    }))
    .toSorted((a, b) => {
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      return a.order - b.order;
    });
  const selectedChannelKey = resolveSelectedChannelKey(props.selectedChannelId, orderedChannels);
  const logsByChannel = new Map(
    orderedChannels.map((channel) => [
      channel.key,
      filterChannelLogs(props.logsEntries, channel.key, props.snapshot),
    ]),
  );
  const connectedAccounts = countConnectedAccounts(props.snapshot);
  const selectedAccounts = props.snapshot?.channelAccounts?.[selectedChannelKey] ?? [];
  const selectedStatus = (channels?.[selectedChannelKey] ?? null) as Record<string, unknown> | null;
  const selectedAccount = resolveSelectedChannelAccount(
    selectedStatus,
    selectedAccounts,
    props.selectedChannelAccountId,
  );
  const selectedChannelLogs = logsByChannel.get(selectedChannelKey) ?? [];
  const selectedChannelLabel = resolveChannelLabel(props.snapshot, selectedChannelKey);
  const selectedLabel = selectedAccount
    ? selectedAccount.displayName || selectedAccount.name || selectedAccount.accountId
    : selectedChannelLabel;
  const selectedDetail = selectedAccount
    ? `${selectedChannelLabel} · ${selectedAccount.accountId}`
    : resolveChannelDetailLabel(props.snapshot, selectedChannelKey);
  const selectedLogs = selectedAccount
    ? filterAccountLogs(selectedChannelLogs, selectedAccount.accountId)
    : selectedChannelLogs;
  const selectedStateLabel = selectedAccount
    ? resolveAccountStateSummary(selectedAccount)
    : resolveChannelStateSummary(selectedChannelKey, selectedStatus, selectedAccounts);
  const channelStateLabel = resolveChannelStateSummary(
    selectedChannelKey,
    selectedStatus,
    selectedAccounts,
  );
  const listEntries = buildChannelListEntries({
    orderedChannels,
    props,
    logsByChannel,
    configSchema: normalizedConfigSchema,
  });
  const filteredListEntries = filterChannelListEntries(
    listEntries,
    props.listSearchQuery,
    props.listStatusFilter,
  );
  const detailOpen = props.pageView === "detail" && Boolean(props.selectedChannelId);
  const instanceDetailOpen = detailOpen && selectedAccount != null;

  return html`
    <section class="card channels-overview">
      <div class="channels-overview__metrics">
        <div class="channels-metric">
          <div class="channels-metric__label">${t("channels.page.totalChannels")}</div>
          <div class="channels-metric__value">${orderedChannels.length}</div>
        </div>
        <div class="channels-metric">
          <div class="channels-metric__label">${t("channels.page.enabledChannels")}</div>
          <div class="channels-metric__value">
            ${orderedChannels.filter((channel) => channel.enabled).length}
          </div>
        </div>
        <div class="channels-metric">
          <div class="channels-metric__label">${t("channels.page.connectedAccounts")}</div>
          <div class="channels-metric__value">${connectedAccounts}</div>
        </div>
        <div class="channels-metric">
          <div class="channels-metric__label">${t("channels.page.monitoredLogs")}</div>
          <div class="channels-metric__value">${logsByChannel.get(selectedChannelKey)?.length ?? 0}</div>
        </div>
      </div>
      ${
        props.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.lastError}
            </div>`
          : nothing
      }
    </section>

    ${
      detailOpen
        ? renderChannelDetailPage({
            configSchema: normalizedConfigSchema,
            selectedChannelKey,
            selectedLabel: selectedChannelLabel,
            selectedDetail: resolveChannelDetailLabel(props.snapshot, selectedChannelKey),
            selectedStateLabel: channelStateLabel,
            selectedAccount: null,
            selectedAccounts,
            selectedChannelLogs,
            selectedLogs: selectedChannelLogs,
            props,
            data: {
              whatsapp,
              telegram,
              discord,
              googlechat,
              slack,
              signal,
              imessage,
              nostr,
              channelAccounts: props.snapshot?.channelAccounts ?? null,
            },
          })
        : renderChannelListPage({
            configSchema: normalizedConfigSchema,
            props,
            entries: filteredListEntries,
            totalEntriesCount: listEntries.length,
          })
    }

    ${
      instanceDetailOpen && selectedAccount
        ? renderChannelInstanceDetailModal({
            configSchema: normalizedConfigSchema,
            selectedChannelKey,
            selectedLabel,
            selectedDetail,
            selectedStateLabel,
            selectedAccount,
            selectedAccounts,
            selectedChannelLogs,
            selectedLogs,
            props,
            data: {
              whatsapp,
              telegram,
              discord,
              googlechat,
              slack,
              signal,
              imessage,
              nostr,
              channelAccounts: props.snapshot?.channelAccounts ?? null,
            },
          })
        : nothing
    }

    ${renderChannelCreatePickerModal(props, orderedChannels, normalizedConfigSchema)}
    ${renderChannelConfigModal(props)}
    ${renderDingTalkAccountEditorModal(props)}
    ${renderGenericChannelAccountEditorModal(props)}
  `;
}

function renderChannelInstanceDetailModal(params: {
  configSchema: ResolvedConfigSchema;
  selectedChannelKey: ChannelKey;
  selectedLabel: string;
  selectedDetail: string;
  selectedStateLabel: string;
  selectedAccount: ChannelAccountSnapshot | null;
  selectedAccounts: ChannelAccountSnapshot[];
  selectedChannelLogs: LogEntry[];
  selectedLogs: LogEntry[];
  props: ChannelsProps;
  data: ChannelsChannelData;
}) {
  const { selectedChannelKey, selectedLabel, selectedDetail, selectedAccount, props } = params;
  const modalTitle = selectedLabel;
  const modalSubtitle = selectedDetail;
  const boundAgent = selectedAccount
    ? resolveBoundAgentSummary(props.configForm, selectedChannelKey, selectedAccount.accountId)
    : null;
  const boundAgentSource =
    boundAgent?.source === "exact"
      ? t("channels.page.tableBoundAgentExact")
      : boundAgent?.source === "default"
        ? t("channels.page.tableBoundAgentDefault")
        : null;
  return html`
    <div
      class="channels-modal-overlay"
      role="dialog"
      aria-modal="true"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget) {
          props.onSelectChannelAccount(null);
        }
      }}
    >
      <div class="channels-modal channels-modal--detail">
        <div class="channels-modal__head">
          <div>
            <div class="channels-modal__title">${modalTitle}</div>
            <div class="channels-modal__sub">${modalSubtitle}</div>
            <div class="channels-modal__meta">
              <span class="channels-modal__meta-label">${t("channels.page.tableBoundAgent")}</span>
              <span class="channels-modal__meta-value">
                ${boundAgent?.label ?? t("common.na")}
              </span>
              ${
                boundAgentSource
                  ? html`
                      <span class="channels-state-badge channels-state-badge--${boundAgent?.source === "exact" ? "ok" : "muted"}">
                        ${boundAgentSource}
                      </span>
                    `
                  : nothing
              }
            </div>
          </div>
          <button class="btn btn--sm" @click=${() => props.onSelectChannelAccount(null)}>
            ${t("channels.actions.close")}
          </button>
        </div>
        <div class="channels-modal__body channels-modal__body--detail">
          ${renderChannelDetailPage({ ...params, modal: true })}
        </div>
      </div>
    </div>
  `;
}

function renderSelectionStat(
  label: string,
  value: string,
  options: { tone?: "ok" | "warn" | "muted" } = {},
) {
  return html`
    <div class="channels-selection__stat">
      <div class="channels-selection__stat-label">${label}</div>
      <div class="channels-selection__stat-value ${options.tone ?? "muted"}">${value}</div>
    </div>
  `;
}

type ResolvedConfigSchema = ReturnType<typeof analyzeConfigSchema>["schema"];

function supportsGenericChannelAccountEditor(
  configSchema: ResolvedConfigSchema,
  props: ChannelsProps,
  channelId: string,
): boolean {
  return (
    channelId !== "dingtalk-enterprise" &&
    channelSupportsAccountInstances(configSchema, channelId, props.configForm)
  );
}

function supportsChannelInstanceEditor(
  configSchema: ResolvedConfigSchema,
  props: ChannelsProps,
  channelId: string,
): boolean {
  return (
    channelId === "dingtalk-enterprise" ||
    supportsGenericChannelAccountEditor(configSchema, props, channelId)
  );
}

function renderChannelListPage(params: {
  configSchema: ReturnType<typeof analyzeConfigSchema>["schema"];
  props: ChannelsProps;
  entries: ChannelListEntry[];
  totalEntriesCount: number;
}) {
  const { props, entries, totalEntriesCount } = params;
  const hasActiveFilters =
    props.listSearchQuery.trim().length > 0 || props.listStatusFilter !== "all";
  return html`
    <section class="card channels-list-page">
      <div class="channels-list-page__head">
        <div class="channels-list-page__actions">
          <button class="btn primary" @click=${props.onOpenChannelCreatePicker}>
            ${t("channels.actions.selectIntegration")}
          </button>
          <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh(false)}>
            ${props.loading ? t("instances.loading") : t("channels.actions.refresh")}
          </button>
        </div>
      </div>

      <div class="channels-list-filters">
        <label class="field channels-list-filters__search">
          <span>${t("channels.page.searchLabel")}</span>
          <input
            type="search"
            placeholder=${t("channels.page.searchPlaceholder")}
            .value=${props.listSearchQuery}
            @input=${(event: Event) =>
              props.onListSearchQueryChange((event.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field channels-list-filters__status">
          <span>${t("channels.page.statusFilterLabel")}</span>
          <select
            .value=${props.listStatusFilter}
            @change=${(event: Event) =>
              props.onListStatusFilterChange(
                (event.target as HTMLSelectElement).value as ChannelListStatusFilter,
              )}
          >
            <option value="all">${t("channels.page.statusAll")}</option>
            <option value="connected">${t("channels.page.stateConnected")}</option>
            <option value="configured">${t("channels.page.stateConfigured")}</option>
            <option value="pending">${t("channels.page.statusPending")}</option>
            <option value="disabled">${t("channels.page.statusDisabled")}</option>
          </select>
        </label>
        <div class="channels-list-filters__meta">
          <span>${t("channels.page.showingCount", { shown: String(entries.length), total: String(totalEntriesCount) })}</span>
          ${
            hasActiveFilters
              ? html`
                  <button
                    class="btn btn--sm"
                    @click=${() => {
                      props.onListSearchQueryChange("");
                      props.onListStatusFilterChange("all");
                    }}
                  >
                    ${t("channels.page.clearFilters")}
                  </button>
                `
              : nothing
          }
        </div>
      </div>

      ${
        entries.length === 0
          ? html`
              <div class="callout info channels-list-empty">
                ${t("channels.page.emptyFiltered")}
              </div>
            `
          : html`
              <div class="table channels-table">
                <div class="table-head channels-table__head">
                  <div>${t("channels.page.tableIntegration")}</div>
                  <div>${t("channels.page.tableType")}</div>
                  <div>${t("channels.page.tableState")}</div>
                  <div>${t("channels.page.tableAccount")}</div>
                  <div>${t("channels.page.tableConnected")}</div>
                  <div>${t("channels.page.tableRecentActivity")}</div>
                  <div>${t("channels.page.tableLogs")}</div>
                  <div>${t("channels.page.tableActions")}</div>
                </div>
                ${entries.map((entry) => {
                  const enterChannelAction = () =>
                    props.onOpenChannelDetail(entry.channelKey, entry.accountId);
                  const channelConfigAction = () =>
                    props.onOpenChannelConfigEditor(entry.channelKey);
                  const refreshAction = () => {
                    props.onOpenChannelDetail(entry.channelKey, entry.accountId);
                    props.onRefresh(true);
                  };
                  return html`
                    <div class="table-row channels-table__row">
                      <div class="channels-table__primary">
                        <div class="channels-table__name">${entry.label}</div>
                        <div class="channels-table__sub">${entry.subtitle}</div>
                      </div>
                      <div>${entry.channelLabel}</div>
                      <div>
                        <span class="channels-state-badge channels-state-badge--${entry.tone}">
                          ${entry.stateLabel}
                        </span>
                      </div>
                      <div>${entry.accountDisplay}</div>
                      <div>${entry.connectedCount}</div>
                      <div>
                        ${
                          entry.lastActivityAt
                            ? formatRelativeTimestamp(entry.lastActivityAt)
                            : t("common.na")
                        }
                      </div>
                      <div>${entry.logCount}</div>
                      <div class="channels-table__actions">
                        <button class="btn btn--sm primary" @click=${enterChannelAction}>
                          ${t("channels.actions.enterChannel")}
                        </button>
                        ${
                          entry.supportsInstanceEditor
                            ? nothing
                            : html`
                                <button class="btn btn--sm" @click=${channelConfigAction}>
                                  ${t("channels.actions.channelConfig")}
                                </button>
                              `
                        }
                        <button class="btn btn--sm" @click=${refreshAction}>
                          ${t("channels.actions.refresh")}
                        </button>
                      </div>
                    </div>
                  `;
                })}
              </div>
            `
      }
    </section>
  `;
}

function filterChannelListEntries(
  entries: ChannelListEntry[],
  query: string,
  statusFilter: ChannelListStatusFilter,
): ChannelListEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (!matchesChannelListStatusFilter(entry, statusFilter)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      entry.label,
      entry.subtitle,
      entry.channelLabel,
      entry.channelKey,
      entry.accountId,
      entry.stateLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function matchesChannelListStatusFilter(
  entry: ChannelListEntry,
  statusFilter: ChannelListStatusFilter,
): boolean {
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "connected") {
    return entry.stateLabel === t("channels.page.stateConnected");
  }
  if (statusFilter === "configured") {
    return entry.stateLabel === t("channels.page.stateConfigured");
  }
  if (statusFilter === "disabled") {
    return entry.stateLabel === t("common.disabled");
  }
  return (
    entry.stateLabel === t("channels.page.statePending") ||
    entry.stateLabel === t("channels.page.statePlanned")
  );
}

function resolveAccountLastActivity(account: ChannelAccountSnapshot): number | null {
  return account.lastInboundAt ?? account.lastConnectedAt ?? account.lastStartAt ?? null;
}

function renderChannelAccountDirectory(params: {
  configSchema: ResolvedConfigSchema;
  channelKey: ChannelKey;
  channelLabel: string;
  accounts: ChannelAccountSnapshot[];
  channelLogs: LogEntry[];
  props: ChannelsProps;
}) {
  const { configSchema, channelKey, channelLabel, accounts, channelLogs, props } = params;
  const supportsGenericEditor = supportsGenericChannelAccountEditor(
    configSchema,
    props,
    channelKey,
  );
  return html`
    <section class="card channels-list-page">
      <div class="channels-list-page__head">
        <div class="card-title">${t("channels.page.accountDirectoryTitle")}</div>
      </div>
      ${
        accounts.length === 0
          ? html`
              <div class="callout info channels-list-empty">
                ${t("channels.page.accountDirectoryEmpty")}
              </div>
            `
          : nothing
      }
      <div class="table channels-table channels-table--accounts">
        <div class="table-head channels-table__head">
          <div>${t("channels.page.tableInstance")}</div>
          <div>${t("channels.page.tableChannel")}</div>
          <div>${t("channels.page.tableState")}</div>
          <div>${t("channels.page.tableAccount")}</div>
          <div>${t("channels.page.tableBoundAgent")}</div>
          <div>${t("channels.page.tableConnected")}</div>
          <div>${t("channels.page.tableRecentActivity")}</div>
          <div>${t("channels.page.tableLogs")}</div>
          <div>${t("channels.page.tableActions")}</div>
        </div>
        ${accounts.map((account) => {
          const isSelected = props.selectedChannelAccountId === account.accountId;
          const stateLabel = resolveAccountStateSummary(account);
          const lastActivity = resolveAccountLastActivity(account);
          const logCount = filterAccountLogs(channelLogs, account.accountId).length;
          const boundAgent = resolveBoundAgentSummary(
            props.configForm,
            channelKey,
            account.accountId,
          );
          const detailAction = () => props.onSelectChannelAccount(account.accountId);
          const editLabel =
            channelKey === "dingtalk-enterprise" || supportsGenericEditor
              ? t("channels.actions.editInstance")
              : t("channels.actions.channelConfig");
          const editAction = () =>
            channelKey === "dingtalk-enterprise"
              ? props.onOpenDingTalkAccountEditor("edit", account.accountId)
              : supportsGenericEditor
                ? props.onOpenGenericChannelAccountEditor(channelKey, "edit", account.accountId)
                : props.onOpenChannelConfigEditor(channelKey);
          const actionAction = () => {
            if (channelKey === "dingtalk-enterprise") {
              props.onDingTalkTest(account.accountId);
              return;
            }
            props.onRefresh(true);
          };
          return html`
            <div
              class="table-row channels-table__row"
              style=${isSelected ? "background: var(--bg-secondary);" : ""}
            >
              <div class="channels-table__primary">
                <div class="channels-table__name">
                  ${account.displayName || account.name || account.accountId}
                </div>
                <div class="channels-table__sub">${account.accountId}</div>
              </div>
              <div>${channelLabel}</div>
              <div>
                <span class="channels-state-badge channels-state-badge--${resolveStateTone(stateLabel)}">
                  ${stateLabel}
                </span>
              </div>
              <div>${account.accountId}</div>
              <div>${renderBoundAgentSummary(boundAgent)}</div>
              <div>${account.connected || account.running ? 1 : 0}</div>
              <div>
                ${lastActivity ? formatRelativeTimestamp(lastActivity) : t("common.na")}
              </div>
              <div>${logCount}</div>
              <div class="channels-table__actions">
                <button class="btn btn--sm primary" @click=${detailAction}>
                  ${t("channels.actions.openDetails")}
                </button>
                <button class="btn btn--sm" @click=${editAction}>${editLabel}</button>
                <button class="btn btn--sm" @click=${actionAction}>
                  ${
                    channelKey === "dingtalk-enterprise"
                      ? t("channels.actions.testConnection")
                      : t("channels.actions.refresh")
                  }
                </button>
                ${
                  channelKey === "dingtalk-enterprise" || supportsGenericEditor
                    ? html`
                        <button
                          class="btn btn--sm danger"
                          @click=${() => {
                            if (
                              typeof window !== "undefined" &&
                              !window.confirm(
                                t("channels.page.confirmDeleteInstance", {
                                  name: account.displayName || account.name || account.accountId,
                                }),
                              )
                            ) {
                              return;
                            }
                            if (channelKey === "dingtalk-enterprise") {
                              props.onDeleteDingTalkAccount(account.accountId);
                              return;
                            }
                            props.onDeleteGenericChannelAccount(channelKey, account.accountId);
                          }}
                        >
                          ${t("common.delete")}
                        </button>
                      `
                    : nothing
                }
              </div>
            </div>
          `;
        })}
      </div>
    </section>
  `;
}

function renderChannelDetailPage(params: {
  configSchema: ResolvedConfigSchema;
  selectedChannelKey: ChannelKey;
  selectedLabel: string;
  selectedDetail: string;
  selectedStateLabel: string;
  selectedAccount: ChannelAccountSnapshot | null;
  selectedAccounts: ChannelAccountSnapshot[];
  selectedChannelLogs: LogEntry[];
  selectedLogs: LogEntry[];
  props: ChannelsProps;
  data: ChannelsChannelData;
  modal?: boolean;
}) {
  const {
    configSchema,
    selectedChannelKey,
    selectedLabel,
    selectedDetail,
    selectedStateLabel,
    selectedAccount,
    selectedAccounts,
    selectedChannelLogs,
    selectedLogs,
    props,
    data,
    modal = false,
  } = params;
  const hasAccounts = selectedAccounts.length > 0;
  const supportsGenericEditor = supportsGenericChannelAccountEditor(
    configSchema,
    props,
    selectedChannelKey,
  );
  const supportsInstanceEditor =
    selectedChannelKey === "dingtalk-enterprise" || supportsGenericEditor;
  const selectedAccountActivity =
    selectedAccount?.lastInboundAt ??
    selectedAccount?.lastConnectedAt ??
    selectedAccount?.lastStartAt ??
    null;
  const selectedAccountBoundAgent = selectedAccount
    ? resolveBoundAgentSummary(props.configForm, selectedChannelKey, selectedAccount.accountId)
    : null;
  const showAccountDirectory = hasAccounts || supportsInstanceEditor;
  const showAccountBack = hasAccounts && selectedAccount != null;
  const showInstanceDetail =
    selectedAccount != null ||
    (!supportsInstanceEditor && !hasAccounts) ||
    (selectedChannelKey === "dingtalk-enterprise" && !hasAccounts);
  const showUnsafeDmScopeWarning =
    selectedAccounts.length > 1 &&
    selectedAccounts.some(
      (account) =>
        typeof account.dmScope === "string" && account.dmScope !== "per-account-channel-peer",
    );
  const showSharedGroupWarning = selectedAccounts.length > 1;
  const multiInstanceWarning = resolveMultiInstanceWarning({
    showSharedGroupWarning,
    showUnsafeDmScopeWarning,
  });
  const selectedAccountBoundAgentText = selectedAccountBoundAgent
    ? `${selectedAccountBoundAgent.label} · ${
        selectedAccountBoundAgent.source === "exact"
          ? t("channels.page.tableBoundAgentExact")
          : t("channels.page.tableBoundAgentDefault")
      }`
    : t("common.na");
  return html`
    <section class="channels-detail-page">
      <section class="channels-selection">
        <div class="channels-selection__head">
          <div class="channels-selection__summary">
            <div class="channels-selection__nav">
              ${
                showAccountBack && !modal
                  ? html`
                      <button
                        class="btn btn--sm"
                        @click=${() => props.onSelectChannelAccount(null)}
                      >
                        ${t("channels.page.backToAccounts")}
                      </button>
                    `
                  : nothing
              }
              ${
                !modal
                  ? html`
                      <button class="btn btn--sm" @click=${props.onBackToChannelList}>
                        ${t("channels.page.backToList")}
                      </button>
                    `
                  : nothing
              }
            </div>
            <div class="card-title channels-selection__title">${selectedLabel}</div>
            ${
              selectedAccount
                ? html`<div class="channels-selection__meta">${selectedDetail}</div>`
                : nothing
            }
          </div>
          <div class="channels-selection__actions">
            ${
              supportsInstanceEditor
                ? html`
                    <div class="channels-selection__action-group">
                      ${
                        selectedAccount
                          ? html`
                              <button
                                class="btn primary"
                                @click=${() => {
                                  if (selectedChannelKey === "dingtalk-enterprise") {
                                    props.onOpenDingTalkAccountEditor(
                                      "edit",
                                      selectedAccount.accountId,
                                    );
                                    return;
                                  }
                                  props.onOpenGenericChannelAccountEditor(
                                    selectedChannelKey,
                                    "edit",
                                    selectedAccount.accountId,
                                  );
                                }}
                              >
                                ${t("channels.actions.editInstance")}
                              </button>
                            `
                          : nothing
                      }
                      ${
                        selectedAccount
                          ? nothing
                          : html`
                              <button
                                class="btn primary"
                                @click=${() => {
                                  if (selectedChannelKey === "dingtalk-enterprise") {
                                    props.onOpenDingTalkAccountEditor("create");
                                    return;
                                  }
                                  props.onOpenGenericChannelAccountEditor(
                                    selectedChannelKey,
                                    "create",
                                  );
                                }}
                              >
                                ${t("channels.actions.createInstance")}
                              </button>
                            `
                      }
                    </div>
                  `
                : nothing
            }
            <div class="channels-selection__action-group">
              ${
                supportsInstanceEditor
                  ? nothing
                  : html`
                      <button
                        class="btn primary"
                        @click=${() => props.onOpenChannelConfigEditor(selectedChannelKey)}
                      >
                        ${t("channels.actions.channelConfig")}
                      </button>
                    `
              }
              <button class="btn" @click=${props.onOpenModelsConfig}>
                ${t("channels.actions.modelsConfig")}
              </button>
              <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh(false)}>
                ${props.loading ? t("instances.loading") : t("channels.actions.refresh")}
              </button>
            </div>
          </div>
        </div>
        <div class="channels-selection__stats">
          ${
            selectedAccount
              ? html`
                  ${renderSelectionStat(t("channels.page.integrationState"), selectedStateLabel, {
                    tone: resolveStateTone(selectedStateLabel),
                  })}
                  ${renderSelectionStat(t("channels.labels.accountId"), selectedAccount.accountId)}
                  ${renderSelectionStat(
                    t("channels.page.tableBoundAgent"),
                    selectedAccountBoundAgentText,
                  )}
                  ${renderSelectionStat(
                    t("channels.labels.recentActivity"),
                    selectedAccountActivity
                      ? formatRelativeTimestamp(selectedAccountActivity)
                      : t("common.na"),
                  )}
                  ${renderSelectionStat(
                    t("channels.page.monitoredLogs"),
                    String(selectedLogs.length),
                  )}
                `
              : html`
                  ${renderSelectionStat(t("channels.page.integrationState"), selectedStateLabel, {
                    tone: resolveStateTone(selectedStateLabel),
                  })}
                  ${renderSelectionStat(
                    t("channels.page.accountsLabel"),
                    String(selectedAccounts.length),
                  )}
                  ${renderSelectionStat(
                    t("channels.page.connectedAccounts"),
                    String(countActiveAccounts(selectedAccounts)),
                  )}
                  ${renderSelectionStat(
                    t("channels.page.monitoredLogs"),
                    String(selectedLogs.length),
                  )}
                `
          }
        </div>
        ${
          multiInstanceWarning
            ? html`
                <div class="callout warn channels-selection__hint" style="margin-top: 12px;">
                  ${multiInstanceWarning}
                </div>
              `
            : nothing
        }
      </section>

      ${
        selectedAccount || supportsInstanceEditor
          ? nothing
          : renderChannelConfigSection({ channelId: selectedChannelKey, props })
      }

      ${
        showAccountDirectory && !selectedAccount
          ? html`
              ${renderChannelAccountDirectory({
                configSchema,
                channelKey: selectedChannelKey,
                channelLabel: resolveChannelLabel(props.snapshot, selectedChannelKey),
                accounts: selectedAccounts,
                channelLogs: selectedChannelLogs,
                props,
              })}
            `
          : nothing
      }

      ${
        showInstanceDetail
          ? renderChannel(selectedChannelKey, props, data, {
              logCount: selectedLogs.length,
              logs: selectedLogs,
              channelLabel: resolveChannelLabel(props.snapshot, selectedChannelKey),
              selectedAccount,
            })
          : nothing
      }

      ${
        !showInstanceDetail || selectedChannelKey === "dingtalk-enterprise"
          ? nothing
          : renderChannelLogsPanel({
              props,
              channelLabel: selectedLabel,
              logs: selectedLogs,
            })
      }
    </section>
  `;
}

function renderChannelCreatePickerModal(
  props: ChannelsProps,
  orderedChannels: OrderedChannel[],
  configSchema: ResolvedConfigSchema,
) {
  if (!props.channelCreatePickerOpen) {
    return nothing;
  }
  return html`
    <div class="channels-modal-overlay" role="dialog" aria-modal="true">
      <div class="channels-modal">
        <div class="channels-modal__head">
          <div>
            <div class="channels-modal__title">${t("channels.page.createPickerTitle")}</div>
            <div class="channels-modal__sub">${t("channels.page.createPickerSubtitle")}</div>
          </div>
          <button class="btn btn--sm" @click=${props.onCloseChannelCreatePicker}>${t("channels.actions.close")}</button>
        </div>
        <div class="channels-modal__body">
          <div class="callout info">${t("channels.page.createPickerHint")}</div>
          <div class="channels-create-picker__grid" style="margin-top: 16px;">
            ${orderedChannels.map((channel) => {
              const supportsDirectCreate = supportsChannelInstanceEditor(
                configSchema,
                props,
                channel.key,
              );
              const isRecommended = channel.key === "dingtalk-connector";
              const isAdvancedCallback = channel.key === "dingtalk-enterprise";
              const selectionLabel = resolveChannelSelectionLabel(props.snapshot, channel.key);
              const blurb = resolveChannelBlurb(props.snapshot, channel.key);
              return html`
                <section class="channels-create-picker__card">
                  <div class="channels-create-picker__head">
                    <div>
                      <div class="channels-create-picker__title">
                        ${resolveChannelLabel(props.snapshot, channel.key)}
                      </div>
                      <div class="channels-create-picker__sub">
                        ${selectionLabel}
                      </div>
                      ${
                        blurb
                          ? html`
                              <div class="channels-create-picker__meta" style="margin-top: 8px;">
                                ${blurb}
                              </div>
                            `
                          : nothing
                      }
                    </div>
                    <span
                      class="channels-state-badge channels-state-badge--${
                        supportsDirectCreate ? "warn" : isRecommended ? "ok" : "muted"
                      }"
                    >
                      ${
                        isRecommended
                          ? t("channels.page.createPickerModeRecommended")
                          : isAdvancedCallback
                            ? t("channels.page.createPickerModeAdvanced")
                            : supportsDirectCreate
                              ? t("channels.page.createPickerModeCreate")
                              : t("channels.page.createPickerModeConfig")
                      }
                    </span>
                  </div>
                  <div class="channels-create-picker__footer">
                    <div class="channels-create-picker__meta">
                      ${
                        isRecommended
                          ? t("channels.page.createPickerActionRecommended")
                          : isAdvancedCallback
                            ? t("channels.page.createPickerActionAdvanced")
                            : supportsDirectCreate
                              ? t("channels.page.createPickerActionCreate")
                              : t("channels.page.createPickerActionConfig")
                      }
                    </div>
                    <button
                      class="btn ${isRecommended ? "primary" : ""}"
                      @click=${() => props.onStartChannelCreate(channel.key)}
                    >
                      ${
                        supportsDirectCreate
                          ? t("channels.actions.createInstance")
                          : t("channels.actions.configureIntegration")
                      }
                    </button>
                  </div>
                </section>
              `;
            })}
          </div>
        </div>
        <div class="channels-modal__actions">
          <button class="btn" @click=${props.onCloseChannelCreatePicker}>
            ${t("channels.actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderChannelConfigModal(props: ChannelsProps) {
  const channelId = props.channelConfigEditorChannelId;
  if (!channelId) {
    return nothing;
  }
  return html`
    <div class="channels-modal-overlay" role="dialog" aria-modal="true">
      <div class="channels-modal channels-modal--wide">
        <div class="channels-modal__head">
          <div>
            <div class="channels-modal__title">${t("channels.actions.editChannelConfig")}</div>
            <div class="channels-modal__sub">${resolveChannelLabel(props.snapshot, channelId)} · ${t("channels.config.subtitle")}</div>
          </div>
          <button class="btn btn--sm" @click=${props.onCloseChannelConfigEditor}>${t("channels.actions.close")}</button>
        </div>
        <div class="channels-modal__body">
          ${
            props.configSchemaLoading
              ? html`<div class="muted">${t("channels.config.loadingSchema")}</div>`
              : renderChannelConfigForm({
                  channelId,
                  configValue: props.configForm,
                  schema: props.configSchema,
                  uiHints: props.configUiHints,
                  disabled: props.configSaving || props.configSchemaLoading,
                  isSensitivePathRevealed: props.isSensitivePathRevealed,
                  onToggleSensitivePath: props.onToggleSensitivePath,
                  onPatch: props.onConfigPatch,
                })
          }
        </div>
        <div class="channels-modal__actions">
          <button class="btn" @click=${props.onCloseChannelConfigEditor}>取消</button>
          <button class="btn" ?disabled=${props.configSaving} @click=${props.onConfigReload}>
            ${t("channels.actions.reload")}
          </button>
          <button class="btn primary" ?disabled=${props.configSaving || !props.configFormDirty} @click=${async () => {
            const saved = await props.onConfigSave();
            if (saved === true) {
              props.onCloseChannelConfigEditor();
            }
          }}>
            ${props.configSaving ? t("channels.actions.saving") : t("channels.actions.save")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderGenericChannelAccountEditorModal(props: ChannelsProps) {
  const state = props.genericChannelAccountEditorState;
  if (!state) {
    return nothing;
  }
  const accountKey = state.accountId.trim() || state.originalAccountId || "__new__";
  const channelLabel = resolveChannelLabel(props.snapshot, state.channelId);
  return html`
    <div class="channels-modal-overlay" role="dialog" aria-modal="true">
      <div class="channels-modal channels-modal--wide">
        <div class="channels-modal__head">
          <div>
            <div class="channels-modal__title">
              ${
                state.mode === "create"
                  ? t("channels.actions.createInstance")
                  : t("channels.actions.editInstance")
              }
            </div>
            <div class="channels-modal__sub">
              ${channelLabel} · ${t("channels.genericEditor.subtitle")}
            </div>
          </div>
          <button class="btn btn--sm" @click=${props.onCloseGenericChannelAccountEditor}>${t("channels.actions.close")}</button>
        </div>
        <div class="channels-modal__body">
          ${
            state.error
              ? html`<div class="callout danger" style="margin-bottom: 12px;">${state.error}</div>`
              : nothing
          }
          <div class="callout info generic-account-editor__lead">
            <div>${t("channels.genericEditor.lead")}</div>
            <div style="margin-top: 8px;">${t("channels.genericEditor.modelsHint")}</div>
            <div style="margin-top: 8px;">
              <button class="btn btn--sm" @click=${props.onOpenModelsConfig}>
                ${t("channels.actions.modelsConfig")}
              </button>
            </div>
          </div>
          <div class="channels-form-grid" style="margin-top: 16px;">
            <label class="field">
              <span>${t("channels.genericEditor.displayName")}</span>
              <input
                type="text"
                .value=${asString(state.values.displayName) ?? asString(state.values.name) ?? ""}
                ?disabled=${state.saving}
                placeholder="总部审批机器人"
                @input=${(event: Event) =>
                  props.onGenericChannelAccountEditorPatch(
                    ["channels", state.channelId, "accounts", accountKey, "displayName"],
                    (event.target as HTMLInputElement).value,
                  )}
              />
              <small class="muted">${t("channels.genericEditor.displayNameHelp")}</small>
            </label>
            <label class="field">
              <span>${t("channels.labels.accountId")}</span>
              <input
                type="text"
                class="mono"
                .value=${state.accountId}
                ?disabled=${state.mode === "edit" || state.saving}
                placeholder="default"
                @input=${(event: Event) =>
                  props.onGenericChannelAccountEditorAccountIdChange(
                    (event.target as HTMLInputElement).value,
                  )}
              />
              <small class="muted">${t("channels.genericEditor.accountIdHelp")}</small>
            </label>
          </div>
          ${
            state.mode === "create" && state.agentDraft
              ? html`
                  <div class="callout info" style="margin-top: 16px;">
                    <label class="field checkbox" style="margin: 0;">
                      <input
                        type="checkbox"
                        .checked=${state.agentDraft.enabled}
                        ?disabled=${state.saving}
                        @change=${(event: Event) =>
                          props.onGenericChannelAccountEditorCreateAgentToggle?.(
                            (event.target as HTMLInputElement).checked,
                          )}
                      />
                      <span>${t("channels.genericEditor.createAgent")}</span>
                    </label>
                    <div class="muted" style="margin-top: 8px;">
                      ${t("channels.genericEditor.createAgentHelp")}
                    </div>
                    ${
                      state.agentDraft.enabled
                        ? html`
                            <div class="channels-form-grid" style="margin-top: 12px;">
                              <label class="field">
                                <span>${t("agentsPage.create.idLabel")}</span>
                                <input
                                  type="text"
                                  class="mono"
                                  .value=${state.agentDraft.id}
                                  ?disabled=${state.saving}
                                  @input=${(event: Event) =>
                                    props.onGenericChannelAccountEditorAgentFieldChange?.(
                                      "id",
                                      (event.target as HTMLInputElement).value,
                                    )}
                                />
                              </label>
                              <label class="field">
                                <span>${t("agentsPage.create.nameLabel")}</span>
                                <input
                                  type="text"
                                  .value=${state.agentDraft.name}
                                  ?disabled=${state.saving}
                                  @input=${(event: Event) =>
                                    props.onGenericChannelAccountEditorAgentFieldChange?.(
                                      "name",
                                      (event.target as HTMLInputElement).value,
                                    )}
                                />
                              </label>
                              <label class="field" style="grid-column: 1 / -1;">
                                <span>${t("agentsPage.create.workspaceLabel")}</span>
                                <input
                                  type="text"
                                  class="mono"
                                  .value=${state.agentDraft.workspace}
                                  ?disabled=${state.saving}
                                  @input=${(event: Event) =>
                                    props.onGenericChannelAccountEditorAgentFieldChange?.(
                                      "workspace",
                                      (event.target as HTMLInputElement).value,
                                    )}
                                />
                              </label>
                            </div>
                          `
                        : nothing
                    }
                  </div>
                `
              : nothing
          }
          <div class="generic-account-editor__options"></div>
          <div class="generic-account-editor__form">
            ${
              props.configSchemaLoading
                ? html`<div class="muted">${t("channels.config.loadingSchema")}</div>`
                : renderChannelAccountConfigForm({
                    channelId: state.channelId,
                    accountId: accountKey,
                    value: state.values,
                    configValue: props.configForm,
                    schema: props.configSchema,
                    uiHints: props.configUiHints,
                    disabled: state.saving || props.configSaving,
                    isSensitivePathRevealed: props.isSensitivePathRevealed,
                    onToggleSensitivePath: props.onToggleSensitivePath,
                    onPatch: props.onGenericChannelAccountEditorPatch,
                  })
            }
          </div>
        </div>
        <div class="channels-modal__actions">
          <button
            class="btn"
            ?disabled=${state.saving}
            @click=${props.onCloseGenericChannelAccountEditor}
          >
            ${t("channels.actions.cancel")}
          </button>
          <button
            class="btn primary"
            ?disabled=${state.saving || props.configSchemaLoading}
            @click=${() =>
              props.onSaveGenericChannelAccountEditor(
                state.mode === "create" && state.agentDraft?.enabled
                  ? {
                      createAgent: {
                        id: state.agentDraft.id,
                        name: state.agentDraft.name,
                        workspace: state.agentDraft.workspace,
                      },
                    }
                  : undefined,
              )}
          >
            ${state.saving ? t("channels.actions.saving") : t("channels.actions.save")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDingTalkAccountEditorModal(props: ChannelsProps) {
  const state = props.dingtalkAccountEditorState;
  if (!state) {
    return nothing;
  }
  const readiness = resolveDingTalkEditorReadiness(state.values);
  const callbackPreview = buildDingTalkCallbackPreview(state.values);
  return html`
    <div class="channels-modal-overlay" role="dialog" aria-modal="true">
      <div class="channels-modal channels-modal--wide">
        <div class="channels-modal__head">
          <div>
            <div class="channels-modal__title">
              ${
                state.mode === "create"
                  ? t("channels.dingtalk.editorCreateTitle")
                  : t("channels.dingtalk.editorEditTitle")
              }
            </div>
            <div class="channels-modal__sub">${t("channels.dingtalk.editor.leadDesc")}</div>
          </div>
          <button class="btn btn--sm" @click=${props.onCloseDingTalkAccountEditor}>${t("channels.actions.close")}</button>
        </div>
        <div class="channels-modal__body">
          ${
            state.error
              ? html`<div class="callout danger" style="margin-bottom: 12px;">${state.error}</div>`
              : nothing
          }
          <div class="callout info dingtalk-editor-lead">
            <strong>${t("channels.dingtalk.editor.leadTitle")}</strong>
            <span>${t("channels.dingtalk.editor.leadDesc")}</span>
          </div>

          <div class="dingtalk-editor-overview">
            <div class="dingtalk-editor-overview__main">
              <div class="dingtalk-editor-overview__title">
                ${t("channels.dingtalk.editor.summaryTitle")}
              </div>
              <div class="dingtalk-editor-overview__grid">
                ${renderEditorOverviewStat(
                  t("channels.dingtalk.editor.summaryReadyCount"),
                  `${readiness.readyCount}/${readiness.totalCount}`,
                  readiness.readyCount === readiness.totalCount ? "ok" : "warn",
                )}
                ${renderEditorOverviewStat(
                  t("channels.dingtalk.editor.summaryCredentialMode"),
                  readiness.credentialLabel,
                )}
                ${renderEditorOverviewStat(
                  t("channels.dingtalk.editor.summaryCallbacks"),
                  callbackPreview
                    ? t("channels.dingtalk.editor.summaryCallbacksReady")
                    : t("channels.dingtalk.editor.summaryCallbacksPending"),
                )}
                ${renderEditorOverviewStat(
                  t("channels.dingtalk.editor.summaryNextAction"),
                  readiness.nextAction,
                )}
              </div>
            </div>
            <div class="dingtalk-editor-overview__side">
              ${renderEditorProgressPill(
                t("channels.dingtalk.editor.progressBasic"),
                readiness.basicReady,
              )}
              ${renderEditorProgressPill(
                t("channels.dingtalk.editor.progressCredentials"),
                readiness.credentialsReady,
              )}
              ${renderEditorProgressPill(
                t("channels.dingtalk.editor.progressCallback"),
                readiness.callbackReady,
              )}
            </div>
          </div>

          <div class="dingtalk-editor-section">
            <div class="dingtalk-editor-section__title">
              ${t("channels.dingtalk.editor.basicSection")}
            </div>
            <div class="dingtalk-editor-section__desc">
              ${t("channels.dingtalk.editor.basicSectionDesc")}
            </div>
            <div class="channels-form-grid">
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldAccountId"),
                "accountId",
                state.values,
                props,
                {
                  disabled: state.mode === "edit" || state.saving,
                  help: t("channels.dingtalk.editor.fieldAccountIdHelp"),
                  placeholder: "corp-main",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldName"),
                "name",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldNameHelp"),
                  placeholder: "总部审批机器人",
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldAgentId"),
                "agentId",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldAgentIdHelp"),
                  placeholder: "1234567890",
                  mono: true,
                },
              )}
            </div>
          </div>

          <div class="dingtalk-editor-section">
            <div class="dingtalk-editor-section__title">
              ${t("channels.dingtalk.editor.credentialsSection")}
            </div>
            <div class="dingtalk-editor-section__desc">
              ${t("channels.dingtalk.editor.credentialsSectionDesc")}
            </div>
            <div class="callout info dingtalk-editor-hint">
              <strong>${t("channels.dingtalk.editor.credentialHintTitle")}</strong>
              <span>${t("channels.dingtalk.editor.credentialHintDesc")}</span>
            </div>
            <div class="channels-form-grid">
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldAppKey"),
                "appKey",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldAppKeyHelp"),
                  placeholder: "dingxxxxxxxx",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldAppSecret"),
                "appSecret",
                state.values,
                props,
                {
                  disabled: state.saving,
                  type: "password",
                  help: t("channels.dingtalk.editor.fieldAppSecretHelp"),
                  placeholder: "输入 AppSecret",
                  mono: true,
                  revealed: Boolean(state.revealedSensitiveFields?.appSecret),
                  toggleLabel: state.revealedSensitiveFields?.appSecret
                    ? t("configForm.sensitive.hideValue")
                    : t("configForm.sensitive.revealValue"),
                  onToggleReveal: () =>
                    props.onToggleDingTalkAccountEditorSensitiveField?.("appSecret"),
                },
              )}
            </div>
          </div>

          <div class="dingtalk-editor-section">
            <div class="dingtalk-editor-section__title">
              ${t("channels.dingtalk.editor.callbackSection")}
            </div>
            <div class="dingtalk-editor-section__desc">
              ${t("channels.dingtalk.editor.callbackSectionDesc")}
            </div>
            <div class="channels-form-grid">
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldCallbackBaseUrl"),
                "callbackBaseUrl",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldCallbackBaseUrlHelp"),
                  placeholder: "https://gateway.example.com",
                  mono: true,
                  full: true,
                },
              )}
            </div>
          </div>

          ${
            callbackPreview
              ? html`
                  <div class="dingtalk-editor-callbacks">
                    <div class="dingtalk-editor-callbacks__title">
                      ${t("channels.dingtalk.editor.callbackPreviewTitle")}
                    </div>
                    <div class="dingtalk-editor-callbacks__desc">
                      ${t("channels.dingtalk.editor.callbackPreviewDesc")}
                    </div>
                    <div class="dingtalk-editor-callbacks__list">
                      ${renderEditorCallbackPreview(
                        t("channels.dingtalk.labels.messageCallback"),
                        callbackPreview.message,
                      )}
                      ${renderEditorCallbackPreview(
                        t("channels.dingtalk.labels.cardCallback"),
                        callbackPreview.card,
                      )}
                      ${renderEditorCallbackPreview(
                        t("channels.dingtalk.labels.oaCallback"),
                        callbackPreview.oa,
                      )}
                    </div>
                  </div>
                `
              : html`
                  <div class="callout info dingtalk-editor-hint">
                    <strong>${t("channels.dingtalk.editor.callbackPreviewTitle")}</strong>
                    <span>${t("channels.dingtalk.editor.callbackPreviewPending")}</span>
                  </div>
                `
          }

          <div class="dingtalk-editor-options">
            <label class="field checkbox channels-form-checkbox">
              <span>${t("channels.dingtalk.editor.fieldEnabled")}</span>
              <input
                type="checkbox"
                .checked=${state.values.enabled}
                ?disabled=${state.saving}
                @change=${(event: Event) =>
                  props.onDingTalkAccountEditorFieldChange(
                    "enabled",
                    (event.target as HTMLInputElement).checked,
                  )}
              />
            </label>
          </div>

          <div class="dingtalk-editor-section">
            <div class="dingtalk-editor-section__title">
              ${t("channels.dingtalk.editor.policySection")}
            </div>
            <div class="dingtalk-editor-section__desc">
              ${t("channels.dingtalk.editor.policySectionDesc")}
            </div>
            <div class="channels-form-grid">
              ${renderAccountEditorSelect(
                t("channels.dingtalk.editor.fieldDmPolicy"),
                "dmPolicy",
                state.values,
                props,
                [
                  { value: "", label: t("channels.dingtalk.editor.policyModeInherit") },
                  { value: "open", label: t("channels.dingtalk.editor.policyModeOpen") },
                  { value: "allowlist", label: t("channels.dingtalk.editor.policyModeAllowlist") },
                  { value: "pairing", label: t("channels.dingtalk.editor.policyModePairing") },
                  { value: "disabled", label: t("channels.dingtalk.editor.policyModeDisabled") },
                ],
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldDmPolicyHelp"),
                },
              )}
              ${renderAccountEditorSelect(
                t("channels.dingtalk.editor.fieldGroupPolicy"),
                "groupPolicy",
                state.values,
                props,
                [
                  { value: "", label: t("channels.dingtalk.editor.policyModeInherit") },
                  { value: "open", label: t("channels.dingtalk.editor.policyModeOpen") },
                  { value: "allowlist", label: t("channels.dingtalk.editor.policyModeAllowlist") },
                  { value: "pairing", label: t("channels.dingtalk.editor.policyModePairing") },
                  { value: "disabled", label: t("channels.dingtalk.editor.policyModeDisabled") },
                ],
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldGroupPolicyHelp"),
                },
              )}
              <label class="field">
                <span>${t("channels.dingtalk.editor.fieldSessionScope")}</span>
                <input
                  type="text"
                  .value=${
                    state.values.sessionScope
                      ? localizeScopeValue(state.values.sessionScope)
                      : t("channels.dingtalk.editor.sessionScopeInherit")
                  }
                  disabled
                />
                <small>${t("channels.dingtalk.editor.fieldSessionScopeHelp")}</small>
              </label>
            </div>
          </div>

          <details class="dingtalk-editor-advanced" ?open=${Boolean(state.values.clientId.trim())}>
            <summary>${t("channels.dingtalk.editor.advancedSection")}</summary>
            <div class="dingtalk-editor-section__desc" style="margin-top: 10px;">
              ${t("channels.dingtalk.editor.advancedSectionDesc")}
            </div>
            <div class="callout info dingtalk-editor-hint" style="margin-top: 12px;">
              <strong>${t("channels.dingtalk.editor.advancedHintTitle")}</strong>
              <span>${t("channels.dingtalk.editor.advancedHintDesc")}</span>
            </div>
            <div class="channels-form-grid" style="margin-top: 12px;">
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldClientId"),
                "clientId",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldClientIdHelp"),
                  placeholder: "dingoa_xxxxxxxx",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldClientSecret"),
                "clientSecret",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldClientSecretHelp"),
                  placeholder: "输入 ClientSecret",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldRobotCode"),
                "robotCode",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldRobotCodeHelp"),
                  placeholder: "dingxxxxxxxx",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldTenantId"),
                "tenantId",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldTenantIdHelp"),
                  placeholder: "corp-tenant",
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldMessageCallbackPath"),
                "messageCallbackPath",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldMessageCallbackPathHelp"),
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldCardCallbackPath"),
                "cardCallbackPath",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldCardCallbackPathHelp"),
                  mono: true,
                },
              )}
              ${renderAccountEditorField(
                t("channels.dingtalk.editor.fieldOaCallbackPath"),
                "oaCallbackPath",
                state.values,
                props,
                {
                  disabled: state.saving,
                  help: t("channels.dingtalk.editor.fieldOaCallbackPathHelp"),
                  mono: true,
                },
              )}
            </div>
          </details>
        </div>
        <div class="channels-modal__actions">
          <button class="btn" ?disabled=${state.saving} @click=${props.onCloseDingTalkAccountEditor}>
            ${t("channels.actions.cancel")}
          </button>
          <button class="btn primary" ?disabled=${state.saving} @click=${props.onSaveDingTalkAccountEditor}>
            ${state.saving ? t("channels.actions.saving") : t("channels.actions.save")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderAccountEditorField(
  label: string,
  field: keyof DingTalkAccountEditorValues,
  values: DingTalkAccountEditorValues,
  props: ChannelsProps,
  options: {
    disabled?: boolean;
    type?: string;
    help?: string;
    placeholder?: string;
    mono?: boolean;
    full?: boolean;
    revealed?: boolean;
    toggleLabel?: string;
    onToggleReveal?: () => void;
  } = {},
) {
  const inputType =
    options.type === "password" && options.revealed ? "text" : (options.type ?? "text");
  return html`
    <label class="field ${options.full ? "full" : ""}">
      <span>${label}</span>
      <div class="field__control">
        <input
          class=${options.mono ? "mono" : ""}
          type=${inputType}
          .value=${String(values[field] ?? "")}
          placeholder=${options.placeholder ?? ""}
          ?disabled=${options.disabled}
          @input=${(event: Event) =>
            props.onDingTalkAccountEditorFieldChange(
              field,
              (event.target as HTMLInputElement).value,
            )}
        />
        ${
          options.onToggleReveal
            ? html`
                <button
                  type="button"
                  class="btn btn--sm field__reveal"
                  ?disabled=${options.disabled}
                  aria-label=${options.toggleLabel ?? ""}
                  @click=${options.onToggleReveal}
                >
                  ${options.toggleLabel}
                </button>
              `
            : nothing
        }
      </div>
      ${options.help ? html`<small>${options.help}</small>` : nothing}
    </label>
  `;
}

function renderAccountEditorSelect(
  label: string,
  field: keyof DingTalkAccountEditorValues,
  values: DingTalkAccountEditorValues,
  props: ChannelsProps,
  options: Array<{ value: string; label: string }>,
  config: { disabled?: boolean; help?: string } = {},
) {
  return html`
    <label class="field">
      <span>${label}</span>
      <select
        .value=${String(values[field] ?? "")}
        ?disabled=${config.disabled}
        @change=${(event: Event) =>
          props.onDingTalkAccountEditorFieldChange(
            field,
            (event.target as HTMLSelectElement).value,
          )}
      >
        ${options.map(
          (opt) =>
            html`<option value=${opt.value} ?selected=${values[field] === opt.value}>${opt.label}</option>`,
        )}
      </select>
      ${config.help ? html`<small>${config.help}</small>` : nothing}
    </label>
  `;
}

function renderEditorOverviewStat(
  label: string,
  value: string,
  tone: "ok" | "warn" | "muted" = "muted",
) {
  return html`
    <div class="dingtalk-editor-overview__stat">
      <div class="dingtalk-editor-overview__stat-label">${label}</div>
      <div class="dingtalk-editor-overview__stat-value ${tone}">${value}</div>
    </div>
  `;
}

function renderEditorProgressPill(label: string, ready: boolean) {
  return html`
    <div class="dingtalk-editor-progress ${ready ? "dingtalk-editor-progress--ok" : ""}">
      <span class="dingtalk-editor-progress__label">${label}</span>
      <span class="dingtalk-editor-progress__state">
        ${
          ready
            ? t("channels.dingtalk.editor.progressReady")
            : t("channels.dingtalk.editor.progressPending")
        }
      </span>
    </div>
  `;
}

function renderEditorCallbackPreview(label: string, value: string) {
  return html`
    <div class="dingtalk-editor-callbacks__item">
      <span class="dingtalk-editor-callbacks__label">${label}</span>
      <code>${value}</code>
    </div>
  `;
}

function normalizeDingTalkAccountIdForUi(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "")
    .slice(0, 64);
  return normalized || "default";
}

function resolveDingTalkCallbackPathForUi(
  values: DingTalkAccountEditorValues,
  kind: "message" | "card" | "oa",
): string {
  const legacyPath =
    kind === "message"
      ? "/webhooks/dingtalk/messages"
      : kind === "card"
        ? "/webhooks/dingtalk/cards/actions"
        : "/webhooks/dingtalk/oa/events";
  const rawPath =
    kind === "message"
      ? values.messageCallbackPath
      : kind === "card"
        ? values.cardCallbackPath
        : values.oaCallbackPath;
  const configuredPath = rawPath.trim()
    ? rawPath.trim().startsWith("/")
      ? rawPath.trim()
      : `/${rawPath.trim()}`
    : "";
  const normalizedAccountId = normalizeDingTalkAccountIdForUi(values.accountId);
  if (normalizedAccountId === "default") {
    return configuredPath || legacyPath;
  }
  if (configuredPath && configuredPath !== legacyPath) {
    return configuredPath;
  }
  if (kind === "message") {
    return `/webhooks/dingtalk/accounts/${normalizedAccountId}/messages`;
  }
  if (kind === "card") {
    return `/webhooks/dingtalk/accounts/${normalizedAccountId}/cards/actions`;
  }
  return `/webhooks/dingtalk/accounts/${normalizedAccountId}/oa/events`;
}

function buildDingTalkCallbackPreview(values: DingTalkAccountEditorValues): {
  message: string;
  card: string;
  oa: string;
} | null {
  const base = values.callbackBaseUrl.trim();
  if (!base) {
    return null;
  }
  const normalizedBase = base.replace(/\/+$/, "");
  const joinPath = (path: string) => `${normalizedBase}/${path.replace(/^\/+/, "")}`;
  return {
    message: joinPath(resolveDingTalkCallbackPathForUi(values, "message")),
    card: joinPath(resolveDingTalkCallbackPathForUi(values, "card")),
    oa: joinPath(resolveDingTalkCallbackPathForUi(values, "oa")),
  };
}

function resolveDingTalkEditorReadiness(values: DingTalkAccountEditorValues) {
  const basicReady = Boolean(values.accountId.trim() && values.agentId.trim());
  const credentialsReady = Boolean(
    (values.appKey.trim() && values.appSecret.trim()) ||
    (values.clientId.trim() && values.clientSecret.trim()),
  );
  const callbackReady = Boolean(values.callbackBaseUrl.trim());
  const readyCount = [basicReady, credentialsReady, callbackReady].filter(Boolean).length;
  let credentialLabel = t("channels.dingtalk.credentialModes.none");
  if (values.appKey.trim() && values.appSecret.trim()) {
    credentialLabel = t("channels.dingtalk.credentialModes.appSecret");
  } else if (values.clientId.trim() && values.clientSecret.trim()) {
    credentialLabel = t("channels.dingtalk.credentialModes.clientSecret");
  } else if (
    (values.appKey.trim() || values.appSecret.trim()) &&
    (values.clientId.trim() || values.clientSecret.trim())
  ) {
    credentialLabel = t("channels.dingtalk.credentialModes.mixed");
  }

  let nextAction = t("channels.dingtalk.editor.nextActionFillBasic");
  if (basicReady && !credentialsReady) {
    nextAction = t("channels.dingtalk.editor.nextActionFillCredentials");
  } else if (basicReady && credentialsReady && !callbackReady) {
    nextAction = t("channels.dingtalk.editor.nextActionFillCallback");
  } else if (basicReady && credentialsReady && callbackReady) {
    nextAction = t("channels.dingtalk.editor.nextActionSave");
  }

  return {
    basicReady,
    credentialsReady,
    callbackReady,
    readyCount,
    totalCount: 3,
    credentialLabel,
    nextAction,
  };
}

function resolveSelectedChannelKey(
  selectedChannelId: string | null,
  orderedChannels: OrderedChannel[],
): ChannelKey {
  if (selectedChannelId && orderedChannels.some((channel) => channel.key === selectedChannelId)) {
    return selectedChannelId;
  }
  return orderedChannels[0]?.key ?? "whatsapp";
}

function countConnectedAccounts(snapshot: ChannelsStatusSnapshot | null): number {
  return Object.values(snapshot?.channelAccounts ?? {})
    .flat()
    .filter((account) => account.connected || account.running).length;
}

function countActiveAccounts(accounts: ChannelAccountSnapshot[]): number {
  return accounts.filter((account) => account.connected || account.running).length;
}

function buildChannelListEntries(params: {
  orderedChannels: OrderedChannel[];
  props: ChannelsProps;
  logsByChannel: Map<string, LogEntry[]>;
  configSchema: ResolvedConfigSchema;
}): ChannelListEntry[] {
  const { orderedChannels, props, logsByChannel, configSchema } = params;
  return orderedChannels.flatMap((channel) => {
    const channelLabel = resolveChannelLabel(props.snapshot, channel.key);
    const accounts = props.snapshot?.channelAccounts?.[channel.key] ?? [];
    const channelLogs = logsByChannel.get(channel.key) ?? [];
    const status = (props.snapshot?.channels?.[channel.key] ?? null) as Record<
      string,
      unknown
    > | null;
    const supportsGenericEditor = supportsGenericChannelAccountEditor(
      configSchema,
      props,
      channel.key,
    );
    const supportsInstanceEditor = channel.key === "dingtalk-enterprise" || supportsGenericEditor;
    const stateLabel = resolveChannelStateSummary(channel.key, status, accounts);
    const tone = resolveStateTone(stateLabel);

    return [
      {
        id: channel.key,
        channelKey: channel.key,
        channelLabel,
        label: channelLabel,
        subtitle: resolveChannelListSubtitle(props.snapshot, channel.key),
        accountId: null,
        accountDisplay:
          accounts.length > 0
            ? t("channels.generic.accounts", { count: String(accounts.length) })
            : t("common.na"),
        stateLabel,
        tone,
        connectedCount: countActiveAccounts(accounts),
        logCount: channelLogs.length,
        lastActivityAt: resolveLatestActivity(accounts),
        supportsInstanceEditor,
        supportsDelete: false,
      } satisfies ChannelListEntry,
    ];
  });
}

export function filterChannelLogs(
  entries: LogEntry[],
  channelKey: ChannelKey,
  snapshot: ChannelsStatusSnapshot | null,
): LogEntry[] {
  const meta = resolveChannelMetaMap(snapshot)[channelKey];
  const presetKeywords: Record<string, string[]> = {
    "dingtalk-connector": ["dingtalk-connector", "mode: stream", "钉钉stream"],
    "dingtalk-enterprise": ["dingtalk-enterprise", "callback", "oa", "card", "钉钉回调"],
    whatsapp: ["whatsapp", "baileys", "channels.logout"],
    telegram: ["telegram"],
    discord: ["discord"],
    googlechat: ["googlechat", "google chat"],
    slack: ["slack"],
    signal: ["signal"],
    imessage: ["imessage", "bluebubbles"],
    nostr: ["nostr"],
  };
  const keywords = new Set(
    [channelKey, meta?.label, meta?.detailLabel, ...(presetKeywords[channelKey] ?? [])]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  );

  return entries.filter((entry) => {
    const haystack = [entry.subsystem, entry.message, entry.raw]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    for (const keyword of keywords) {
      if (keyword && haystack.includes(keyword)) {
        return true;
      }
    }
    return false;
  });
}

function filterAccountLogs(entries: LogEntry[], accountId: string): LogEntry[] {
  const keyword = accountId.trim().toLowerCase();
  if (!keyword) {
    return entries;
  }
  return entries.filter((entry) => {
    const haystack = [entry.subsystem, entry.message, entry.raw]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

function resolveLatestActivity(accounts: ChannelAccountSnapshot[]): number | null {
  const candidates = accounts.flatMap((account) =>
    [account.lastInboundAt, account.lastConnectedAt, account.lastStartAt].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    ),
  );
  if (candidates.length === 0) {
    return null;
  }
  return Math.max(...candidates);
}

function resolveSelectedChannelAccount(
  _status: Record<string, unknown> | null,
  accounts: ChannelAccountSnapshot[],
  selectedAccountId: string | null,
): ChannelAccountSnapshot | null {
  if (accounts.length === 0) {
    return null;
  }
  if (selectedAccountId) {
    const selected = accounts.find((account) => account.accountId === selectedAccountId);
    if (selected) {
      return selected;
    }
  }
  return null;
}

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  const base = snapshot?.channelMeta?.length
    ? snapshot.channelMeta.map((entry) => entry.id)
    : snapshot?.channelOrder?.length
      ? snapshot.channelOrder
      : ["whatsapp", "telegram", "discord", "googlechat", "slack", "signal", "imessage", "nostr"];
  return Array.from(new Set([...PRIORITY_CHANNEL_IDS, ...base]));
}

function renderChannel(
  key: ChannelKey,
  props: ChannelsProps,
  data: ChannelsChannelData,
  context: {
    logCount: number;
    logs: LogEntry[];
    channelLabel: string;
    selectedAccount: ChannelAccountSnapshot | null;
  },
) {
  const accountCountLabel = renderChannelAccountCount(key, data.channelAccounts);
  switch (key) {
    case "dingtalk-enterprise":
      return renderDingTalkCard({
        channelId: key,
        props,
        status: (props.snapshot?.channels?.[key] ?? null) as Record<string, unknown> | null,
        accounts: data.channelAccounts?.[key] ?? [],
        accountCountLabel,
        logCount: context.logCount,
        logs: context.logs,
        channelLabel: context.channelLabel,
      });
    case "whatsapp":
      return renderWhatsAppCard({
        props,
        whatsapp: data.whatsapp,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "telegram":
      return renderTelegramCard({
        props,
        telegram: data.telegram,
        telegramAccounts: data.channelAccounts?.telegram ?? [],
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "discord":
      return renderDiscordCard({
        props,
        discord: data.discord,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "googlechat":
      return renderGoogleChatCard({
        props,
        googleChat: data.googlechat,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "slack":
      return renderSlackCard({
        props,
        slack: data.slack,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "signal":
      return renderSignalCard({
        props,
        signal: data.signal,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "imessage":
      return renderIMessageCard({
        props,
        imessage: data.imessage,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
      });
    case "nostr": {
      const nostrAccounts = data.channelAccounts?.nostr ?? [];
      const primaryAccount = context.selectedAccount ?? nostrAccounts[0];
      const accountId = primaryAccount?.accountId ?? "default";
      const profile =
        (primaryAccount as { profile?: NostrProfile | null } | undefined)?.profile ?? null;
      const showForm =
        props.nostrProfileAccountId === accountId ? props.nostrProfileFormState : null;
      const profileFormCallbacks = showForm
        ? {
            onFieldChange: props.onNostrProfileFieldChange,
            onSave: props.onNostrProfileSave,
            onImport: props.onNostrProfileImport,
            onCancel: props.onNostrProfileCancel,
            onToggleAdvanced: props.onNostrProfileToggleAdvanced,
          }
        : null;
      return renderNostrCard({
        props,
        nostr: data.nostr,
        nostrAccounts,
        accountCountLabel,
        selectedAccount: context.selectedAccount,
        profileFormState: showForm,
        profileFormCallbacks,
        onEditProfile: () => props.onNostrProfileEdit(accountId, profile),
      });
    }
    default:
      return renderGenericChannelCard(
        key,
        props,
        data.channelAccounts ?? {},
        context.selectedAccount,
      );
  }
}

function renderGenericChannelCard(
  key: ChannelKey,
  props: ChannelsProps,
  channelAccounts: Record<string, ChannelAccountSnapshot[]>,
  selectedAccount: ChannelAccountSnapshot | null,
) {
  const label = resolveChannelLabel(props.snapshot, key);
  const status = props.snapshot?.channels?.[key] as Record<string, unknown> | undefined;
  const configured = typeof status?.configured === "boolean" ? status.configured : undefined;
  const running = typeof status?.running === "boolean" ? status.running : undefined;
  const connected = typeof status?.connected === "boolean" ? status.connected : undefined;
  const lastError = typeof status?.lastError === "string" ? status.lastError : undefined;
  const accounts = channelAccounts[key] ?? [];
  const accountCountLabel = renderChannelAccountCount(key, channelAccounts);
  const supportsGenericEditor = supportsGenericChannelAccountEditor(
    analyzeConfigSchema(props.configSchema).schema,
    props,
    key,
  );

  return html`
    <div class="card">
      <div class="card-title">${label}</div>
      ${accountCountLabel}

      ${
        selectedAccount
          ? html`
              <div class="account-card-list">
                ${renderGenericAccount(selectedAccount)}
              </div>
            `
          : html`
              <div class="status-list" style="margin-top: 16px;">
                <div>
                  <span class="label">${t("channels.labels.configured")}</span>
                  <span>${formatBooleanLabel(configured, { unknownAsNa: true })}</span>
                </div>
                <div>
                  <span class="label">${t("channels.labels.running")}</span>
                  <span>${formatBooleanLabel(running, { unknownAsNa: true })}</span>
                </div>
                <div>
                  <span class="label">${t("channels.labels.connected")}</span>
                  <span>${formatBooleanLabel(connected, { unknownAsNa: true })}</span>
                </div>
                <div>
                  <span class="label">${t("channels.page.accountsLabel")}</span>
                  <span>${String(accounts.length)}</span>
                </div>
              </div>
            `
      }

      ${
        lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${lastError}
          </div>`
          : nothing
      }

      ${supportsGenericEditor || selectedAccount ? nothing : renderChannelConfigSection({ channelId: key, props })}
    </div>
  `;
}

function resolveMultiInstanceWarning(params: {
  showSharedGroupWarning: boolean;
  showUnsafeDmScopeWarning: boolean;
}): string | null {
  const { showSharedGroupWarning, showUnsafeDmScopeWarning } = params;
  if (!showSharedGroupWarning) {
    return null;
  }
  return showUnsafeDmScopeWarning
    ? t("channels.page.multiInstanceRiskCompactWithScope")
    : t("channels.page.multiInstanceRiskCompact");
}

function resolveChannelMetaMap(
  snapshot: ChannelsStatusSnapshot | null,
): Record<string, ChannelUiMetaEntry> {
  const base: Record<string, ChannelUiMetaEntry> = snapshot?.channelMeta?.length
    ? Object.fromEntries(snapshot.channelMeta.map((entry) => [entry.id, entry]))
    : {};
  const overrideIds = new Set<string>([...PRIORITY_CHANNEL_IDS, ...Object.keys(base), "feishu"]);
  for (const id of overrideIds) {
    const meta = resolveLocalizedChannelMeta(id, base[id]);
    if (meta) {
      base[id] = meta;
    }
  }
  return base;
}

function isExactRouteBinding(binding: JsonRecord, match: JsonRecord): boolean {
  const type = asString(binding.type);
  if (type && type !== "route") {
    return false;
  }
  const keys = Object.keys(match);
  return keys.length > 0 && keys.every((key) => key === "channel" || key === "accountId");
}

function resolveDefaultAgentSummary(
  configForm: Record<string, unknown> | null,
): BoundAgentSummary | null {
  const agentsRoot = asRecord(configForm?.agents);
  const agentEntries = Array.isArray(agentsRoot?.list)
    ? agentsRoot.list
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => Boolean(entry))
    : [];
  const explicitDefaultAgentId = asString(agentsRoot?.defaultId);
  const defaultAgentEntry =
    agentEntries.find((entry) => entry.default === true) ??
    agentEntries.find(
      (entry) => normalizeLookup(asString(entry.id)) === normalizeLookup(explicitDefaultAgentId),
    ) ??
    agentEntries[0] ??
    null;
  const defaultAgentId = explicitDefaultAgentId ?? asString(defaultAgentEntry?.id);
  if (!defaultAgentId) {
    return null;
  }
  return {
    id: defaultAgentId,
    label: asString(defaultAgentEntry?.name) ?? asString(defaultAgentEntry?.id) ?? defaultAgentId,
    source: "default",
  };
}

function resolveAgentLabelFromConfig(
  configForm: Record<string, unknown> | null,
  agentId: string,
): string {
  const agentsRoot = asRecord(configForm?.agents);
  const agentEntries = Array.isArray(agentsRoot?.list)
    ? agentsRoot.list
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => Boolean(entry))
    : [];
  const match = agentEntries.find(
    (entry) => normalizeLookup(asString(entry.id)) === normalizeLookup(agentId),
  );
  return asString(match?.name) ?? asString(match?.id) ?? agentId;
}

function resolveBoundAgentSummary(
  configForm: Record<string, unknown> | null,
  channelId: string,
  accountId: string,
): BoundAgentSummary | null {
  const bindings = Array.isArray((configForm as { bindings?: unknown[] } | null)?.bindings)
    ? ((configForm as { bindings?: unknown[] }).bindings ?? [])
    : [];
  const matchedBinding = bindings.find((entry) => {
    const binding = asRecord(entry);
    const match = asRecord(binding?.match);
    const agentId = asString(binding?.agentId);
    if (!binding || !match || !agentId || !isExactRouteBinding(binding, match)) {
      return false;
    }
    return (
      normalizeLookup(asString(match.channel)) === normalizeLookup(channelId) &&
      normalizeLookup(asString(match.accountId)) === normalizeLookup(accountId)
    );
  });
  const bindingRecord = asRecord(matchedBinding);
  const exactAgentId = asString(bindingRecord?.agentId);
  if (exactAgentId) {
    return {
      id: exactAgentId,
      label: resolveAgentLabelFromConfig(configForm, exactAgentId),
      source: "exact",
    };
  }
  return resolveDefaultAgentSummary(configForm);
}

function renderBoundAgentSummary(summary: BoundAgentSummary | null) {
  if (!summary) {
    return html`<span class="channels-table__sub">${t("common.na")}</span>`;
  }
  const sourceLabel =
    summary.source === "exact"
      ? t("channels.page.tableBoundAgentExact")
      : t("channels.page.tableBoundAgentDefault");
  const showId = normalizeLookup(summary.label) !== normalizeLookup(summary.id);
  return html`
    <div class="channels-table__binding">
      <div class="channels-table__name">${summary.label}</div>
      ${showId ? html`<div class="channels-table__sub mono">${summary.id}</div>` : nothing}
      <div>
        <span
          class="channels-state-badge channels-state-badge--${summary.source === "exact" ? "ok" : "muted"}"
        >
          ${sourceLabel}
        </span>
      </div>
    </div>
  `;
}

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return meta?.label ?? snapshot?.channelLabels?.[key] ?? key;
}

function resolveChannelSelectionLabel(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return (
    meta?.selectionLabel ??
    meta?.detailLabel ??
    meta?.label ??
    snapshot?.channelLabels?.[key] ??
    key
  );
}

function resolveChannelDetailLabel(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return (
    meta?.detailLabel ?? snapshot?.channelDetailLabels?.[key] ?? resolveChannelLabel(snapshot, key)
  );
}

function resolveChannelBlurb(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return meta?.blurb ?? "";
}

function resolveChannelListSubtitle(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const blurb = resolveChannelBlurb(snapshot, key);
  return blurb || resolveChannelDetailLabel(snapshot, key);
}

function resolveLocalizedChannelMeta(
  key: string,
  existing?: ChannelUiMetaEntry,
): ChannelUiMetaEntry | null {
  switch (key) {
    case "dingtalk-connector":
      return {
        ...(existing ?? { id: key }),
        label: t("channels.localized.dingtalkConnector.label"),
        detailLabel: t("channels.localized.dingtalkConnector.detailLabel"),
        selectionLabel: t("channels.localized.dingtalkConnector.selectionLabel"),
        docsPath: "/channels/dingtalk-connector",
        docsLabel: "dingtalk-connector",
        blurb: t("channels.localized.dingtalkConnector.blurb"),
        order: 8,
      };
    case "dingtalk-enterprise":
      return {
        ...(existing ?? { id: key }),
        label: t("channels.enterprise.dingtalk.label"),
        detailLabel: t("channels.enterprise.dingtalk.detailLabel"),
        selectionLabel: t("channels.enterprise.dingtalk.selectionLabel"),
        docsPath: "/channels/dingtalk-enterprise",
        docsLabel: "dingtalk",
        blurb: t("channels.enterprise.dingtalk.blurb"),
        order: 12,
      };
    case "feishu":
      return {
        ...(existing ?? { id: key }),
        label: t("channels.localized.feishu.label"),
        detailLabel: t("channels.localized.feishu.detailLabel"),
        selectionLabel: t("channels.localized.feishu.selectionLabel"),
        blurb: t("channels.localized.feishu.blurb"),
      };
    default:
      return existing ?? null;
  }
}

function resolveStatusFlag(
  status: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
): boolean {
  const raw = status?.[key];
  if (typeof raw === "boolean") {
    return raw;
  }
  return fallback;
}

function resolveChannelStateSummary(
  key: string,
  status: Record<string, unknown> | null,
  accounts: ChannelAccountSnapshot[],
): string {
  const connected = resolveStatusFlag(
    status,
    "connected",
    accounts.some((account) => account.connected || account.running),
  );
  if (connected) {
    return t("channels.page.stateConnected");
  }
  const configured = resolveStatusFlag(
    status,
    "configured",
    accounts.some((account) => account.configured),
  );
  if (configured) {
    return t("channels.page.stateConfigured");
  }
  if (key === "dingtalk-enterprise") {
    return t("channels.page.statePlanned");
  }
  return t("channels.page.statePending");
}

function resolveAccountStateSummary(account: ChannelAccountSnapshot): string {
  if (account.enabled === false) {
    return t("common.disabled");
  }
  if (account.connected || account.running) {
    return t("channels.page.stateConnected");
  }
  if (account.configured) {
    return t("channels.page.stateConfigured");
  }
  return t("channels.page.statePending");
}

function resolveStateTone(label: string): "ok" | "warn" | "muted" {
  if (label === t("channels.page.stateConnected") || label === t("channels.page.stateConfigured")) {
    return "ok";
  }
  if (label === t("common.disabled")) {
    return "muted";
  }
  return "warn";
}

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
  if (!account.lastInboundAt) {
    return false;
  }
  return Date.now() - account.lastInboundAt < RECENT_ACTIVITY_THRESHOLD_MS;
}

function deriveRunningStatus(account: ChannelAccountSnapshot): ChannelStateLabel {
  if (account.running) {
    return "yes";
  }
  // If we have recent inbound activity, the channel is effectively running
  if (hasRecentActivity(account)) {
    return "active";
  }
  return "no";
}

function deriveConnectedStatus(account: ChannelAccountSnapshot): ChannelStateLabel {
  if (account.connected === true) {
    return "yes";
  }
  if (account.connected === false) {
    return "no";
  }
  // If connected is null/undefined but we have recent activity, show as active
  if (hasRecentActivity(account)) {
    return "active";
  }
  return "na";
}

function renderGenericAccount(account: ChannelAccountSnapshot) {
  const runningStatus = deriveRunningStatus(account);
  const connectedStatus = deriveConnectedStatus(account);
  const displayLabel = account.displayName || account.name || account.accountId;
  const stateLabel = resolveAccountStateSummary(account);
  const allowFrom =
    Array.isArray(account.allowFrom) && account.allowFrom.length > 0
      ? account.allowFrom.join("、")
      : t("channels.generic.allowFromInherited");
  const groupAllowFrom =
    Array.isArray(account.groupAllowFrom) && account.groupAllowFrom.length > 0
      ? account.groupAllowFrom.join("、")
      : t("channels.generic.groupAllowFromInherited");
  const clientIdValue =
    typeof account.clientId === "string" && account.clientId.trim().length > 0
      ? account.clientId.trim()
      : null;
  const showClientSecretState = typeof account.clientSecretConfigured === "boolean";
  const clientSecretState = account.clientSecretConfigured
    ? t("channels.generic.secretConfiguredHidden")
    : t("channels.generic.secretMissing");
  const dmPolicy = account.dmPolicy ? localizePolicyValue(account.dmPolicy) : t("common.na");
  const groupPolicy = account.groupPolicy
    ? localizePolicyValue(account.groupPolicy)
    : t("common.na");
  const sessionScope = account.sessionScopeSummary ?? account.dmScope ?? null;
  const showDmIsolationWarning =
    typeof account.dmScope === "string" &&
    account.dmScope !== "per-account-channel-peer" &&
    account.dmScope !== "per-account-channel-sender";
  const summaryItems = [
    {
      label: t("channels.page.integrationState"),
      value: stateLabel,
      tone: resolveStateTone(stateLabel),
    },
    {
      label: t("channels.labels.clientId"),
      value: clientIdValue ?? t("channels.generic.clientIdMissing"),
    },
    {
      label: t("channels.labels.sessionScope"),
      value: sessionScope ? localizeScopeValue(sessionScope) : t("common.na"),
    },
    {
      label: t("channels.labels.lastInbound"),
      value: account.lastInboundAt
        ? formatRelativeTimestamp(account.lastInboundAt)
        : t("common.na"),
    },
  ] as const;

  return html`
    <div class="account-card account-card--detail">
      <div class="account-card-header">
        <div>
          <div class="account-card-title">
            ${displayLabel}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="account-card-badges">
          <span class="channels-state-badge channels-state-badge--${resolveStateTone(stateLabel)}">
            ${stateLabel}
          </span>
          ${
            showClientSecretState
              ? html`
                  <span
                    class="channels-state-badge channels-state-badge--${
                      account.clientSecretConfigured ? "ok" : "muted"
                    }"
                  >
                    ${clientSecretState}
                  </span>
                `
              : nothing
          }
        </div>
      </div>
      <div class="account-card-summary">
        ${summaryItems.map(
          (item) => html`
            <div class="account-card-summary__item">
              <div class="account-card-summary__label">${item.label}</div>
              <div class="account-card-summary__value ${item.tone ?? ""}">${item.value}</div>
            </div>
          `,
        )}
      </div>
      ${
        showDmIsolationWarning
          ? html`
              <div class="account-card-error">
                ${t("channels.generic.dmIsolationWarning")}
              </div>
            `
          : nothing
      }
      ${
        account.lastError
          ? html`
              <div class="account-card-error">
                ${account.lastError}
              </div>
            `
          : nothing
      }
      <details class="account-card-advanced">
        <summary>${t("channels.generic.moreFields")}</summary>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("channels.labels.displayName")}</span>
            <span>${displayLabel}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.running")}</span>
            <span>${formatChannelStateLabel(runningStatus)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.configured")}</span>
            <span>${formatBooleanLabel(account.configured)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.connected")}</span>
            <span>${formatChannelStateLabel(connectedStatus)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.dmPolicy")}</span>
            <span>${dmPolicy}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.groupPolicy")}</span>
            <span>${groupPolicy}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.allowFrom")}</span>
            <span>${allowFrom}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.groupAllowFrom")}</span>
            <span>${groupAllowFrom}</span>
          </div>
          ${
            showClientSecretState
              ? html`
                  <div>
                    <span class="label">${t("channels.labels.clientSecret")}</span>
                    <span>${clientSecretState}</span>
                  </div>
                `
              : nothing
          }
          ${
            account.requireMention != null
              ? html`
                  <div>
                    <span class="label">${t("channels.labels.requireMention")}</span>
                    <span>${formatBooleanLabel(account.requireMention, { unknownAsNa: true })}</span>
                  </div>
                `
              : nothing
          }
        </div>
      </details>
    </div>
  `;
}

function localizePolicyValue(value: string): string {
  switch (value) {
    case "open":
      return t("channels.dingtalk.editor.policyModeOpen");
    case "allowlist":
      return t("channels.dingtalk.editor.policyModeAllowlist");
    case "pairing":
      return t("channels.dingtalk.editor.policyModePairing");
    case "disabled":
      return t("channels.dingtalk.editor.policyModeDisabled");
    default:
      return value;
  }
}

function localizeScopeValue(value: string): string {
  const normalized = value.trim();
  switch (normalized) {
    case "main":
    case "shared-main":
      return t("channels.scopes.sharedMain");
    case "per-peer":
    case "per-sender":
      return t("channels.scopes.perSender");
    case "per-channel-peer":
    case "per-channel-sender":
      return t("channels.scopes.perChannelSender");
    case "per-account-channel-peer":
    case "per-account-channel-sender":
      return t("channels.scopes.perAccountChannelSender");
    default:
      return normalized;
  }
}
