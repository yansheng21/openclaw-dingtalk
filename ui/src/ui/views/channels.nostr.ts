import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, NostrStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBooleanLabel } from "./channels.shared.ts";
import {
  renderNostrProfileForm,
  type NostrProfileFormState,
  type NostrProfileFormCallbacks,
} from "./channels.nostr-profile-form.ts";
import type { ChannelsProps } from "./channels.types.ts";

/**
 * Truncate a pubkey for display (shows first and last 8 chars)
 */
function truncatePubkey(pubkey: string | null | undefined): string {
  if (!pubkey) {
    return t("common.na");
  }
  if (pubkey.length <= 20) {
    return pubkey;
  }
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

export function renderNostrCard(params: {
  props: ChannelsProps;
  nostr?: NostrStatus | null;
  nostrAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
  selectedAccount?: ChannelAccountSnapshot | null;
  /** Profile form state (optional - if provided, shows form) */
  profileFormState?: NostrProfileFormState | null;
  /** Profile form callbacks */
  profileFormCallbacks?: NostrProfileFormCallbacks | null;
  /** Called when Edit Profile is clicked */
  onEditProfile?: () => void;
}) {
  const {
    props,
    nostr,
    nostrAccounts,
    accountCountLabel,
    selectedAccount,
    profileFormState,
    profileFormCallbacks,
    onEditProfile,
  } = params;
  const primaryAccount = selectedAccount ?? nostrAccounts[0];
  const summaryConfigured = nostr?.configured ?? primaryAccount?.configured ?? false;
  const summaryRunning = nostr?.running ?? primaryAccount?.running ?? false;
  const summaryPublicKey =
    nostr?.publicKey ?? (primaryAccount as { publicKey?: string } | undefined)?.publicKey;
  const summaryLastStartAt = nostr?.lastStartAt ?? primaryAccount?.lastStartAt ?? null;
  const summaryLastError = nostr?.lastError ?? primaryAccount?.lastError ?? null;
  const showingForm = profileFormState !== null && profileFormState !== undefined;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const publicKey = (account as { publicKey?: string }).publicKey;
    const profile = (account as { profile?: { name?: string; displayName?: string } }).profile;
    const displayName = profile?.displayName ?? profile?.name ?? account.name ?? account.accountId;

    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${displayName}</div>
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
            <span class="label">${t("channels.labels.publicKey")}</span>
            <span class="monospace" title="${publicKey ?? ""}">${truncatePubkey(publicKey)}</span>
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
                <div class="account-card-error">${account.lastError}</div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  };

  const renderProfileSection = () => {
    // If showing form, render the form instead of the read-only view
    if (showingForm && profileFormCallbacks) {
      return renderNostrProfileForm({
        state: profileFormState,
        callbacks: profileFormCallbacks,
        accountId: primaryAccount?.accountId ?? "default",
      });
    }

    const profile =
      (
        primaryAccount as
          | {
              profile?: {
                name?: string;
                displayName?: string;
                about?: string;
                picture?: string;
                nip05?: string;
              };
            }
          | undefined
      )?.profile ?? nostr?.profile;
    const { name, displayName, about, picture, nip05 } = profile ?? {};
    const hasAnyProfileData = name || displayName || about || picture || nip05;

    return html`
        <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-weight: 500;">${t("channels.nostr.profile")}</div>
          ${
            summaryConfigured
              ? html`
                <button
                  class="btn btn-sm"
                  @click=${onEditProfile}
                  style="font-size: 12px; padding: 4px 8px;"
                >
                  ${t("channels.actions.editProfile")}
                </button>
              `
              : nothing
          }
        </div>
        ${
          hasAnyProfileData
            ? html`
              <div class="status-list">
                ${
                  picture
                    ? html`
                      <div style="margin-bottom: 8px;">
                        <img
                          src=${picture}
                          alt=${t("channels.nostr.pictureAlt")}
                          style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
                          @error=${(e: Event) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    `
                    : nothing
                }
                ${name ? html`<div><span class="label">${t("channels.labels.name")}</span><span>${name}</span></div>` : nothing}
                ${
                  displayName
                    ? html`<div><span class="label">${t("channels.labels.displayName")}</span><span>${displayName}</span></div>`
                    : nothing
                }
                ${
                  about
                    ? html`<div><span class="label">${t("channels.labels.about")}</span><span style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${about}</span></div>`
                    : nothing
                }
                ${nip05 ? html`<div><span class="label">${t("channels.labels.nip05")}</span><span>${nip05}</span></div>` : nothing}
              </div>
            `
            : html`
                <div style="color: var(--text-muted); font-size: 13px">
                  ${t("channels.nostr.noProfile")}
                </div>
              `
        }
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">Nostr</div>
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
                <span>${formatBooleanLabel(summaryConfigured)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.running")}</span>
                <span>${formatBooleanLabel(summaryRunning)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.publicKey")}</span>
                <span class="monospace" title="${summaryPublicKey ?? ""}"
                  >${truncatePubkey(summaryPublicKey)}</span
                >
              </div>
              <div>
                <span class="label">${t("channels.labels.lastStart")}</span>
                <span>${summaryLastStartAt ? formatRelativeTimestamp(summaryLastStartAt) : t("common.na")}</span>
              </div>
            </div>
          `
      }

      ${
        summaryLastError
          ? html`<div class="callout danger" style="margin-top: 12px;">${summaryLastError}</div>`
          : nothing
      }

      ${renderProfileSection()}

      ${renderChannelConfigSection({ channelId: "nostr", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(false)}>
          ${t("channels.actions.refresh")}
        </button>
      </div>
    </div>
  `;
}
