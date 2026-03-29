import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { ChannelAccountSnapshot, WhatsAppStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
}) {
  const { props, whatsapp, accountCountLabel, selectedAccount } = params;
  const summaryConfigured = selectedAccount?.configured ?? whatsapp?.configured;
  const summaryLinked = selectedAccount?.linked ?? whatsapp?.linked;
  const summaryRunning = selectedAccount?.running ?? whatsapp?.running;
  const summaryConnected = selectedAccount?.connected ?? whatsapp?.connected;
  const summaryLastConnectedAt = selectedAccount?.lastConnectedAt ?? whatsapp?.lastConnectedAt;
  const summaryLastMessageAt = selectedAccount?.lastInboundAt ?? whatsapp?.lastMessageAt;
  const summaryLastError = selectedAccount?.lastError ?? whatsapp?.lastError;

  return html`
    <div class="card">
      <div class="card-title">WhatsApp</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBooleanLabel(summaryConfigured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.linked")}</span>
          <span>${formatBooleanLabel(summaryLinked)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBooleanLabel(summaryRunning)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.connected")}</span>
          <span>${formatBooleanLabel(summaryConnected)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastConnect")}</span>
          <span>
            ${summaryLastConnectedAt ? formatRelativeTimestamp(summaryLastConnectedAt) : t("common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastMessage")}</span>
          <span>
            ${summaryLastMessageAt ? formatRelativeTimestamp(summaryLastMessageAt) : t("common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.authAge")}</span>
          <span>
            ${whatsapp?.authAgeMs != null ? formatDurationHuman(whatsapp.authAgeMs) : t("common.na")}
          </span>
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
        props.whatsappMessage
          ? html`<div class="callout" style="margin-top: 12px;">
            ${props.whatsappMessage}
          </div>`
          : nothing
      }

      ${
        props.whatsappQrDataUrl
          ? html`<div class="qr-wrap">
            <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
          </div>`
          : nothing
      }

      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        <button
          class="btn primary"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(false)}
        >
          ${props.whatsappBusy ? t("channels.actions.working") : t("channels.actions.showQr")}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(true)}
        >
          ${t("channels.actions.relink")}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppWait()}
        >
          ${t("channels.actions.waitForScan")}
        </button>
        <button
          class="btn danger"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppLogout()}
        >
          ${t("channels.actions.logout")}
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.actions.refresh")}
        </button>
      </div>

      ${renderChannelConfigSection({ channelId: "whatsapp", props })}
    </div>
  `;
}
