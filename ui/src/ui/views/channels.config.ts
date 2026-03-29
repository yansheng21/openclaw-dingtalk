import { html } from "lit";
import { t } from "../../i18n/index.ts";
import type { ConfigUiHints } from "../types.ts";
import {
  formatChannelExtraLabel,
  formatChannelExtraValue,
  resolveChannelConfigLocation,
  resolveChannelConfigPaths,
  resolveChannelConfigValue,
} from "./channel-config-extras.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { analyzeConfigSchema, renderNode, schemaType, type JsonSchema } from "./config-form.ts";

type ChannelConfigFormProps = {
  channelId: string;
  configValue: Record<string, unknown> | null;
  schema: unknown;
  uiHints: ConfigUiHints;
  disabled: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  onPatch: (path: Array<string | number>, value: unknown) => void;
};

type ChannelAccountConfigFormProps = {
  channelId: string;
  accountId: string;
  value: Record<string, unknown>;
  configValue: Record<string, unknown> | null;
  schema: unknown;
  uiHints: ConfigUiHints;
  disabled: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  onPatch: (path: Array<string | number>, value: unknown) => void;
};

export function resolveSchemaNode(
  schema: JsonSchema | null,
  path: Array<string | number>,
): JsonSchema | null {
  let current = schema;
  for (const key of path) {
    if (!current) {
      return null;
    }
    const type = schemaType(current);
    if (type === "object") {
      const properties = current.properties ?? {};
      if (typeof key === "string" && properties[key]) {
        current = properties[key];
        continue;
      }
      const additional = current.additionalProperties;
      if (typeof key === "string" && additional && typeof additional === "object") {
        current = additional;
        continue;
      }
      return null;
    }
    if (type === "array") {
      if (typeof key !== "number") {
        return null;
      }
      const items = Array.isArray(current.items) ? current.items[0] : current.items;
      current = items ?? null;
      continue;
    }
    return null;
  }
  return current;
}

function resolveChannelValue(
  config: Record<string, unknown>,
  channelId: string,
): Record<string, unknown> {
  return resolveChannelConfigValue(config, channelId) ?? {};
}

