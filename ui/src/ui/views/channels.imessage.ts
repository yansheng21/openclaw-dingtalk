import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, IMessageStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel, formatProbeStatusLabel } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
}) {
  const { props, imessage, accountCountLabel, selectedAccount } = params;
  const summaryConfigured = selectedAccount?.configured ?? imessage?.configured;
  const summaryRunning = selectedAccount?.running ?? imessage?.running;
  const summaryLastStartAt = selectedAccount?.lastStartAt ?? imessage?.lastStartAt;
  const summaryLastProbeAt = selectedAccount?.lastProbeAt ?? imessage?.lastProbeAt;
  const summaryLastError = selectedAccount?.lastError ?? imessage?.lastError;
  const summaryProbe =
    (selectedAccount?.probe as IMessageStatus["probe"] | undefined) ?? imessage?.probe;

  return html`
    <div class="card">
      <div class="card-title">iMessage</div>
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
          ? html`<div class="callout danger" style="margin-top: 12px;">${summaryLastError}</div>`
          : nothing
      }

      ${
        summaryProbe
          ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.actions.probe")} ${formatProbeStatusLabel(summaryProbe.ok)} ·
            ${summaryProbe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.actions.probe")}
        </button>
      </div>
    </div>
  `;
}
