import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel, formatProbeStatusLabel } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel, selectedAccount } = params;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("channels.labels.running")}</span>
            <span>${formatBooleanLabel(account.running)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.configured")}</span>
            <span>${formatBooleanLabel(account.configured)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.lastInbound")}</span>
            <span>
              ${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : t("common.na")}
            </span>
          </div>
          ${
            account.lastError
              ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">Telegram</div>
      ${accountCountLabel}

      ${
        selectedAccount
          ? html`
              <div class="account-card-list">
                ${renderAccountCard(selectedAccount)}
              </div>
          `
          : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">${t("channels.labels.configured")}</span>
                <span>${formatBooleanLabel(telegram?.configured)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.running")}</span>
                <span>${formatBooleanLabel(telegram?.running)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.mode")}</span>
                <span>${telegram?.mode ?? t("common.na")}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.lastStart")}</span>
                <span>${telegram?.lastStartAt ? formatRelativeTimestamp(telegram.lastStartAt) : t("common.na")}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.lastProbe")}</span>
                <span>${telegram?.lastProbeAt ? formatRelativeTimestamp(telegram.lastProbeAt) : t("common.na")}</span>
              </div>
            </div>
          `
      }

      ${
        telegram?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${telegram.lastError}
          </div>`
          : nothing
      }

      ${
        telegram?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.actions.probe")} ${formatProbeStatusLabel(telegram.probe.ok)} ·
            ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "telegram", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.actions.probe")}
        </button>
      </div>
    </div>
  `;
}
