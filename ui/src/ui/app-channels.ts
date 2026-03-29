import type { OpenClawApp } from "./app.ts";
import {
  loadChannels,
  logoutWhatsApp,
  previewDingTalkPolicy,
  startWhatsAppLogin,
  waitWhatsAppLogin,
} from "./controllers/channels.ts";
import { loadConfig, saveConfig } from "./controllers/config.ts";
import {
  channelSupportsAccountInstances,
  resolveChannelAccountSchemaTarget,
} from "./views/channels.config.ts";
import {
  cloneConfigObject,
  removePathValue,
  serializeConfigForm,
  setPathValue,
} from "./controllers/config/form-utils.ts";
import type { NostrProfile } from "./types.ts";
import { resolveChannelConfigLocation } from "./views/channel-config-extras.ts";
import { analyzeConfigSchema, type JsonSchema } from "./views/config-form.ts";
import { REDACTED_SENTINEL } from "./views/config-form.shared.ts";
import { createNostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import type {
  DingTalkAccountEditorMode,
  DingTalkAccountEditorState,
  DingTalkAccountEditorSensitiveField,
  DingTalkAccountEditorValues,
  GenericChannelAccountEditorMode,
  GenericChannelAccountEditorState,
} from "./views/channels.types.ts";

export async function handleWhatsAppStart(host: OpenClawApp, force: boolean) {
  await startWhatsAppLogin(host, force);
  await loadChannels(host, true);
}

export async function handleWhatsAppWait(host: OpenClawApp) {
  await waitWhatsAppLogin(host);
  await loadChannels(host, true);
}

export async function handleWhatsAppLogout(host: OpenClawApp) {
  await logoutWhatsApp(host);
  await loadChannels(host, true);
}

export async function handleChannelConfigSave(host: OpenClawApp): Promise<boolean> {
  if (!host.client || !host.connected) {
    return false;
  }
  await saveConfig(host);
  const saved = host.lastError == null && !host.configFormDirty;
  if (saved) {
    await loadChannels(host, true);
  }
  return saved;
}

export async function handleChannelConfigReload(host: OpenClawApp) {
  await loadConfig(host);
  await loadChannels(host, true);
}

function parseValidationErrors(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const entry of details) {
    if (typeof entry !== "string") {
      continue;
    }
    const [rawField, ...rest] = entry.split(":");
    if (!rawField || rest.length === 0) {
      continue;
    }
    const field = rawField.trim();
    const message = rest.join(":").trim();
    if (field && message) {
      errors[field] = message;
    }
  }
  return errors;
}

function resolveNostrAccountId(host: OpenClawApp): string {
  const accounts = host.channelsSnapshot?.channelAccounts?.nostr ?? [];
  return accounts[0]?.accountId ?? host.nostrProfileAccountId ?? "default";
}

