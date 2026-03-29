import { i18n } from "../../i18n/index.ts";
import { humanize } from "./config-form.shared.ts";
import { localizeConfigChoice, localizeConfigLabel } from "./config-form.i18n.ts";

export type ChannelConfigLocation = {
  path: Array<string | number>;
  value: Record<string, unknown>;
};

export function resolveChannelConfigPaths(channelId: string): Array<Array<string | number>> {
  return [
    ["channels", channelId],
    ["plugins", "entries", channelId, "config"],
    [channelId],
  ];
}

function resolveObjectAtPath(
  value: Record<string, unknown> | null | undefined,
  path: Array<string | number>,
): Record<string, unknown> | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return null;
  }
  return current as Record<string, unknown>;
}

export function resolveChannelConfigLocation(
  configForm: Record<string, unknown> | null | undefined,
  channelId: string,
): ChannelConfigLocation | null {
  if (!configForm) {
    return null;
  }
  for (const path of resolveChannelConfigPaths(channelId)) {
    const value = resolveObjectAtPath(configForm, path);
    if (value) {
      return { path, value };
    }
  }
  return null;
}

export function resolveChannelConfigValue(
  configForm: Record<string, unknown> | null | undefined,
  channelId: string,
): Record<string, unknown> | null {
  return resolveChannelConfigLocation(configForm, channelId)?.value ?? null;
}

export function formatChannelExtraValue(raw: unknown, field?: string): string {
  if (raw == null) {
    return "n/a";
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    const value = String(raw);
    return field ? localizeConfigChoice(value, field) : value;
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return "n/a";
  }
}

export function formatChannelExtraLabel(field: string): string {
  if (!i18n.getLocale().startsWith("zh")) {
    return humanize(field);
  }
  return localizeConfigLabel(humanize(field), `channels.summary.${field}`);
}

export function resolveChannelExtras(params: {
  configForm: Record<string, unknown> | null | undefined;
  channelId: string;
  fields: readonly string[];
}): Array<{ label: string; value: string }> {
  const value = resolveChannelConfigValue(params.configForm, params.channelId);
  if (!value) {
    return [];
  }
  return params.fields.flatMap((field) => {
    if (!(field in value)) {
      return [];
    }
    return [{ label: formatChannelExtraLabel(field), value: formatChannelExtraValue(value[field], field) }];
  });
}
