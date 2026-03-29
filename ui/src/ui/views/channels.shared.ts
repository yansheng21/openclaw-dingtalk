import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { ChannelAccountSnapshot } from "../types.ts";
import { resolveChannelConfigValue } from "./channel-config-extras.ts";
import type { ChannelKey, ChannelsProps } from "./channels.types.ts";

export type ChannelStateLabel = "yes" | "no" | "active" | "na";

export function channelEnabled(key: ChannelKey, props: ChannelsProps) {
  const snapshot = props.snapshot;
  const channels = snapshot?.channels as Record<string, unknown> | null;
  const configValue = resolveChannelConfigValue(props.configForm, key);
  const hasConfig = Boolean(configValue && Object.keys(configValue).length > 0);
  if (!snapshot || !channels) {
    return hasConfig;
  }
  const channelStatus = channels[key] as Record<string, unknown> | undefined;
  const configured = typeof channelStatus?.configured === "boolean" && channelStatus.configured;
  const running = typeof channelStatus?.running === "boolean" && channelStatus.running;
  const connected = typeof channelStatus?.connected === "boolean" && channelStatus.connected;
  const accounts = snapshot.channelAccounts?.[key] ?? [];
  const accountActive = accounts.some(
    (account) => account.configured || account.running || account.connected,
  );
  return configured || running || connected || accountActive || hasConfig;
}

export function getChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
): number {
  return channelAccounts?.[key]?.length ?? 0;
}

export function renderChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
) {
  const count = getChannelAccountCount(key, channelAccounts);
  if (count < 2) {
    return nothing;
  }
  return html`<div class="account-count">${t("channels.generic.accounts", { count: String(count) })}</div>`;
}

export function formatBooleanLabel(
  value: boolean | null | undefined,
  options: { unknownAsNa?: boolean } = {},
): string {
  if (value == null) {
    return options.unknownAsNa ? t("common.na") : t("common.no");
  }
  return value ? t("common.yes") : t("common.no");
}

export function formatChannelStateLabel(value: ChannelStateLabel): string {
  switch (value) {
    case "yes":
      return t("common.yes");
    case "no":
      return t("common.no");
    case "active":
      return t("common.active");
    case "na":
    default:
      return t("common.na");
  }
}

export function formatProbeStatusLabel(ok: boolean): string {
  return ok ? t("channels.generic.probeOk") : t("channels.generic.probeFailed");
}
