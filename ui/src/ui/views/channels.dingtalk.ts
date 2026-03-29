import { html, nothing } from "lit";
import { i18n, t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { DingTalkPreviewResult } from "../controllers/channels.ts";
import type { ChannelAccountSnapshot, LogEntry } from "../types.ts";
import { renderChannelLogsPanel } from "./channels.logs.ts";
import { formatBooleanLabel } from "./channels.shared.ts";
import type { ChannelsProps, DingTalkPreviewPreset } from "./channels.types.ts";

type ProbeSummary = {
  ok?: boolean;
  error?: string | null;
  mode?: string;
  credentialMode?: string;
  missingRequired?: string[];
  missingOptional?: string[];
  notes?: string[];
  callbacks?: {
    baseUrl?: string | null;
    message?: { path?: string; url?: string | null };
    card?: { path?: string; url?: string | null };
    oa?: { path?: string; url?: string | null };
  };
};

type TimelineEvent = {
  id: string;
  at: number | null;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "muted";
  sourceLabel: string;
};

type ChecklistItem = {
  label: string;
  detail: string;
  tone: "ok" | "warn" | "muted";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function resolveProbe(
  status: Record<string, unknown> | null,
  account: ChannelAccountSnapshot | null,
  accounts: ChannelAccountSnapshot[],
): ProbeSummary | null {
  const direct = asRecord(account?.probe);
  if (direct) {
    return direct as ProbeSummary;
  }
  const channelProbe = asRecord(status?.probe);
  if (channelProbe) {
    return channelProbe as ProbeSummary;
  }
  for (const entry of accounts) {
    const probe = asRecord(entry.probe);
    if (probe) {
      return probe as ProbeSummary;
    }
  }
  return null;
}

function resolveCallbackValue(
  probe: ProbeSummary | null,
  status: Record<string, unknown> | null,
  account: ChannelAccountSnapshot | null,
  scope: "message" | "card" | "oa",
) {
  const callbacks = probe?.callbacks;
  const scoped = callbacks?.[scope];
  if (scoped?.url) {
    return scoped.url;
  }
  if (scoped?.path) {
    return scoped.path;
  }

  const app = asRecord(account?.application);
  if (scope === "message") {
    if (typeof account?.webhookUrl === "string" && account.webhookUrl.trim()) {
      return account.webhookUrl;
    }
    if (typeof account?.webhookPath === "string" && account.webhookPath.trim()) {
      return account.webhookPath;
    }
  }

  const appUrlKey =
    scope === "message"
      ? "callbackUrl"
      : scope === "card"
        ? "cardCallbackUrl"
        : "oaCallbackUrl";
  const appPathKey =
    scope === "message"
      ? "callbackPath"
      : scope === "card"
        ? "cardCallbackPath"
        : "oaCallbackPath";
  const appUrl = app?.[appUrlKey];
  if (typeof appUrl === "string" && appUrl.trim()) {
    return appUrl;
  }
  const appPath = app?.[appPathKey];
  if (typeof appPath === "string" && appPath.trim()) {
    return appPath;
  }

  const statusUrlKey =
    scope === "message"
      ? "messageCallbackUrl"
      : scope === "card"
        ? "cardCallbackUrl"
        : "oaCallbackUrl";
  const statusPathKey =
    scope === "message"
      ? "messageCallbackPath"
      : scope === "card"
        ? "cardCallbackPath"
        : "oaCallbackPath";
  const statusUrl = status?.[statusUrlKey];
  if (typeof statusUrl === "string" && statusUrl.trim()) {
    return statusUrl;
  }
  const statusPath = status?.[statusPathKey];
  return typeof statusPath === "string" && statusPath.trim()
    ? statusPath
    : t("channels.dingtalk.values.none");
}

function resolveCredentialModeLabel(mode: string | undefined) {
  switch (mode) {
    case "appSecret":
      return t("channels.dingtalk.credentialModes.appSecret");
    case "clientSecret":
      return t("channels.dingtalk.credentialModes.clientSecret");
    case "mixed":
      return t("channels.dingtalk.credentialModes.mixed");
    default:
      return t("channels.dingtalk.credentialModes.none");
  }
}

function resolveFlag(
  status: Record<string, unknown> | null,
  key: string,
  accounts: ChannelAccountSnapshot[],
  fallback: (account: ChannelAccountSnapshot) => boolean | null | undefined,
) {
  const raw = status?.[key];
  if (typeof raw === "boolean") {
    return raw;
  }
  const values = accounts.map((account) => fallback(account)).filter((value) => value != null);
  if (values.length === 0) {
    return null;
  }
  return values.some(Boolean);
}

function resolveLastError(
  status: Record<string, unknown> | null,
  account: ChannelAccountSnapshot | null,
  accounts: ChannelAccountSnapshot[],
): string | null {
  if (typeof account?.lastError === "string" && account.lastError.trim()) {
    return account.lastError;
  }
  if (typeof status?.lastError === "string" && status.lastError.trim()) {
    return status.lastError;
  }
  return accounts.find((entry) => entry.lastError)?.lastError ?? null;
}

function resolveSelectedAccount(
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
  if (accounts.length === 1) {
    return accounts[0] ?? null;
  }
  return null;
}

function resolveAccountStateLabel(account: ChannelAccountSnapshot): string {
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

function countActiveAccounts(accounts: ChannelAccountSnapshot[]) {
  return accounts.filter((account) => account.connected || account.running).length;
}

function resolveEnabledLabel(account: ChannelAccountSnapshot | null) {
  if (!account) {
    return t("common.na");
  }
  return account.enabled === false ? t("common.disabled") : t("common.enabled");
}

function renderInfoRow(label: string, value: string, options: { mono?: boolean } = {}) {
  return html`
    <div class="dingtalk-detail__row">
      <span class="dingtalk-detail__label">${label}</span>
      <span class="dingtalk-detail__value ${options.mono ? "mono" : ""}">${value}</span>
    </div>
  `;
}

function clipText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  try {
    return new Intl.ListFormat(i18n.getLocale(), {
      style: "long",
      type: "conjunction",
    }).format(values);
  } catch {
    return values.join(", ");
  }
}

function parseLogTime(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resolveLogTimelineTone(level?: string | null): "ok" | "warn" | "muted" {
  if (level === "error" || level === "fatal" || level === "warn") {
    return "warn";
  }
  if (level === "info") {
    return "ok";
  }
  return "muted";
}

function buildRecentTimelineEvents(params: {
  account: ChannelAccountSnapshot;
  probe: ProbeSummary | null;
  logs: LogEntry[];
}): TimelineEvent[] {
  const { account, probe, logs } = params;
  const events: TimelineEvent[] = [];
  const pushEvent = (event: TimelineEvent | null) => {
    if (event) {
      events.push(event);
    }
  };

  pushEvent(
    account.lastProbeAt
      ? {
          id: "probe",
          at: account.lastProbeAt,
          title:
            probe?.ok === false
              ? t("channels.dingtalk.timeline.probeFailedTitle")
              : t("channels.dingtalk.timeline.probePassedTitle"),
          detail:
            probe?.ok === false
              ? clipText(
                  probe.error?.trim() || t("channels.dingtalk.values.configIncomplete"),
                  140,
                )
              : t("channels.dingtalk.timeline.probePassedDetail"),
          tone: probe?.ok === false ? "warn" : "ok",
          sourceLabel: t("channels.dingtalk.timeline.sourceProbe"),
        }
      : null,
  );

  pushEvent(
    account.lastConnectedAt
      ? {
          id: "connected",
          at: account.lastConnectedAt,
          title: t("channels.dingtalk.timeline.connectedTitle"),
          detail: t("channels.dingtalk.timeline.connectedDetail"),
          tone: "ok",
          sourceLabel: t("channels.dingtalk.timeline.sourceRuntime"),
        }
      : null,
  );

  pushEvent(
    account.lastInboundAt
      ? {
          id: "inbound",
          at: account.lastInboundAt,
          title: t("channels.dingtalk.timeline.inboundTitle"),
          detail: t("channels.dingtalk.timeline.inboundDetail"),
          tone: "ok",
          sourceLabel: t("channels.dingtalk.timeline.sourceTraffic"),
        }
      : null,
  );

  pushEvent(
    account.lastOutboundAt
      ? {
          id: "outbound",
          at: account.lastOutboundAt,
          title: t("channels.dingtalk.timeline.outboundTitle"),
          detail: t("channels.dingtalk.timeline.outboundDetail"),
          tone: "muted",
          sourceLabel: t("channels.dingtalk.timeline.sourceTraffic"),
        }
      : null,
  );

  pushEvent(
    account.lastStartAt
      ? {
          id: "start",
          at: account.lastStartAt,
          title: t("channels.dingtalk.timeline.startedTitle"),
          detail: t("channels.dingtalk.timeline.startedDetail"),
          tone: "ok",
          sourceLabel: t("channels.dingtalk.timeline.sourceRuntime"),
        }
      : null,
  );

  pushEvent(
    account.lastStopAt
      ? {
          id: "stop",
          at: account.lastStopAt,
          title: t("channels.dingtalk.timeline.stoppedTitle"),
          detail: t("channels.dingtalk.timeline.stoppedDetail"),
          tone: "muted",
          sourceLabel: t("channels.dingtalk.timeline.sourceRuntime"),
        }
      : null,
  );

  pushEvent(
    account.lastError?.trim()
      ? {
          id: "error",
          at: account.lastProbeAt ?? account.lastStopAt ?? account.lastInboundAt ?? null,
          title: t("channels.dingtalk.timeline.lastErrorTitle"),
          detail: clipText(account.lastError.trim(), 140),
          tone: "warn",
          sourceLabel: t("channels.dingtalk.timeline.sourceIncident"),
        }
      : null,
  );

  for (const entry of logs.slice(-6)) {
    const message = clipText((entry.message ?? entry.raw ?? "").trim(), 160);
    if (!message) {
      continue;
    }
    events.push({
      id: `log:${entry.time ?? "na"}:${entry.subsystem ?? "gateway"}:${message}`,
      at: parseLogTime(entry.time),
      title: `${(entry.level ?? "log").toUpperCase()} · ${entry.subsystem ?? "gateway"}`,
      detail: message,
      tone: resolveLogTimelineTone(entry.level),
      sourceLabel: t("channels.dingtalk.timeline.sourceLogs"),
    });
  }

  return events
    .toSorted((a, b) => {
      if (a.at == null && b.at == null) {
        return 0;
      }
      if (a.at == null) {
        return 1;
      }
      if (b.at == null) {
        return -1;
      }
      return b.at - a.at;
    })
    .slice(0, 8);
}

function renderTimeline(events: TimelineEvent[]) {
  if (events.length === 0) {
    return html`<div class="callout info">${t("channels.dingtalk.timeline.empty")}</div>`;
  }
  return html`
    <div class="dingtalk-timeline">
      ${events.map(
        (event) => html`
          <div class="dingtalk-timeline__item">
            <div class="dingtalk-timeline__rail">
              <span class="dingtalk-timeline__dot dingtalk-timeline__dot--${event.tone}"></span>
            </div>
            <div class="dingtalk-timeline__body">
              <div class="dingtalk-timeline__meta">
                <span class="dingtalk-timeline__source">${event.sourceLabel}</span>
                <span class="dingtalk-timeline__time">
                  ${event.at
                    ? formatRelativeTimestamp(event.at)
                    : t("channels.dingtalk.timeline.timeUnknown")}
                </span>
              </div>
              <div class="dingtalk-timeline__title">${event.title}</div>
              <div class="dingtalk-timeline__detail">${event.detail}</div>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function renderSetupGuide() {
  const steps = [
    {
      title: t("channels.dingtalk.steps.credentialsTitle"),
      detail: t("channels.dingtalk.steps.credentialsDetail"),
    },
    {
      title: t("channels.dingtalk.steps.callbackTitle"),
      detail: t("channels.dingtalk.steps.callbackDetail"),
    },
    {
      title: t("channels.dingtalk.steps.subscriptionTitle"),
      detail: t("channels.dingtalk.steps.subscriptionDetail"),
    },
    {
      title: t("channels.dingtalk.steps.logsTitle"),
      detail: t("channels.dingtalk.steps.logsDetail"),
    },
  ];

  return html`
    <details class="dingtalk-guide">
      <summary>${t("channels.dingtalk.setupTitle")}</summary>
      <div class="list" style="margin-top: 12px;">
        ${steps.map(
          (step, index) => html`
            <div class="list-item">
              <div class="list-main">
                <div class="list-title">${index + 1}. ${step.title}</div>
                <div class="list-sub">${step.detail}</div>
              </div>
            </div>
          `,
        )}
      </div>
    </details>
  `;
}

function renderPreviewSection(params: {
  props: ChannelsProps;
  accountId: string | null;
}): unknown {
  const { props, accountId } = params;
  const preset = props.dingtalkPreviewPreset;
  const result = props.dingtalkPreviewResult;
  const loading = props.dingtalkPreviewLoading;

  const presetOptions: Array<{ value: DingTalkPreviewPreset; label: string; desc: string }> = [
    {
      value: "direct",
      label: t("channels.dingtalk.preview.directMessage"),
      desc: t("channels.dingtalk.preview.directMessageDesc"),
    },
    {
      value: "groupMention",
      label: t("channels.dingtalk.preview.groupMention"),
      desc: t("channels.dingtalk.preview.groupMentionDesc"),
    },
    {
      value: "oaEvent",
      label: t("channels.dingtalk.preview.oaEvent"),
      desc: t("channels.dingtalk.preview.oaEventDesc"),
    },
  ];

  return html`
    <section class="dingtalk-section">
      <div class="dingtalk-section__head">
        <div class="card-title" style="font-size: 14px;">
          ${t("channels.dingtalk.preview.title")}
        </div>
      </div>

      <div class="dingtalk-preview-presets">
        ${presetOptions.map(
          (opt) => html`
            <button
              class="btn btn--sm ${preset === opt.value ? "primary" : ""}"
              ?disabled=${loading}
              @click=${() => props.onDingTalkPreviewPresetChange(opt.value)}
            >
              ${opt.label}
            </button>
          `,
        )}
      </div>

      <div class="dingtalk-preview-actions" style="margin-top: 12px;">
        <button
          class="btn primary"
          ?disabled=${loading || !accountId}
          @click=${() => props.onDingTalkPreview(accountId, preset)}
        >
          ${loading
            ? t("channels.dingtalk.preview.previewing")
            : t("channels.dingtalk.preview.previewButton")}
        </button>
      </div>

      ${
        result
          ? html`
              <div class="dingtalk-preview-result" style="margin-top: 16px;">
                ${renderPreviewResultCard(result)}
              </div>
            `
          : nothing
      }
    </section>
  `;
}

function renderPreviewResultCard(result: DingTalkPreviewResult): unknown {
  const { claims, route, toolPolicy, approval, auditEvent } = result;
  const allowedToolClasses = toolPolicy.allowedToolClasses ?? [];
  const deniedToolClasses = toolPolicy.deniedToolClasses ?? [];

  const acceptedBadge = result.accepted
    ? html`<span class="chip chip-ok">${t("channels.dingtalk.preview.accepted")}</span>`
    : html`<span class="chip chip-warn">${t("channels.dingtalk.preview.rejected")}</span>`;

  return html`
    <div class="dingtalk-preview-card">
      <div class="dingtalk-preview-card__head">
        <span class="dingtalk-preview-card__title">
          ${t("channels.dingtalk.preview.resultTitle")}
        </span>
        ${acceptedBadge}
      </div>

      <div class="dingtalk-preview-card__section">
        <div class="dingtalk-preview-card__section-title">
          ${t("channels.dingtalk.preview.subjectInfo")}
        </div>
        <div class="dingtalk-preview-card__grid">
          ${renderPreviewRow(t("channels.dingtalk.preview.claimsChannel"), claims.channel)}
          ${renderPreviewRow(t("channels.dingtalk.preview.claimsAccountId"), claims.accountId)}
          ${renderPreviewRow(
            t("channels.dingtalk.preview.claimsSender"),
            claims.displayName ?? claims.subjectId,
          )}
          ${renderPreviewRow(
            t("channels.dingtalk.preview.claimsChatType"),
            claims.chatType === "direct"
              ? t("channels.dingtalk.preview.claimsChatTypeDirect")
              : claims.chatType === "group"
                ? t("channels.dingtalk.preview.claimsChatTypeGroup")
                : t("channels.dingtalk.preview.claimsChatTypeWorkflow"),
          )}
          ${renderPreviewRow(
            t("channels.dingtalk.preview.claimsMentioned"),
            claims.mentioned ? t("channels.dingtalk.preview.yes") : t("channels.dingtalk.preview.no"),
          )}
          ${renderPreviewRow(t("channels.dingtalk.preview.claimsRiskTier"), claims.riskTier)}
        </div>
      </div>

      <div class="dingtalk-preview-card__section">
        <div class="dingtalk-preview-card__section-title">
          ${t("channels.dingtalk.preview.routeResult")}
        </div>
        <div class="dingtalk-preview-card__grid">
          ${renderPreviewRow(
            t("channels.dingtalk.preview.routeAllowed"),
            route.allowed ? t("channels.dingtalk.preview.accepted") : t("channels.dingtalk.preview.rejected"),
            { tone: route.allowed ? "ok" : "warn" },
          )}
          ${renderPreviewRow(t("channels.dingtalk.preview.routeTarget"), route.route)}
          ${renderPreviewRow(t("channels.dingtalk.preview.routeReason"), route.reason)}
        </div>
      </div>

      <div class="dingtalk-preview-card__section">
        <div class="dingtalk-preview-card__section-title">
          ${t("channels.dingtalk.preview.toolPolicy")}
        </div>
        <div class="dingtalk-preview-card__grid">
          ${renderPreviewRow(
            t("channels.dingtalk.preview.toolPolicyAllowed"),
            toolPolicy.allowed ? t("channels.dingtalk.preview.accepted") : t("channels.dingtalk.preview.rejected"),
            { tone: toolPolicy.allowed ? "ok" : "warn" },
          )}
          ${renderPreviewRow(
            t("channels.dingtalk.preview.toolPolicyAllowedClasses"),
            allowedToolClasses.length > 0
              ? formatList(allowedToolClasses)
              : t("channels.dingtalk.preview.none"),
          )}
          ${renderPreviewRow(
            t("channels.dingtalk.preview.toolPolicyBlockedClasses"),
            deniedToolClasses.length > 0
              ? formatList(deniedToolClasses)
              : t("channels.dingtalk.preview.none"),
          )}
        </div>
      </div>

      <div class="dingtalk-preview-card__section">
        <div class="dingtalk-preview-card__section-title">
          ${t("channels.dingtalk.preview.approval")}
        </div>
        <div class="dingtalk-preview-card__grid">
          ${renderPreviewRow(
            t("channels.dingtalk.preview.approvalRequired"),
            approval.required ? t("channels.dingtalk.preview.yes") : t("channels.dingtalk.preview.no"),
            { tone: approval.required ? "warn" : "ok" },
          )}
          ${renderPreviewRow(t("channels.dingtalk.preview.approvalLevel"), approval.level)}
        </div>
      </div>

      <div class="dingtalk-preview-card__section">
        <div class="dingtalk-preview-card__section-title">
          ${t("channels.dingtalk.preview.auditEvent")}
        </div>
        <div class="dingtalk-preview-card__grid">
          ${renderPreviewRow(
            t("channels.dingtalk.preview.auditOutcome"),
            auditEvent.outcome === "accepted"
              ? t("channels.dingtalk.preview.auditOutcomeAccepted")
              : auditEvent.outcome === "blocked"
                ? t("channels.dingtalk.preview.auditOutcomeBlocked")
                : auditEvent.outcome === "pending-approval"
                  ? t("channels.dingtalk.preview.auditOutcomePending")
                  : auditEvent.outcome,
          )}
          ${renderPreviewRow(t("channels.dingtalk.preview.auditSummary"), auditEvent.summary)}
        </div>
      </div>
    </div>
  `;
}

function renderPreviewRow(
  label: string,
  value: string,
  options: { tone?: "ok" | "warn" | "muted" } = {},
): unknown {
  return html`
    <div class="dingtalk-preview-row">
      <span class="dingtalk-preview-row__label">${label}</span>
      <span class="dingtalk-preview-row__value dingtalk-preview-row__value--${options.tone ?? "default"}">${value}</span>
    </div>
  `;
}

function resolveProbeStatus(probe: ProbeSummary | null): {
  label: string;
  tone: "ok" | "warn" | "muted";
} {
  if (!probe) {
    return {
      label: t("channels.dingtalk.summary.probePending"),
      tone: "muted",
    };
  }
  return probe.ok === false
    ? {
        label: t("channels.dingtalk.summary.probeFailed"),
        tone: "warn",
      }
    : {
        label: t("channels.dingtalk.summary.probePassed"),
        tone: "ok",
      };
}

function countReadyCallbacks(values: string[]): number {
  const noneLabel = t("channels.dingtalk.values.none");
  return values.filter((value) => value && value !== noneLabel).length;
}

function resolveNextAction(params: {
  probe: ProbeSummary | null;
  missingRequired: string[];
  callbackReadyCount: number;
  account: ChannelAccountSnapshot;
  logs: LogEntry[];
}) {
  const { probe, missingRequired, callbackReadyCount, account, logs } = params;
  if (!probe) {
    return t("channels.dingtalk.summary.nextRunTest");
  }
  if (probe.ok === false || missingRequired.length > 0) {
    return t("channels.dingtalk.summary.nextFixRequired", {
      fields:
        missingRequired.length > 0
          ? formatList(missingRequired)
          : t("channels.dingtalk.values.configIncomplete"),
    });
  }
  if (callbackReadyCount < 3) {
    return t("channels.dingtalk.summary.nextReviewCallbacks");
  }
  if (account.lastError?.trim()) {
    return t("channels.dingtalk.summary.nextInspectLogs");
  }
  if (logs.length === 0) {
    return t("channels.dingtalk.summary.nextSendMessage");
  }
  return t("channels.dingtalk.summary.nextHealthy");
}

function buildChecklist(params: {
  account: ChannelAccountSnapshot;
  probe: ProbeSummary | null;
  callbackReadyCount: number;
  logs: LogEntry[];
  selectedActivityAt: number | null;
}): ChecklistItem[] {
  const { account, probe, callbackReadyCount, logs, selectedActivityAt } = params;
  const credentialMode = resolveCredentialModeLabel(probe?.credentialMode);

  return [
    {
      label: t("channels.dingtalk.summary.checklistBasic"),
      detail:
        account.name?.trim()
          ? `${account.name} · ${account.accountId}`
          : account.accountId,
      tone: "ok",
    },
    !probe
      ? {
          label: t("channels.dingtalk.summary.checklistCredentials"),
          detail: t("channels.dingtalk.summary.checklistCredentialsUnknown"),
          tone: "muted",
        }
      : probe.ok === false && credentialMode === t("channels.dingtalk.credentialModes.none")
        ? {
            label: t("channels.dingtalk.summary.checklistCredentials"),
            detail: t("channels.dingtalk.summary.checklistCredentialsPending"),
            tone: "warn",
          }
        : {
            label: t("channels.dingtalk.summary.checklistCredentials"),
            detail: t("channels.dingtalk.summary.checklistCredentialsReady", {
              mode: credentialMode,
            }),
            tone: credentialMode === t("channels.dingtalk.credentialModes.none") ? "warn" : "ok",
          },
    callbackReadyCount === 3
      ? {
          label: t("channels.dingtalk.summary.checklistCallbacks"),
          detail: t("channels.dingtalk.summary.checklistCallbacksReady", {
            count: String(callbackReadyCount),
          }),
          tone: "ok",
        }
      : {
          label: t("channels.dingtalk.summary.checklistCallbacks"),
          detail: t("channels.dingtalk.summary.checklistCallbacksPending", {
            count: String(callbackReadyCount),
          }),
          tone: "warn",
        },
    logs.length > 0
      ? {
          label: t("channels.dingtalk.summary.checklistObservation"),
          detail: t("channels.dingtalk.summary.checklistObservationReady", {
            count: String(logs.length),
          }),
          tone: "ok",
        }
      : selectedActivityAt
        ? {
            label: t("channels.dingtalk.summary.checklistObservation"),
            detail: t("channels.dingtalk.summary.checklistObservationSeen", {
              time: formatRelativeTimestamp(selectedActivityAt),
            }),
            tone: "muted",
          }
        : {
            label: t("channels.dingtalk.summary.checklistObservation"),
            detail: t("channels.dingtalk.summary.checklistObservationPending"),
            tone: "muted",
          },
  ];
}

function renderSummaryCard(
  label: string,
  value: string,
  options: { tone?: "ok" | "warn" | "muted"; wide?: boolean } = {},
) {
  return html`
    <div class="dingtalk-summary__card ${options.wide ? "dingtalk-summary__card--wide" : ""}">
      <div class="dingtalk-summary__card-label">${label}</div>
      <div class="dingtalk-summary__card-value ${options.tone ?? "muted"}">${value}</div>
    </div>
  `;
}

function renderChecklistItem(item: ChecklistItem) {
  const toneLabel =
    item.tone === "ok"
      ? t("channels.dingtalk.summary.checklistToneReady")
      : item.tone === "warn"
        ? t("channels.dingtalk.summary.checklistTonePending")
        : t("channels.dingtalk.summary.checklistToneVerify");
  return html`
    <div class="dingtalk-checklist__item">
      <span class="dingtalk-checklist__state dingtalk-checklist__state--${item.tone}">
        ${toneLabel}
      </span>
      <div class="dingtalk-checklist__copy">
        <div class="dingtalk-checklist__label">${item.label}</div>
        <div class="dingtalk-checklist__detail">${item.detail}</div>
      </div>
    </div>
  `;
}

export function renderDingTalkCard(params: {
  channelId: string;
  channelLabel: string;
  props: ChannelsProps;
  status: Record<string, unknown> | null;
  accounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
  logCount: number;
  logs: LogEntry[];
}) {
  const { channelLabel, props, status, accounts, logCount, logs } = params;
  const configured = resolveFlag(status, "configured", accounts, (account) => account.configured);
  const running = resolveFlag(status, "running", accounts, (account) => account.running);
  const connected = resolveFlag(status, "connected", accounts, (account) => account.connected);
  const hasRuntime = Boolean(status) || accounts.length > 0;
  const selectedAccount = resolveSelectedAccount(
    status,
    accounts,
    props.selectedChannelAccountId,
  );
  const selectedProbe = resolveProbe(status, selectedAccount, accounts);
  const lastError = resolveLastError(status, selectedAccount, accounts);
  const missingRequired = asStringArray(selectedProbe?.missingRequired);
  const missingOptional = asStringArray(selectedProbe?.missingOptional);
  const probeNotes = asStringArray(selectedProbe?.notes);
  const selectedStateLabel = selectedAccount
    ? resolveAccountStateLabel(selectedAccount)
    : connected
      ? t("channels.page.stateConnected")
      : configured
        ? t("channels.page.stateConfigured")
        : t("channels.page.statePending");
  const defaultAccountId =
    typeof status?.defaultAccountId === "string" && status.defaultAccountId.trim()
      ? status.defaultAccountId
      : null;
  const isDefaultAccount = Boolean(
    selectedAccount &&
      (selectedAccount.accountId === defaultAccountId ||
        (!defaultAccountId && selectedAccount.accountId === "default")),
  );
  const selectedActivityAt =
    selectedAccount?.lastInboundAt ??
    selectedAccount?.lastConnectedAt ??
    selectedAccount?.lastStartAt ??
    null;
  const callbackValues = selectedAccount
    ? [
        resolveCallbackValue(selectedProbe, status, selectedAccount, "message"),
        resolveCallbackValue(selectedProbe, status, selectedAccount, "card"),
        resolveCallbackValue(selectedProbe, status, selectedAccount, "oa"),
      ]
    : [];
  const callbackReadyCount = countReadyCallbacks(callbackValues);
  const probeStatus = resolveProbeStatus(selectedProbe);
  const nextAction =
    selectedAccount != null
      ? resolveNextAction({
          probe: selectedProbe,
          missingRequired,
          callbackReadyCount,
          account: selectedAccount,
          logs,
        })
      : t("channels.dingtalk.summary.nextRunTest");
  const checklist =
    selectedAccount != null
      ? buildChecklist({
          account: selectedAccount,
          probe: selectedProbe,
          callbackReadyCount,
          logs,
          selectedActivityAt,
        })
      : [];
  const recentEvents = selectedAccount
    ? buildRecentTimelineEvents({
        account: selectedAccount,
        probe: selectedProbe,
        logs,
      })
    : [];

  return html`
    <section class="card dingtalk-card">
      <div class="dingtalk-card__header">
        <div>
          <div class="card-title">
            ${selectedAccount ? selectedAccount.name || selectedAccount.accountId : t("channels.dingtalk.title")}
          </div>
          ${
            selectedAccount
              ? html`<div class="channels-selection__meta">${channelLabel} · ${selectedAccount.accountId}</div>`
              : nothing
          }
        </div>
        <div class="dingtalk-card__badges">
          <span class="chip">${t("channels.dingtalk.badges.enterprise")}</span>
          <span class="chip ${hasRuntime ? "chip-ok" : ""}">
            ${hasRuntime
              ? t("channels.dingtalk.badges.runtimeReady")
              : t("channels.dingtalk.badges.placeholder")}
          </span>
          <span class="chip">${t("channels.dingtalk.logsCount", { count: String(logCount) })}</span>
        </div>
      </div>

      <div class="dingtalk-card__metrics">
        ${renderMetricCard(t("channels.page.integrationState"), selectedStateLabel, {
          tone: resolveStateTone(selectedStateLabel),
        })}
        ${renderMetricCard(t("channels.page.accountsLabel"), String(accounts.length))}
        ${renderMetricCard(t("channels.page.connectedAccounts"), String(countActiveAccounts(accounts)))}
        ${renderMetricCard(t("channels.page.monitoredLogs"), String(logCount))}
      </div>

      ${
        !hasRuntime
          ? html`<div class="callout info" style="margin-top: 14px;">
              ${t("channels.dingtalk.placeholderNotice")}
            </div>`
          : nothing
      }
      ${
        lastError
          ? html`<div class="callout danger" style="margin-top: 14px;">
              ${lastError}
            </div>`
          : nothing
      }

      ${
        !selectedAccount
          ? html`
              <section class="dingtalk-detail">
                <div class="dingtalk-workbench">
                  <section class="dingtalk-summary">
                    <div class="dingtalk-summary__head">
                      <div class="card-title" style="font-size: 14px;">
                        ${t("channels.dingtalk.summary.title")}
                      </div>
                    </div>
                    <div class="dingtalk-summary__grid">
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.stateLabel"),
                        t("channels.dingtalk.summary.stateEmpty"),
                        {
                          tone: "warn",
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.probeLabel"),
                        t("channels.dingtalk.summary.probePending"),
                        {
                          tone: "muted",
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.callbackLabel"),
                        t("channels.dingtalk.summary.callbacksReadyCount", {
                          count: "0",
                        }),
                        {
                          tone: "warn",
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.nextStepLabel"),
                        t("channels.dingtalk.summary.nextCreateFirstAccount"),
                        {
                          wide: true,
                        },
                      )}
                    </div>
                  </section>

                  <section class="dingtalk-checklist">
                    <div class="card-title" style="font-size: 14px;">
                      ${t("channels.dingtalk.summary.checklistTitle")}
                    </div>
                    <div class="dingtalk-checklist__list">
                      ${renderChecklistItem({
                        label: t("channels.dingtalk.summary.checklistCreateAccount"),
                        detail: t("channels.dingtalk.summary.checklistCreateAccountPending"),
                        tone: "warn",
                      })}
                      ${renderChecklistItem({
                        label: t("channels.dingtalk.summary.checklistCredentials"),
                        detail: t("channels.dingtalk.summary.checklistCredentialsUnknown"),
                        tone: "muted",
                      })}
                      ${renderChecklistItem({
                        label: t("channels.dingtalk.summary.checklistCallbacks"),
                        detail: t("channels.dingtalk.summary.checklistCallbacksPending", {
                          count: "0",
                        }),
                        tone: "warn",
                      })}
                      ${renderChecklistItem(
                        logs.length > 0
                          ? {
                              label: t("channels.dingtalk.summary.checklistObservation"),
                              detail: t("channels.dingtalk.summary.checklistObservationReady", {
                                count: String(logs.length),
                              }),
                              tone: "ok",
                            }
                          : {
                              label: t("channels.dingtalk.summary.checklistObservation"),
                              detail: t("channels.dingtalk.summary.checklistObservationPending"),
                              tone: "muted",
                            },
                      )}
                    </div>
                  </section>
                </div>
                <div class="dingtalk-detail__actions">
                  <button
                    class="btn primary"
                    @click=${() => props.onOpenDingTalkAccountEditor("create")}
                  >
                    ${t("channels.actions.createAccount")}
                  </button>
                  <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh(false)}>
                    ${props.loading ? t("instances.loading") : t("channels.actions.refresh")}
                  </button>
                </div>
                ${renderChannelLogsPanel({
                  props,
                  channelLabel,
                  logs,
                  embedded: true,
                })}
                ${renderSetupGuide()}
              </section>
            `
          : html`
              <section class="dingtalk-detail">
                <div class="dingtalk-detail__head">
                  <div>
                    <div class="card-title">
                      ${selectedAccount.name || selectedAccount.accountId}
                    </div>
                    <div class="card-sub mono">${selectedAccount.accountId}</div>
                  </div>
                  <div class="dingtalk-detail__actions">
                    <button
                      class="btn primary"
                      ?disabled=${props.loading || props.dingtalkTesting}
                      @click=${() => props.onDingTalkTest(selectedAccount.accountId)}
                    >
                      ${props.dingtalkTesting
                        ? t("channels.actions.testingConnection")
                        : t("channels.actions.testConnection")}
                    </button>
                    <button
                      class="btn"
                      ?disabled=${props.dingtalkTesting}
                      @click=${() =>
                        props.onOpenDingTalkAccountEditor("edit", selectedAccount.accountId)}
                    >
                      ${t("channels.actions.edit")}
                    </button>
                    <button
                      class="btn"
                      @click=${() => {
                        props.onLogsRefresh();
                        props.onFocusLogsPanel();
                      }}
                    >
                      ${t("channels.actions.viewLogs")}
                    </button>
                    <button class="btn" ?disabled=${props.loading} @click=${() => props.onRefresh(false)}>
                      ${props.loading ? t("instances.loading") : t("channels.actions.refresh")}
                    </button>
                    <button
                      class="btn danger"
                      @click=${() => {
                        const accountLabel = selectedAccount.name || selectedAccount.accountId;
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(`${t("common.delete")}: ${accountLabel}`)
                        ) {
                          return;
                        }
                        props.onDeleteDingTalkAccount(selectedAccount.accountId);
                      }}
                    >
                      ${t("common.delete")}
                    </button>
                  </div>
                </div>

                <div class="dingtalk-workbench">
                  <section class="dingtalk-summary">
                    <div class="dingtalk-summary__head">
                      <div class="card-title" style="font-size: 14px;">
                        ${t("channels.dingtalk.summary.title")}
                      </div>
                    </div>
                    <div class="dingtalk-summary__grid">
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.stateLabel"),
                        selectedStateLabel,
                        {
                          tone: resolveStateTone(selectedStateLabel),
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.probeLabel"),
                        probeStatus.label,
                        {
                          tone: probeStatus.tone,
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.callbackLabel"),
                        t("channels.dingtalk.summary.callbacksReadyCount", {
                          count: String(callbackReadyCount),
                        }),
                        {
                          tone: callbackReadyCount === 3 ? "ok" : "warn",
                        },
                      )}
                      ${renderSummaryCard(
                        t("channels.dingtalk.summary.nextStepLabel"),
                        nextAction,
                        {
                          wide: true,
                        },
                      )}
                    </div>
                  </section>

                  <section class="dingtalk-checklist">
                    <div class="card-title" style="font-size: 14px;">
                      ${t("channels.dingtalk.summary.checklistTitle")}
                    </div>
                    <div class="dingtalk-checklist__list">
                      ${checklist.map((item) => renderChecklistItem(item))}
                    </div>
                  </section>
                </div>

                <div class="dingtalk-section">
                  <div class="card-title" style="font-size: 14px;">
                    ${t("channels.dingtalk.detailTitle")}
                  </div>
                </div>

                <div class="dingtalk-detail__grid">
                  ${renderInfoRow(t("channels.dingtalk.fields.accountState"), selectedStateLabel)}
                  ${renderInfoRow(
                    t("channels.dingtalk.fields.enabledState"),
                    resolveEnabledLabel(selectedAccount),
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.fields.defaultAccount"),
                    isDefaultAccount ? t("common.yes") : t("common.no"),
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.fields.recentActivity"),
                    selectedActivityAt ? formatRelativeTimestamp(selectedActivityAt) : t("common.na"),
                  )}
                  ${renderInfoRow(
                    t("channels.labels.configured"),
                    formatBooleanLabel(selectedAccount.configured, { unknownAsNa: true }),
                  )}
                  ${renderInfoRow(
                    t("channels.labels.connected"),
                    formatBooleanLabel(selectedAccount.connected, { unknownAsNa: true }),
                  )}
                  ${renderInfoRow(
                    t("channels.labels.running"),
                    formatBooleanLabel(selectedAccount.running, { unknownAsNa: true }),
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.labels.credentialMode"),
                    resolveCredentialModeLabel(selectedProbe?.credentialMode),
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.labels.messageCallback"),
                    resolveCallbackValue(selectedProbe, status, selectedAccount, "message"),
                    { mono: true },
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.labels.cardCallback"),
                    resolveCallbackValue(selectedProbe, status, selectedAccount, "card"),
                    { mono: true },
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.labels.oaCallback"),
                    resolveCallbackValue(selectedProbe, status, selectedAccount, "oa"),
                    { mono: true },
                  )}
                  ${renderInfoRow(
                    t("channels.dingtalk.labels.pluginStatus"),
                    hasRuntime
                      ? t("channels.dingtalk.values.runtimeAttached")
                      : t("channels.dingtalk.values.placeholder"),
                  )}
                </div>

                ${
                  selectedAccount.lastError
                    ? html`<div class="callout danger">${selectedAccount.lastError}</div>`
                    : nothing
                }

                <div class="dingtalk-section">
                  <div class="card-title" style="font-size: 14px;">${t("channels.dingtalk.probeTitle")}</div>
                  ${
                    selectedProbe
                      ? html`
                          <div class="callout ${selectedProbe.ok ? "success" : "warn"}" style="margin-top: 12px;">
                            ${
                              selectedProbe.ok
                                ? t("channels.dingtalk.testPassed")
                                : t("channels.dingtalk.testFailed", {
                                    error:
                                      typeof selectedProbe.error === "string" &&
                                      selectedProbe.error.trim()
                                        ? selectedProbe.error
                                        : t("channels.dingtalk.values.configIncomplete"),
                                  })
                            }
                          </div>
                          <div class="dingtalk-detail__grid dingtalk-detail__grid--compact">
                            ${renderInfoRow(
                              t("channels.dingtalk.labels.testMode"),
                              selectedProbe.mode === "static"
                                ? t("channels.dingtalk.values.staticProbe")
                                : t("channels.dingtalk.values.unknown"),
                            )}
                            ${renderInfoRow(
                              t("channels.dingtalk.labels.requiredFields"),
                              missingRequired.length > 0
                                ? formatList(missingRequired)
                                : t("channels.dingtalk.values.none"),
                            )}
                            ${renderInfoRow(
                              t("channels.dingtalk.labels.optionalFields"),
                              missingOptional.length > 0
                                ? formatList(missingOptional)
                                : t("channels.dingtalk.values.none"),
                            )}
                          </div>
                          ${
                            probeNotes.length > 0
                              ? html`
                                  <div class="list" style="margin-top: 12px;">
                                    ${probeNotes.map(
                                      (note) => html`
                                        <div class="list-item">
                                          <div class="list-main">
                                            <div class="list-sub">${note}</div>
                                          </div>
                                        </div>
                                      `,
                                    )}
                                  </div>
                                `
                              : nothing
                          }
                        `
                      : html`<div class="callout info" style="margin-top: 12px;">
                          ${t("channels.dingtalk.noProbeNotice")}
                        </div>`
                  }
                </div>

                ${renderPreviewSection({
                  props,
                  accountId: selectedAccount.accountId,
                })}

                <div class="dingtalk-section">
                  <div class="card-title" style="font-size: 14px;">
                    ${t("channels.dingtalk.recentEventsTitle")}
                  </div>
                  ${renderTimeline(recentEvents)}
                </div>

                ${renderChannelLogsPanel({
                  props,
                  channelLabel: `${channelLabel} · ${selectedAccount.accountId}`,
                  logs,
                  embedded: true,
                })}

                ${renderSetupGuide()}
              </section>
            `
      }
    </section>
  `;
}

function renderMetricCard(
  label: string,
  value: string,
  options: { tone?: "ok" | "warn" | "muted" } = {},
) {
  return html`
    <div class="dingtalk-metric">
      <div class="dingtalk-metric__label">${label}</div>
      <div class="dingtalk-metric__value ${options.tone ?? "muted"}">${value}</div>
    </div>
  `;
}
