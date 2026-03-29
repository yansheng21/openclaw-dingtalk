import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, GoogleChatStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel, formatProbeStatusLabel } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
}) {
  const { props, googleChat, accountCountLabel, selectedAccount } = params;
  const summaryConfigured = selectedAccount?.configured ?? googleChat?.configured;
  const summaryRunning = selectedAccount?.running ?? googleChat?.running;
  const summaryCredential = selectedAccount?.credentialSource ?? googleChat?.credentialSource;
  const summaryAudienceType = selectedAccount?.audienceType ?? googleChat?.audienceType;
  const summaryAudience = selectedAccount?.audience ?? googleChat?.audience;
  const summaryLastStartAt = selectedAccount?.lastStartAt ?? googleChat?.lastStartAt;
  const summaryLastProbeAt = selectedAccount?.lastProbeAt ?? googleChat?.lastProbeAt;
  const summaryLastError = selectedAccount?.lastError ?? googleChat?.lastError;
  const summaryProbe =
    (selectedAccount?.probe as GoogleChatStatus["probe"] | undefined) ?? googleChat?.probe;

  return html`
    <div class="card">
      <div class="card-title">Google Chat</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBooleanLabel(summaryConfigured, { unknownAsNa: true })}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBooleanLabel(summaryRunning, { unknownAsNa: true })}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.credential")}</span>
          <span>${summaryCredential ?? t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.audience")}</span>
          <span>
            ${
              summaryAudienceType
                ? `${summaryAudienceType}${summaryAudience ? ` · ${summaryAudience}` : ""}`
                : t("common.na")
            }
          </span>
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

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.actions.probe")}
        </button>
      </div>
    </div>
  `;
}