function buildNostrProfileUrl(accountId: string, suffix = ""): string {
  return `/api/channels/nostr/${encodeURIComponent(accountId)}/profile${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asJsonSchema(value: unknown): JsonSchema | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonSchema;
}

function resolveNormalizedConfigSchema(schema: unknown): JsonSchema | null {
  return analyzeConfigSchema(schema).schema ?? asJsonSchema(schema);
}

function resolveEditableConfigRoot(host: OpenClawApp): Record<string, unknown> | null {
  return (host.configForm ?? host.configSnapshot?.config ?? null);
}

function channelSupportsGenericAccountEditor(host: OpenClawApp, channelId: string): boolean {
  if (channelId === "dingtalk-enterprise") {
    return false;
  }
  const schema = resolveNormalizedConfigSchema(host.configSchema);
  return channelSupportsAccountInstances(schema, channelId, resolveEditableConfigRoot(host));
}

function resolveGatewayHttpAuthHeader(host: OpenClawApp): string | null {
  const deviceToken = host.hello?.auth?.deviceToken?.trim();
  if (deviceToken) {
    return `Bearer ${deviceToken}`;
  }
  const token = host.settings.token.trim();
  if (token) {
    return `Bearer ${token}`;
  }
  const password = host.password.trim();
  if (password) {
    return `Bearer ${password}`;
  }
  return null;
}

export function buildGatewayHttpHeaders(host: OpenClawApp): Record<string, string> {
  const authorization = resolveGatewayHttpAuthHeader(host);
  return authorization ? { Authorization: authorization } : {};
}

function defaultDingTalkEditorValues(): DingTalkAccountEditorValues {
  return {
    accountId: "",
    name: "",
    enabled: true,
    appKey: "",
    appSecret: "",
    clientId: "",
    clientSecret: "",
    agentId: "",
    robotCode: "",
    tenantId: "",
    callbackBaseUrl: "",
    messageCallbackPath: "",
    cardCallbackPath: "",
    oaCallbackPath: "",
    setAsDefault: true,
    dmPolicy: "",
    groupPolicy: "",
    sessionScope: "",
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeUiAccountId(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "__default__") {
    return "default";
  }
  return trimmed.toLowerCase();
}

function resolveAccountRecord(
  accounts: Record<string, unknown>,
  accountId: string,
): Record<string, unknown> | null {
  const direct = accounts[accountId];
  if (isRecord(direct)) {
    return direct;
  }
  const normalizedTarget = normalizeUiAccountId(accountId);
  const matchedKey = Object.keys(accounts).find(
    (key) => normalizeUiAccountId(key) === normalizedTarget,
  );
  return matchedKey && isRecord(accounts[matchedKey])
    ? (accounts[matchedKey])
    : null;
}

function preserveRedactedSecrets<T>(nextValue: T, originalValue: unknown): T {
  if (originalValue === REDACTED_SENTINEL) {
    if (nextValue === "" || nextValue === undefined || nextValue === null) {
      return REDACTED_SENTINEL as T;
    }
    return nextValue;
  }

  if (Array.isArray(nextValue) && Array.isArray(originalValue)) {
    return nextValue.map((entry, index) =>
      preserveRedactedSecrets(entry, originalValue[index])) as T;
  }

  if (
    nextValue &&
    typeof nextValue === "object" &&
    !Array.isArray(nextValue) &&
    originalValue &&
    typeof originalValue === "object" &&
    !Array.isArray(originalValue)
  ) {
    const nextRecord = nextValue as Record<string, unknown>;
    const originalRecord = originalValue as Record<string, unknown>;
    const merged = cloneConfigObject(nextRecord);
    for (const key of Object.keys(originalRecord)) {
      if (!(key in merged) && originalRecord[key] !== REDACTED_SENTINEL) {
        continue;
      }
      merged[key] = preserveRedactedSecrets(merged[key], originalRecord[key]);
    }
    return merged as T;
  }

  return nextValue;
}

function extractDingTalkFields(value: Record<string, unknown> | null | undefined) {
  const source = value ?? {};
  return {
    name: readString(source.name),
    enabled: readBoolean(source.enabled, true),
    appKey: readString(source.appKey),
    appSecret: readString(source.appSecret),
    clientId: readString(source.clientId),
    clientSecret: readString(source.clientSecret),
    agentId: readString(source.agentId),
    robotCode: readString(source.robotCode),
    tenantId: readString(source.tenantId),
    callbackBaseUrl: readString(source.callbackBaseUrl),
    messageCallbackPath: readString(source.messageCallbackPath) || "/webhooks/dingtalk/messages",
    cardCallbackPath: readString(source.cardCallbackPath) || "/webhooks/dingtalk/cards/actions",
    oaCallbackPath: readString(source.oaCallbackPath) || "/webhooks/dingtalk/oa/events",
    dmPolicy: readString(source.dmPolicy),
    groupPolicy: readString(source.groupPolicy),
    sessionScope: readString(source.sessionScope),
  } satisfies Omit<DingTalkAccountEditorValues, "accountId" | "setAsDefault">;
}

function resolveDingTalkEditorState(
  host: OpenClawApp,
  mode: DingTalkAccountEditorMode,
  accountId?: string | null,
): DingTalkAccountEditorState {
  const defaults = defaultDingTalkEditorValues();
  const location = resolveChannelConfigLocation(host.configForm, "dingtalk-enterprise");
  const root = isRecord(location?.value) ? location.value : null;
  const accounts = isRecord(root?.accounts) ? (root.accounts) : {};
  const targetAccountId = accountId?.trim() || host.channelsSelectedAccountId || "default";
  const accountConfig = resolveAccountRecord(accounts, targetAccountId);
  const values =
    mode === "create"
      ? defaults
      : {
          ...defaults,
          ...extractDingTalkFields(root),
          ...extractDingTalkFields(accountConfig),
          accountId: targetAccountId,
          setAsDefault:
            readString(root?.defaultAccount) === targetAccountId ||
            (!readString(root?.defaultAccount) && targetAccountId === "default"),
        };
  if (typeof values.displayName !== "string" || !values.displayName.trim()) {
    values.displayName = readString(accountConfig?.displayName || accountConfig?.name);
  }
  return {
    mode,
    originalAccountId: mode === "edit" ? targetAccountId : null,
    values,
    saving: false,
    error: null,
    revealedSensitiveFields: {},
  };
}

function buildDingTalkAccountPayload(
  values: DingTalkAccountEditorValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    accountId: values.accountId.trim(),
    enabled: values.enabled,
    setAsDefault: values.setAsDefault,
  };
  for (const key of [
    "name",
    "appKey",
    "appSecret",
    "clientId",
    "clientSecret",
    "agentId",
    "robotCode",
    "tenantId",
    "callbackBaseUrl",
    "messageCallbackPath",
    "cardCallbackPath",
    "oaCallbackPath",
    "dmPolicy",
    "groupPolicy",
  ] as const) {
    const value = values[key].trim();
    if (value) {
      payload[key] = value;
    }
  }
  return payload;
}

function resolveGenericChannelAccountEditorState(
  host: OpenClawApp,
  channelId: string,
  mode: GenericChannelAccountEditorMode,
  accountId?: string | null,
): GenericChannelAccountEditorState {
  const configRoot = resolveEditableConfigRoot(host);
  const location = resolveChannelConfigLocation(configRoot, channelId);
  const root = isRecord(location?.value) ? location.value : {};
  const accounts = isRecord(root.accounts) ? (root.accounts) : {};
  const targetAccountId = accountId?.trim() || host.channelsSelectedAccountId || "";
  const accountConfig = resolveAccountRecord(accounts, targetAccountId) ?? {};
  const normalizedDefaultAccountId = normalizeUiAccountId(readString(root.defaultAccount));
  const normalizedTargetAccountId = normalizeUiAccountId(targetAccountId);
  const hasAccounts = Object.keys(accounts).length > 0;
  const values = cloneConfigObject(accountConfig);
  if (typeof values.displayName !== "string" || !values.displayName.trim()) {
    values.displayName = readString(accountConfig.displayName ?? accountConfig.name);
  }
  return {
    channelId,
    mode,
    originalAccountId: mode === "edit" ? targetAccountId : null,
    accountId: mode === "edit" ? targetAccountId : "",
    setAsDefault: normalizedDefaultAccountId
      ? normalizedDefaultAccountId === normalizedTargetAccountId
      : !hasAccounts || normalizedTargetAccountId === "default",
    values,
    saving: false,
    error: null,
  };
}

function assignConfigForm(host: OpenClawApp, next: Record<string, unknown>) {
  host.configForm = next;
  host.configFormDirty = true;
  if (host.configFormMode === "form") {
    host.configRaw = serializeConfigForm(next);
  }
}

export function openChannelConfigEditor(host: OpenClawApp, channelId: string) {
  host.channelConfigEditorChannelId = channelId;
}

export function closeChannelConfigEditor(host: OpenClawApp) {
  host.channelConfigEditorChannelId = null;
}

export function openChannelCreatePicker(host: OpenClawApp) {
  host.channelCreatePickerOpen = true;
}

export function closeChannelCreatePicker(host: OpenClawApp) {
  host.channelCreatePickerOpen = false;
}

export function startChannelCreate(host: OpenClawApp, channelId: string) {
  host.channelCreatePickerOpen = false;
  host.channelsSelectedId = channelId;
  host.channelsPageView = "detail";
  if (channelId === "dingtalk-enterprise") {
    host.channelsSelectedAccountId = null;
    openDingTalkAccountEditor(host, "create");
    return;
  }
  host.channelsSelectedAccountId = null;
  if (channelSupportsGenericAccountEditor(host, channelId)) {
    openGenericChannelAccountEditor(host, channelId, "create");
    return;
  }
  openChannelConfigEditor(host, channelId);
}

export function openDingTalkAccountEditor(
  host: OpenClawApp,
  mode: DingTalkAccountEditorMode,
  accountId?: string | null,
) {
  host.channelsSelectedId = "dingtalk-enterprise";
  host.channelsSelectedAccountId = accountId?.trim() || host.channelsSelectedAccountId;
  host.dingtalkAccountEditor = resolveDingTalkEditorState(host, mode, accountId);
}

export function closeDingTalkAccountEditor(host: OpenClawApp) {
  host.dingtalkAccountEditor = null;
}

export function openGenericChannelAccountEditor(
  host: OpenClawApp,
  channelId: string,
  mode: GenericChannelAccountEditorMode,
  accountId?: string | null,
) {
  host.channelsSelectedId = channelId;
  host.channelsSelectedAccountId = accountId?.trim() || host.channelsSelectedAccountId;
  host.genericChannelAccountEditor = resolveGenericChannelAccountEditorState(
    host,
    channelId,
    mode,
    accountId,
  );
}

export function closeGenericChannelAccountEditor(host: OpenClawApp) {
  host.genericChannelAccountEditor = null;
}

export function updateGenericChannelAccountEditorAccountId(host: OpenClawApp, value: string) {
  const state = host.genericChannelAccountEditor;
  if (!state) {
    return;
  }
  host.genericChannelAccountEditor = {
    ...state,
    accountId: value,
    error: null,
  };
}

export function updateGenericChannelAccountEditorDefault(host: OpenClawApp, value: boolean) {
  const state = host.genericChannelAccountEditor;
  if (!state) {
    return;
  }
  host.genericChannelAccountEditor = {
    ...state,
    setAsDefault: value,
    error: null,
  };
}

export function patchGenericChannelAccountEditor(
  host: OpenClawApp,
  path: Array<string | number>,
  value: unknown,
) {
  const state = host.genericChannelAccountEditor;
  if (!state) {
    return;
  }
  const accountKey = state.accountId.trim() || state.originalAccountId || "__new__";
  const schema = resolveNormalizedConfigSchema(host.configSchema);
  const target = resolveChannelAccountSchemaTarget(
    schema,
    state.channelId,
    resolveEditableConfigRoot(host),
    accountKey,
  );
  const basePath = target?.path ?? ["channels", state.channelId, "accounts", accountKey];
  const relativePath = path.slice(basePath.length);
  const nextValues = cloneConfigObject(state.values);
  if (relativePath.length === 0) {
    if (isRecord(value)) {
      host.genericChannelAccountEditor = {
        ...state,
        values: cloneConfigObject(value),
        error: null,
      };
    }
    return;
  }
  setPathValue(nextValues, relativePath, value);
  host.genericChannelAccountEditor = {
    ...state,
    values: nextValues,
    error: null,
  };
}

export function updateDingTalkAccountEditorField(
  host: OpenClawApp,
  field: keyof DingTalkAccountEditorValues,
  value: string | boolean,
) {
  const state = host.dingtalkAccountEditor;
  if (!state) {
    return;
  }
  host.dingtalkAccountEditor = {
    ...state,
    error: null,
    values: {
      ...state.values,
      [field]: value,
    },
  };
}

export function toggleDingTalkAccountEditorSensitiveField(
  host: OpenClawApp,
  field: DingTalkAccountEditorSensitiveField,
) {
  const state = host.dingtalkAccountEditor;
  if (!state) {
    return;
  }
  host.dingtalkAccountEditor = {
    ...state,
    revealedSensitiveFields: {
      ...state.revealedSensitiveFields,
      [field]: !(state.revealedSensitiveFields?.[field] ?? false),
    },
  };
}

export async function saveDingTalkAccountEditor(host: OpenClawApp) {
  const state = host.dingtalkAccountEditor;
  if (!state || state.saving) {
    return;
  }
  const accountId = state.values.accountId.trim();
  if (!accountId) {
    host.dingtalkAccountEditor = {
      ...state,
      error: "账号 ID 不能为空。",
    };
    return;
  }

  host.dingtalkAccountEditor = {
    ...state,
    saving: true,
    error: null,
  };

  try {
    const isEdit = state.mode === "edit" && state.originalAccountId;
    const path = isEdit
      ? `/api/admin/connectors/dingtalk/accounts/${encodeURIComponent(state.originalAccountId!)}`
      : "/api/admin/connectors/dingtalk/accounts";
    const response = await fetch(path, {
      method: isEdit ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildGatewayHttpHeaders(host),
      },
      body: JSON.stringify(buildDingTalkAccountPayload(state.values)),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      account?: { accountId?: string | null };
    } | null;
    if (!response.ok || data?.ok === false || !data) {
      host.dingtalkAccountEditor = {
        ...state,
        saving: false,
        error: data?.error ?? `保存失败 (${response.status})`,
      };
      return;
    }

    host.dingtalkAccountEditor = null;
    host.channelsSelectedAccountId = data.account?.accountId ?? accountId;
    await loadConfig(host);
    await loadChannels(host, true);
  } catch (err) {
    host.dingtalkAccountEditor = {
      ...state,
      saving: false,
      error: `保存失败: ${String(err)}`,
    };
  }
}

function pruneDingtalkConnectorLegacyChannelFields(channelValue: Record<string, unknown>) {
  const next = cloneConfigObject(channelValue);
  delete next.clientId;
  delete next.clientSecret;
  delete next.defaultAccount;
  return next;
}

export async function saveGenericChannelAccountEditor(host: OpenClawApp) {
  const state = host.genericChannelAccountEditor;
  if (!state || state.saving) {
    return;
  }
  const normalizedAccountId = state.accountId.trim();
  if (!normalizedAccountId) {
    host.genericChannelAccountEditor = {
      ...state,
      error: "实例 ID 不能为空。",
    };
    return;
  }

  const schema = resolveNormalizedConfigSchema(host.configSchema);
  const target = resolveChannelAccountSchemaTarget(
    schema,
    state.channelId,
    resolveEditableConfigRoot(host),
    normalizedAccountId,
  );
  if (!target) {
    host.genericChannelAccountEditor = {
      ...state,
      error: "当前频道暂不支持可视化实例表单，请先使用频道配置。",
    };
    return;
  }

  const baseConfig = cloneConfigObject(
    (host.configForm ?? host.configSnapshot?.config ?? {}),
  );
  const values = cloneConfigObject(state.values);
  const channelLocation = resolveChannelConfigLocation(baseConfig, state.channelId);
  const channelPath = channelLocation?.path ?? target.channelPath;
  const originalChannelValue = isRecord(channelLocation?.value) ? channelLocation.value : {};
  const channelValue =
    state.channelId === "dingtalk-connector"
      ? pruneDingtalkConnectorLegacyChannelFields(originalChannelValue)
      : originalChannelValue;
  const accounts = isRecord(channelValue.accounts)
    ? (channelValue.accounts)
    : {};
  const existing = accounts[normalizedAccountId];
  if (
    state.mode === "create" &&
    normalizedAccountId !== state.originalAccountId &&
    existing &&
    typeof existing === "object"
  ) {
    host.genericChannelAccountEditor = {
      ...state,
      error: `实例已存在: ${normalizedAccountId}`,
    };
    return;
  }
  const originalAccountConfig =
    existing && typeof existing === "object" ? (existing as Record<string, unknown>) : undefined;
  const normalizedValues = preserveRedactedSecrets(values, originalAccountConfig);
  const displayName = readString(values.displayName).trim();
  const existingName = readString(values.name).trim();
  if (displayName && !existingName) {
    normalizedValues.name = displayName;
  } else if (!displayName && existingName) {
    normalizedValues.displayName = existingName;
  }

  host.genericChannelAccountEditor = {
    ...state,
    saving: true,
    error: null,
  };

  setPathValue(baseConfig, channelPath, channelValue);
  setPathValue(baseConfig, [...channelPath, "accounts", normalizedAccountId], normalizedValues);
  if (state.channelId !== "dingtalk-connector") {
    if (state.setAsDefault) {
      setPathValue(baseConfig, [...channelPath, "defaultAccount"], normalizedAccountId);
    } else if (
      readString(channelValue.defaultAccount) === normalizedAccountId ||
      state.originalAccountId === readString(channelValue.defaultAccount)
    ) {
      removePathValue(baseConfig, [...channelPath, "defaultAccount"]);
    }
  }

  if (state.originalAccountId && state.originalAccountId !== normalizedAccountId) {
    removePathValue(baseConfig, [...channelPath, "accounts", state.originalAccountId]);
  }

  assignConfigForm(host, baseConfig);
  const saved = await handleChannelConfigSave(host);
  if (!saved) {
    host.genericChannelAccountEditor = {
      ...state,
      saving: false,
      error: host.lastError ?? "保存失败。",
    };
    return;
  }

  host.genericChannelAccountEditor = null;
  host.channelsSelectedId = state.channelId;
  host.channelsSelectedAccountId = normalizedAccountId;
}

export async function deleteDingTalkAccount(host: OpenClawApp, accountId: string) {
  const normalized = accountId.trim();
  if (!normalized) {
    return;
  }
  try {
    const response = await fetch(
      `/api/admin/connectors/dingtalk/accounts/${encodeURIComponent(normalized)}`,
      {
        method: "DELETE",
        headers: buildGatewayHttpHeaders(host),
      },
    );
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || data?.ok === false) {
      host.channelsError = data?.error ?? `删除失败 (${response.status})`;
      return;
    }
    if (host.channelsSelectedAccountId === normalized) {
      host.channelsSelectedAccountId = null;
    }
    await loadConfig(host);
    await loadChannels(host, true);
  } catch (err) {
    host.channelsError = `删除失败: ${String(err)}`;
  }
}

export async function deleteGenericChannelAccount(
  host: OpenClawApp,
  channelId: string,
  accountId: string,
) {
  const normalized = accountId.trim();
  if (!normalized) {
    return;
  }
  const schema = resolveNormalizedConfigSchema(host.configSchema);
  const target = resolveChannelAccountSchemaTarget(schema, channelId, host.configForm, normalized);
  if (!target) {
    host.channelsError = "当前频道暂不支持可视化实例删除，请先使用频道配置。";
    return;
  }

  const baseConfig = cloneConfigObject(
    (host.configForm ?? host.configSnapshot?.config ?? {}),
  );
  const channelLocation = resolveChannelConfigLocation(baseConfig, channelId);
  const channelPath = channelLocation?.path ?? target.channelPath;
  const channelValue = isRecord(channelLocation?.value) ? channelLocation.value : {};
  const accounts = isRecord(channelValue.accounts)
    ? (channelValue.accounts)
    : {};
  removePathValue(baseConfig, [...channelPath, "accounts", normalized]);
  const remainingAccountIds = Object.keys(accounts).filter((entry) => entry !== normalized);
  const currentDefault = readString(channelValue.defaultAccount);
  if (currentDefault === normalized) {
    if (remainingAccountIds.length > 0) {
      setPathValue(baseConfig, [...channelPath, "defaultAccount"], remainingAccountIds[0]);
    } else {
      removePathValue(baseConfig, [...channelPath, "defaultAccount"]);
    }
  }

  assignConfigForm(host, baseConfig);
  const saved = await handleChannelConfigSave(host);
  if (!saved) {
    host.channelsError = host.lastError ?? "删除失败。";
    return;
  }

  if (host.channelsSelectedAccountId === normalized) {
    host.channelsSelectedAccountId = null;
  }
}

export async function previewDingTalkPolicyForApp(
  host: OpenClawApp,
  accountId: string | null,
  preset: DingTalkPreviewPreset,
) {
  host.dingtalkPreviewLoading = true;
  host.dingtalkPreviewResult = null;
  try {
    const kind = presetToKind(preset);
    const body = buildPreviewBody(preset);
    const result = await previewDingTalkPolicy(host, {
      accountId,
      kind,
      body,
    });
    host.dingtalkPreviewResult = result;
  } catch (error) {
    host.channelsError = `预览失败: ${String(error)}`;
  } finally {
    host.dingtalkPreviewLoading = false;
  }
}

type DingTalkPreviewPreset = import("./views/channels.types.ts").DingTalkPreviewPreset;
type DingTalkPreviewKind = import("./controllers/channels.ts").DingTalkPreviewKind;

function presetToKind(preset: DingTalkPreviewPreset): DingTalkPreviewKind {
  switch (preset) {
    case "direct":
    case "groupMention":
      return "message";
    case "oaEvent":
      return "oa";
  }
}

function buildPreviewBody(preset: DingTalkPreviewPreset): Record<string, unknown> {
  switch (preset) {
    case "direct":
      return {
        senderStaffId: "preview_user",
        chatType: "direct",
        content: "预览消息内容",
      };
    case "groupMention":
      return {
        senderStaffId: "preview_user",
        chatType: "group",
        conversationId: "preview_group_conv",
        content: "@机器人 预览群消息",
        atUsers: ["robot_code"],
      };
    case "oaEvent":
      return {
        eventType: "oa_preview",
        processInstanceId: "preview_process",
        staffId: "preview_user",
      };
  }
}

export function handleNostrProfileEdit(
  host: OpenClawApp,
  accountId: string,
  profile: NostrProfile | null,
) {
  host.nostrProfileAccountId = accountId;
  host.nostrProfileFormState = createNostrProfileFormState(profile ?? undefined);
}

export function handleNostrProfileCancel(host: OpenClawApp) {
  host.nostrProfileFormState = null;
  host.nostrProfileAccountId = null;
}

export function handleNostrProfileFieldChange(
  host: OpenClawApp,
  field: keyof NostrProfile,
  value: string,
) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    values: {
      ...state.values,
      [field]: value,
    },
    fieldErrors: {
      ...state.fieldErrors,
      [field]: "",
    },
  };
}

export function handleNostrProfileToggleAdvanced(host: OpenClawApp) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    showAdvanced: !state.showAdvanced,
  };
}

export async function handleNostrProfileSave(host: OpenClawApp) {
  const state = host.nostrProfileFormState;
  if (!state || state.saving) {
    return;
  }
  const accountId = resolveNostrAccountId(host);

  host.nostrProfileFormState = {
    ...state,
    saving: true,
    error: null,
    success: null,
    fieldErrors: {},
  };

  try {
    const response = await fetch(buildNostrProfileUrl(accountId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...buildGatewayHttpHeaders(host),
      },
      body: JSON.stringify(state.values),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      details?: unknown;
      persisted?: boolean;
    } | null;

    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile update failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: errorMessage,
        success: null,
        fieldErrors: parseValidationErrors(data?.details),
      };
      return;
    }

    if (!data.persisted) {
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: "Profile publish failed on all relays.",
        success: null,
      };
      return;
    }

    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: null,
      success: "Profile published to relays.",
      fieldErrors: {},
      original: { ...state.values },
    };
    await loadChannels(host, true);
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: `Profile update failed: ${String(err)}`,
      success: null,
    };
  }
}

export async function handleNostrProfileImport(host: OpenClawApp) {
  const state = host.nostrProfileFormState;
  if (!state || state.importing) {
    return;
  }
  const accountId = resolveNostrAccountId(host);

  host.nostrProfileFormState = {
    ...state,
    importing: true,
    error: null,
    success: null,
  };

  try {
    const response = await fetch(buildNostrProfileUrl(accountId, "/import"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildGatewayHttpHeaders(host),
      },
      body: JSON.stringify({ autoMerge: true }),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      imported?: NostrProfile;
      merged?: NostrProfile;
      saved?: boolean;
    } | null;

    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile import failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        importing: false,
        error: errorMessage,
        success: null,
      };
      return;
    }

    const merged = data.merged ?? data.imported ?? null;
    const nextValues = merged ? { ...state.values, ...merged } : state.values;
    const showAdvanced = Boolean(
      nextValues.banner || nextValues.website || nextValues.nip05 || nextValues.lud16,
    );

    host.nostrProfileFormState = {
      ...state,
      importing: false,
      values: nextValues,
      error: null,
      success: data.saved
        ? "Profile imported from relays. Review and publish."
        : "Profile imported. Review and publish.",
      showAdvanced,
    };

    if (data.saved) {
      await loadChannels(host, true);
    }
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      importing: false,
      error: `Profile import failed: ${String(err)}`,
      success: null,
    };
  }
}