function samePath(a: Array<string | number>, b: Array<string | number>) {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

export function resolveChannelSchemaTarget(
  schema: JsonSchema | null,
  channelId: string,
  configValue: Record<string, unknown> | null,
) {
  const preferredPath = resolveChannelConfigLocation(configValue, channelId)?.path;
  const candidatePaths = resolveChannelConfigPaths(channelId);
  const orderedPaths = preferredPath
    ? [preferredPath, ...candidatePaths.filter((path) => !samePath(path, preferredPath))]
    : candidatePaths;
  for (const path of orderedPaths) {
    const node = resolveSchemaNode(schema, path);
    if (node) {
      return { node, path };
    }
  }
  return null;
}

export function resolveChannelAccountSchemaTarget(
  schema: JsonSchema | null,
  channelId: string,
  configValue: Record<string, unknown> | null,
  accountId: string,
) {
  const channelTarget = resolveChannelSchemaTarget(schema, channelId, configValue);
  if (!channelTarget) {
    return null;
  }
  const accountsNode = resolveSchemaNode(channelTarget.node, ["accounts"]);
  if (!accountsNode || schemaType(accountsNode) !== "object") {
    return null;
  }
  if (typeof accountsNode.additionalProperties === "object") {
    return {
      node: accountsNode.additionalProperties,
      channelPath: channelTarget.path,
      accountsPath: [...channelTarget.path, "accounts"],
      path: [...channelTarget.path, "accounts", accountId],
    };
  }
  if (accountsNode.additionalProperties === true) {
    return {
      node: { type: "object", additionalProperties: true },
      channelPath: channelTarget.path,
      accountsPath: [...channelTarget.path, "accounts"],
      path: [...channelTarget.path, "accounts", accountId],
    };
  }
  const defaultNode =
    (accountId && typeof accountId === "string" && accountsNode.properties?.[accountId]) ??
    accountsNode.properties?.default ??
    null;
  if (!defaultNode) {
    return null;
  }
  return {
    node: defaultNode,
    channelPath: channelTarget.path,
    accountsPath: [...channelTarget.path, "accounts"],
    path: [...channelTarget.path, "accounts", accountId],
  };
}

export function channelSupportsAccountInstances(
  schema: JsonSchema | null,
  channelId: string,
  configValue: Record<string, unknown> | null,
): boolean {
  const value = resolveChannelValue(configValue ?? {}, channelId);
  const accounts = value.accounts;
  if (accounts && typeof accounts === "object" && !Array.isArray(accounts)) {
    return true;
  }
  if (resolveChannelAccountSchemaTarget(schema, channelId, configValue, "default")) {
    return true;
  }
  return false;
}

const EXTRA_CHANNEL_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;
const INSTANCE_SECRET_FIELD_NAMES = new Set([
  "appSecret",
  "appToken",
  "botToken",
  "clientSecret",
  "signingSecret",
  "token",
  "tokenFile",
  "userToken",
  "webhookSecret",
]);
const MULTI_INSTANCE_ROOT_CREDENTIAL_FIELDS = new Set([
  "accounts",
  "defaultAccount",
  "appKey",
  "appSecret",
  "botToken",
  "clientId",
  "clientSecret",
  "messageCallbackPath",
  "cardCallbackPath",
  "oaCallbackPath",
  "robotCode",
  "signingSecret",
  "tenantId",
  "token",
  "tokenFile",
  "userToken",
  "webhookSecret",
  "appToken",
  "agentId",
  "callbackBaseUrl",
]);

function omitInstanceScopedChannelFields(
  value: Record<string, unknown>,
  options: { supportsAccounts: boolean },
): Record<string, unknown> {
  const filtered = { ...value };
  if (!options.supportsAccounts) {
    return filtered;
  }
  for (const key of MULTI_INSTANCE_ROOT_CREDENTIAL_FIELDS) {
    delete filtered[key];
  }
  return filtered;
}

function omitInstanceScopedChannelSchema(
  schema: JsonSchema,
  options: { supportsAccounts: boolean },
): JsonSchema {
  if (schemaType(schema) !== "object" || !options.supportsAccounts) {
    return schema;
  }
  const nextProperties = { ...schema.properties };
  for (const key of MULTI_INSTANCE_ROOT_CREDENTIAL_FIELDS) {
    delete nextProperties[key];
  }
  return {
    ...schema,
    properties: nextProperties,
  };
}

function normalizeInstanceAccountSchema(
  schema: JsonSchema,
  path: Array<string | number> = [],
): JsonSchema {
  const leaf = typeof path[path.length - 1] === "string" ? String(path[path.length - 1]) : "";
  if (INSTANCE_SECRET_FIELD_NAMES.has(leaf)) {
    return {
      ...schema,
      type: "string",
      anyOf: undefined,
      oneOf: undefined,
      allOf: undefined,
    };
  }
  if (schemaType(schema) !== "object") {
    return schema;
  }
  const nextProperties = schema.properties
    ? Object.fromEntries(
        Object.entries(schema.properties).map(([key, value]) => [
          key,
          normalizeInstanceAccountSchema(value, [...path, key]),
        ]),
      )
    : undefined;
  const nextAdditional =
    schema.additionalProperties && typeof schema.additionalProperties === "object"
      ? normalizeInstanceAccountSchema(schema.additionalProperties, [...path, "*"])
      : schema.additionalProperties;
  return {
    ...schema,
    properties: nextProperties,
    additionalProperties: nextAdditional,
  };
}

function countConfiguredValues(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0 ? 1 : 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return 1;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, entry) => total + countConfiguredValues(entry), 0);
  }
  if (typeof value === "object") {
    return Object.values(value).reduce((total, entry) => total + countConfiguredValues(entry), 0);
  }
  return 0;
}

