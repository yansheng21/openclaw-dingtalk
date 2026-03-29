import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, DiscordStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel, formatProbeStatusLabel } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
}) {
  const { props, discord, accountCountLabel, selectedAccount } = params;
  const summaryConfigured = selectedAccount?.configured ?? discord?.configured;
  const summaryRunning = selectedAccount?.running ?? discord?.running;
  const summaryLastStartAt = selectedAccount?.lastStartAt ?? discord?.lastStartAt;
  const summaryLastProbeAt = selectedAccount?.lastProbeAt ?? discord?.lastProbeAt;
  const summaryLastError = selectedAccount?.lastError ?? discord?.lastError;
  const summaryProbe =
    (selectedAccount?.probe as DiscordStatus["probe"] | undefined) ?? discord?.probe;

  return html`
    <div class="card">
      <div class="card-title">Discord</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBooleanLabel(summaryConfigured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBooleanLabel(summaryRunning)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${summaryLastStartAt ? formatRelativeTimestamp(summaryLastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${summaryLastProbeAt ? formatRelativeTimestamp(summaryLastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${
        summaryLastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${summaryLastError}
          </div>`
          : nothing
      }

      ${
        summaryProbe
          ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.actions.probe")} ${formatProbeStatusLabel(summaryProbe.ok)} ·
            ${summaryProbe.status ?? ""} ${summaryProbe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "discord", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.actions.probe")}
        </button>
      </div>
    </div>
  `;
}
