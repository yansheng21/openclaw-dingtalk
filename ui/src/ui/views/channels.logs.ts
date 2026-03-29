import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { LogEntry } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderChannelLogsPanel(params: {
  props: ChannelsProps;
  channelLabel: string;
  logs: LogEntry[];
  embedded?: boolean;
}) {
  const { props, channelLabel, logs, embedded = false } = params;
  const visibleLogs = logs.slice(-80);

  return html`
    <section
      id="channel-logs-panel"
      class="card channels-logs-card ${embedded ? "channels-logs-card--embedded" : ""}"
    >
      <div class="row channels-logs-card__header" style="justify-content: space-between;">
        <div class="card-title">${t("channels.logs.title")}</div>
        <div class="row" style="gap: 8px;">
          <div class="muted">${t("channels.logs.matchingCount", { count: String(logs.length) })}</div>
          <button class="btn" ?disabled=${props.logsLoading} @click=${props.onLogsRefresh}>
            ${props.logsLoading ? t("instances.loading") : t("common.refresh")}
          </button>
        </div>
      </div>

      <div class="filters channels-logs-card__toolbar">
        <label class="field checkbox">
          <span>${t("logsPage.autoFollow")}</span>
          <input
            type="checkbox"
            .checked=${props.logsAutoFollow}
            @change=${(event: Event) =>
              props.onLogsAutoFollowChange((event.target as HTMLInputElement).checked)}
          />
        </label>
      </div>

      <div class="channel-terminal">
        <div class="channel-terminal__bar">
          <div class="channel-terminal__dots" aria-hidden="true">
            <span class="channel-terminal__dot channel-terminal__dot--danger"></span>
            <span class="channel-terminal__dot channel-terminal__dot--warn"></span>
            <span class="channel-terminal__dot channel-terminal__dot--ok"></span>
          </div>
          <div class="channel-terminal__title">
            ${t("channels.logs.terminalTitle", { channel: channelLabel })}
          </div>
          <div class="channel-terminal__badge">${t("channels.logs.liveBadge")}</div>
        </div>

        ${
          props.logsFile
            ? html`
                <div class="channel-terminal__meta">
                  ${t("channels.logs.file")}: ${props.logsFile}
                </div>
              `
            : nothing
        }
        ${
          props.logsTruncated
            ? html`<div class="channel-terminal__meta">${t("channels.logs.truncated")}</div>`
            : nothing
        }
        ${
          props.logsError
            ? html`<div class="callout danger channels-logs-card__error">${props.logsError}</div>`
            : nothing
        }

        <div
          class="log-stream channel-terminal__stream"
          style=${embedded ? "min-height: 220px;" : "min-height: 260px;"}
          @scroll=${props.onLogsScroll}
        >
          ${
            visibleLogs.length === 0
              ? html`<div class="channel-terminal__empty">${t("channels.logs.noMatches")}</div>`
              : visibleLogs.map(
                  (entry) => html`
                    <div class="channel-terminal__row">
                      <div class="channel-terminal__time mono">${formatLogTime(entry.time)}</div>
                      <div class="channel-terminal__level ${entry.level ?? "info"}">${entry.level ?? "log"}</div>
                      <div class="channel-terminal__subsystem mono">${entry.subsystem ?? "gateway"}</div>
                      <div class="channel-terminal__message mono">${entry.message ?? entry.raw}</div>
                    </div>
                  `,
                )
          }
        </div>

        <div class="channel-terminal__footer">
          <span>${t("channels.logs.tailHint")}</span>
          <span>
            ${props.logsLastFetchAt
              ? formatRelativeTimestamp(props.logsLastFetchAt)
              : t("common.na")}
          </span>
        </div>
      </div>
    </section>
  `;
}

function formatLogTime(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}