function renderExtraChannelFields(value: Record<string, unknown>) {
  const entries = EXTRA_CHANNEL_FIELDS.flatMap((field) => {
    if (!(field in value)) {
      return [];
    }
    return [[field, value[field]]] as Array<[string, unknown]>;
  });
  if (entries.length === 0) {
    return null;
  }
  return html`
    <div class="status-list" style="margin-top: 12px;">
      ${entries.map(
        ([field, raw]) => html`
          <div>
            <span class="label">${formatChannelExtraLabel(field)}</span>
            <span>${formatChannelExtraValue(raw, field)}</span>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderChannelConfigForm(props: ChannelConfigFormProps) {
  const analysis = analyzeConfigSchema(props.schema);
  const normalized = analysis.schema;
  if (!normalized) {
    return html`
      <div class="callout danger">${t("channels.config.schemaUnavailable")}</div>
    `;
  }
  const target = resolveChannelSchemaTarget(normalized, props.channelId, props.configValue);
  if (!target) {
    return html`
      <div class="callout danger">${t("channels.config.channelSchemaUnavailable")}</div>
    `;
  }
  const configValue = props.configValue ?? {};
  const supportsAccounts = channelSupportsAccountInstances(normalized, props.channelId, props.configValue);
  const value = omitInstanceScopedChannelFields(resolveChannelValue(configValue, props.channelId), {
    supportsAccounts,
  });
  const channelSchema = omitInstanceScopedChannelSchema(target.node, { supportsAccounts });
  return html`
    <div class="config-form">
      ${renderNode({
        schema: channelSchema,
        value,
        path: target.path,
        hints: props.uiHints,
        unsupported: new Set(analysis.unsupportedPaths),
        disabled: props.disabled,
        showLabel: false,
        isSensitivePathRevealed: props.isSensitivePathRevealed,
        onToggleSensitivePath: props.onToggleSensitivePath,
        onPatch: props.onPatch,
      })}
    </div>
    ${renderExtraChannelFields(value)}
  `;
}

export function renderChannelAccountConfigForm(props: ChannelAccountConfigFormProps) {
  const analysis = analyzeConfigSchema(props.schema);
  const normalized = analysis.schema;
  if (!normalized) {
    return html`
      <div class="callout danger">${t("channels.config.schemaUnavailable")}</div>
    `;
  }
  const target = resolveChannelAccountSchemaTarget(
    normalized,
    props.channelId,
    props.configValue,
    props.accountId,
  );
  if (!target) {
    return html`
      <div class="callout danger">${t("channels.config.channelSchemaUnavailable")}</div>
    `;
  }
  const accountSchema = normalizeInstanceAccountSchema(target.node);
  return html`
    <div class="config-form">
      ${renderNode({
        schema: accountSchema,
        value: props.value,
        path: target.path,
        hints: props.uiHints,
        unsupported: new Set(analysis.unsupportedPaths),
        disabled: props.disabled,
        showLabel: false,
        revealSensitive: true,
        isSensitivePathRevealed: props.isSensitivePathRevealed,
        onToggleSensitivePath: props.onToggleSensitivePath,
        onPatch: props.onPatch,
      })}
    </div>
  `;
}

export function renderChannelConfigSection(params: { channelId: string; props: ChannelsProps }) {
  const { channelId, props } = params;
  const disabled = props.configSaving || props.configSchemaLoading;
  const configValue = props.configForm ?? {};
  const supportsAccounts = channelSupportsAccountInstances(
    analyzeConfigSchema(props.configSchema).schema,
    channelId,
    props.configForm,
  );
  const value = omitInstanceScopedChannelFields(resolveChannelValue(configValue, channelId), {
    supportsAccounts,
  });
  const configuredCount = countConfiguredValues(value);
  const summary = renderExtraChannelFields(value);
  return html`
    <div
      style="margin-top: 16px; padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-secondary);"
    >
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div class="card-title" style="font-size: 14px;">${t("channels.config.title")}</div>
        <div class="muted">${t("channels.config.fieldsDetected", { count: String(configuredCount) })}</div>
      </div>
      <div style="margin-top: 12px;">
        ${
          props.configSchemaLoading
            ? html`<div class="muted">${t("channels.config.loadingSchema")}</div>`
            : (summary ?? html`<div class="muted">${t("channels.config.noSummary")}</div>`)
        }
      </div>
      <details style="margin-top: 12px;">
        <summary style="cursor: pointer; font-weight: 600;">${t("channels.config.advancedToggle")}</summary>
        <div style="margin-top: 12px;">
          ${
            props.configSchemaLoading
              ? html`<div class="muted">${t("channels.config.loadingSchema")}</div>`
              : renderChannelConfigForm({
                  channelId,
                  configValue: props.configForm,
                  schema: props.configSchema,
                  uiHints: props.configUiHints,
                  disabled,
                  isSensitivePathRevealed: props.isSensitivePathRevealed,
                  onToggleSensitivePath: props.onToggleSensitivePath,
                  onPatch: props.onConfigPatch,
                })
          }
          <div class="row" style="margin-top: 12px;">
            <button
              class="btn primary"
              ?disabled=${disabled || !props.configFormDirty}
              @click=${() => props.onConfigSave()}
            >
              ${props.configSaving ? t("channels.actions.saving") : t("channels.actions.save")}
            </button>
            <button
              class="btn"
              ?disabled=${disabled}
              @click=${() => props.onConfigReload()}
            >
              ${t("channels.actions.reload")}
            </button>
          </div>
        </div>
      </details>
    </div>
  `;
}
