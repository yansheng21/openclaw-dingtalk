import { mergeAccountConfig } from "openclaw/plugin-sdk/account-helpers";
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  type OpenClawConfig,
  type OpenClawPluginConfigSchema,
} from "openclaw/plugin-sdk/core";
import type {
  ApprovalLevel,
  DmPolicy,
  GroupPolicy,
  RiskTier,
  ToolClass,
} from "../../../packages/shared-types/src/index.js";

export type DingTalkCredentialMode = "appSecret" | "clientSecret" | "mixed" | "none";

export type DingTalkKnowledgeBaseSyncConfig = {
  enabled?: boolean;
  operatorId?: string;
  targetAgentId?: string;
  workspaceIds?: string[];
  maxWorkspaces?: number;
  maxNodesPerWorkspace?: number;
};

export type DingTalkEnterpriseAccountConfig = {
  enabled?: boolean;
  name?: string;
  appKey?: string;
  appSecret?: string;
  clientId?: string;
  clientSecret?: string;
  agentId?: string;
  robotCode?: string;
  tenantId?: string;
  callbackBaseUrl?: string;
  messageCallbackPath?: string;
  cardCallbackPath?: string;
  oaCallbackPath?: string;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  requireMention?: boolean;
  allowFrom?: string[];
  groupAllowFrom?: string[];
  defaultRoles?: string[];
  departmentHints?: string[];
  toolScopes?: string[];
  dataScopes?: string[];
  adminStaffIds?: string[];
  defaultRoute?: string;
  approvalLevel?: ApprovalLevel;
  riskTier?: RiskTier;
  language?: string;
  blockedToolClasses?: ToolClass[];
  knowledgeBaseSync?: DingTalkKnowledgeBaseSyncConfig;
};

export type DingTalkEnterprisePluginConfig = DingTalkEnterpriseAccountConfig & {
  defaultAccount?: string;
  accounts?: Record<string, DingTalkEnterpriseAccountConfig>;
};

export type DingTalkEnterpriseResolvedAccount = DingTalkEnterpriseAccountConfig & {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  credentialMode: DingTalkCredentialMode;
  missingRequired: string[];
  missingOptional: string[];
  callbacks: {
    baseUrl: string | null;
    message: { path: string; url: string | null };
    card: { path: string; url: string | null };
    oa: { path: string; url: string | null };
  };
};

const DINGTALK_ENTERPRISE_PLUGIN_ID = "dingtalk-enterprise";
const DEFAULT_MESSAGE_CALLBACK_PATH = "/webhooks/dingtalk/messages";
const DEFAULT_CARD_CALLBACK_PATH = "/webhooks/dingtalk/cards/actions";
const DEFAULT_OA_CALLBACK_PATH = "/webhooks/dingtalk/oa/events";
const ACCOUNT_SCOPED_CALLBACK_PATH_PREFIX = "/webhooks/dingtalk/accounts";

type DingTalkEnterpriseCallbackKind = "message" | "card" | "oa";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return entries.length > 0 ? [...new Set(entries)] : undefined;
}

function normalizeApprovalLevel(value: unknown): ApprovalLevel | undefined {
  return value === "L0" || value === "L1" || value === "L2" || value === "L3" || value === "L4"
    ? value
    : undefined;
}

function normalizeRiskTier(value: unknown): RiskTier | undefined {
  return value === "low" ||
    value === "normal" ||
    value === "elevated" ||
    value === "high" ||
    value === "critical"
    ? value
    : undefined;
}

function normalizeDmPolicy(value: unknown): DmPolicy | undefined {
  return value === "open" || value === "allowlist" || value === "pairing" || value === "disabled"
    ? value
    : undefined;
}

function normalizeGroupPolicy(value: unknown): GroupPolicy | undefined {
  return value === "open" || value === "allowlist" || value === "disabled" ? value : undefined;
}

function normalizeToolClasses(value: unknown): ToolClass[] | undefined {
  const entries = normalizeStringArray(value);
  if (!entries) {
    return undefined;
  }
  const allowed = new Set<ToolClass>([
    "chat-only",
    "read-only",
    "internal-api",
    "browser-automation",
    "host-exec",
  ]);
  const filtered = entries.filter((entry): entry is ToolClass => allowed.has(entry as ToolClass));
  return filtered.length > 0 ? filtered : undefined;
}

function normalizeKnowledgeBaseSyncConfig(
  value: unknown,
): DingTalkKnowledgeBaseSyncConfig | undefined {
  const raw = isRecord(value) ? value : {};
  const normalized: DingTalkKnowledgeBaseSyncConfig = {
    ...(typeof raw.enabled === "boolean" ? { enabled: raw.enabled } : {}),
    ...(readTrimmedString(raw.operatorId) ? { operatorId: readTrimmedString(raw.operatorId) } : {}),
    ...(readTrimmedString(raw.targetAgentId)
      ? { targetAgentId: readTrimmedString(raw.targetAgentId) }
      : {}),
    ...(normalizeStringArray(raw.workspaceIds)
      ? { workspaceIds: normalizeStringArray(raw.workspaceIds) }
      : {}),
    ...(normalizePositiveInteger(raw.maxWorkspaces)
      ? { maxWorkspaces: normalizePositiveInteger(raw.maxWorkspaces) }
      : {}),
    ...(normalizePositiveInteger(raw.maxNodesPerWorkspace)
      ? { maxNodesPerWorkspace: normalizePositiveInteger(raw.maxNodesPerWorkspace) }
      : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePath(value: unknown, fallback: string): string {
  const resolved = readTrimmedString(value) ?? fallback;
  return resolved.startsWith("/") ? resolved : `/${resolved}`;
}

function resolveLegacyCallbackPath(kind: DingTalkEnterpriseCallbackKind): string {
  switch (kind) {
    case "message":
      return DEFAULT_MESSAGE_CALLBACK_PATH;
    case "card":
      return DEFAULT_CARD_CALLBACK_PATH;
    case "oa":
      return DEFAULT_OA_CALLBACK_PATH;
  }
}

function resolveAccountScopedCallbackPath(
  accountId: string,
  kind: DingTalkEnterpriseCallbackKind,
): string {
  if (normalizeAccountId(accountId) === DEFAULT_ACCOUNT_ID) {
    return resolveLegacyCallbackPath(kind);
  }
  const normalizedAccountId = normalizeAccountId(accountId);
  switch (kind) {
    case "message":
      return `${ACCOUNT_SCOPED_CALLBACK_PATH_PREFIX}/${normalizedAccountId}/messages`;
    case "card":
      return `${ACCOUNT_SCOPED_CALLBACK_PATH_PREFIX}/${normalizedAccountId}/cards/actions`;
    case "oa":
      return `${ACCOUNT_SCOPED_CALLBACK_PATH_PREFIX}/${normalizedAccountId}/oa/events`;
  }
}

export function resolveDingTalkEnterpriseCallbackPath(params: {
  accountId: string;
  kind: DingTalkEnterpriseCallbackKind;
  configuredPath?: string | null;
}): string {
  const legacyPath = resolveLegacyCallbackPath(params.kind);
  const normalizedConfigured = readTrimmedString(params.configuredPath)
    ? normalizePath(params.configuredPath, legacyPath)
    : undefined;
  const normalizedAccountId = normalizeAccountId(params.accountId);
  if (normalizedAccountId === DEFAULT_ACCOUNT_ID) {
    return normalizedConfigured ?? legacyPath;
  }
  if (normalizedConfigured && normalizedConfigured !== legacyPath) {
    return normalizedConfigured;
  }
  return resolveAccountScopedCallbackPath(normalizedAccountId, params.kind);
}

function normalizeAccountConfig(value: unknown): DingTalkEnterpriseAccountConfig {
  const raw = isRecord(value) ? value : {};
  return {
    ...(typeof raw.enabled === "boolean" ? { enabled: raw.enabled } : {}),
    ...(readTrimmedString(raw.name) ? { name: readTrimmedString(raw.name) } : {}),
    ...(readTrimmedString(raw.appKey) ? { appKey: readTrimmedString(raw.appKey) } : {}),
    ...(readTrimmedString(raw.appSecret) ? { appSecret: readTrimmedString(raw.appSecret) } : {}),
    ...(readTrimmedString(raw.clientId) ? { clientId: readTrimmedString(raw.clientId) } : {}),
    ...(readTrimmedString(raw.clientSecret)
      ? { clientSecret: readTrimmedString(raw.clientSecret) }
      : {}),
    ...(readTrimmedString(raw.agentId) ? { agentId: readTrimmedString(raw.agentId) } : {}),
    ...(readTrimmedString(raw.robotCode) ? { robotCode: readTrimmedString(raw.robotCode) } : {}),
    ...(readTrimmedString(raw.tenantId) ? { tenantId: readTrimmedString(raw.tenantId) } : {}),
    ...(readTrimmedString(raw.callbackBaseUrl)
      ? { callbackBaseUrl: readTrimmedString(raw.callbackBaseUrl) }
      : {}),
    ...(readTrimmedString(raw.messageCallbackPath)
      ? { messageCallbackPath: normalizePath(raw.messageCallbackPath, DEFAULT_MESSAGE_CALLBACK_PATH) }
      : {}),
    ...(readTrimmedString(raw.cardCallbackPath)
      ? { cardCallbackPath: normalizePath(raw.cardCallbackPath, DEFAULT_CARD_CALLBACK_PATH) }
      : {}),
    ...(readTrimmedString(raw.oaCallbackPath)
      ? { oaCallbackPath: normalizePath(raw.oaCallbackPath, DEFAULT_OA_CALLBACK_PATH) }
      : {}),
    ...(normalizeDmPolicy(raw.dmPolicy) ? { dmPolicy: normalizeDmPolicy(raw.dmPolicy) } : {}),
    ...(normalizeGroupPolicy(raw.groupPolicy)
      ? { groupPolicy: normalizeGroupPolicy(raw.groupPolicy) }
      : {}),
    ...(typeof raw.requireMention === "boolean" ? { requireMention: raw.requireMention } : {}),
    ...(normalizeStringArray(raw.allowFrom) ? { allowFrom: normalizeStringArray(raw.allowFrom) } : {}),
    ...(normalizeStringArray(raw.groupAllowFrom)
      ? { groupAllowFrom: normalizeStringArray(raw.groupAllowFrom) }
      : {}),
    ...(normalizeStringArray(raw.defaultRoles)
      ? { defaultRoles: normalizeStringArray(raw.defaultRoles) }
      : {}),
    ...(normalizeStringArray(raw.departmentHints)
      ? { departmentHints: normalizeStringArray(raw.departmentHints) }
      : {}),
    ...(normalizeStringArray(raw.toolScopes)
      ? { toolScopes: normalizeStringArray(raw.toolScopes) }
      : {}),
    ...(normalizeStringArray(raw.dataScopes)
      ? { dataScopes: normalizeStringArray(raw.dataScopes) }
      : {}),
    ...(normalizeStringArray(raw.adminStaffIds)
      ? { adminStaffIds: normalizeStringArray(raw.adminStaffIds) }
      : {}),
    ...(readTrimmedString(raw.defaultRoute)
      ? { defaultRoute: readTrimmedString(raw.defaultRoute) }
      : {}),
    ...(normalizeApprovalLevel(raw.approvalLevel)
      ? { approvalLevel: normalizeApprovalLevel(raw.approvalLevel) }
      : {}),
    ...(normalizeRiskTier(raw.riskTier) ? { riskTier: normalizeRiskTier(raw.riskTier) } : {}),
    ...(readTrimmedString(raw.language) ? { language: readTrimmedString(raw.language) } : {}),
    ...(normalizeToolClasses(raw.blockedToolClasses)
      ? { blockedToolClasses: normalizeToolClasses(raw.blockedToolClasses) }
      : {}),
    ...(normalizeKnowledgeBaseSyncConfig(raw.knowledgeBaseSync)
      ? { knowledgeBaseSync: normalizeKnowledgeBaseSyncConfig(raw.knowledgeBaseSync) }
      : {}),
  };
}

export function normalizeDingTalkEnterpriseAccountConfig(
  value: unknown,
): DingTalkEnterpriseAccountConfig {
  return normalizeAccountConfig(value);
}

export function normalizeDingTalkKnowledgeBaseSyncConfig(
  value: unknown,
): DingTalkKnowledgeBaseSyncConfig {
  return normalizeKnowledgeBaseSyncConfig(value) ?? {};
}

function normalizeAccounts(value: unknown): Record<string, DingTalkEnterpriseAccountConfig> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value)
    .map(([accountId, config]) => [normalizeAccountId(accountId), normalizeAccountConfig(config)] as const)
    .filter(([accountId]) => Boolean(accountId));
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

export function normalizeDingTalkEnterprisePluginConfig(
  value: unknown,
): DingTalkEnterprisePluginConfig {
  const raw = isRecord(value) ? value : {};
  const base = normalizeAccountConfig(raw);
  const defaultAccount = readTrimmedString(raw.defaultAccount);
  const accounts = normalizeAccounts(raw.accounts);
  return {
    enabled: normalizeBoolean(raw.enabled) ?? true,
    ...base,
    ...(defaultAccount ? { defaultAccount: normalizeAccountId(defaultAccount) } : {}),
    ...(accounts ? { accounts } : {}),
  };
}

function mergePluginConfig(
  target: DingTalkEnterprisePluginConfig,
  source: DingTalkEnterprisePluginConfig,
): DingTalkEnterprisePluginConfig {
  const knowledgeBaseSync =
    target.knowledgeBaseSync && source.knowledgeBaseSync
      ? {
          ...target.knowledgeBaseSync,
          ...source.knowledgeBaseSync,
        }
      : source.knowledgeBaseSync ?? target.knowledgeBaseSync;
  return {
    ...target,
    ...source,
    ...(knowledgeBaseSync ? { knowledgeBaseSync } : {}),
    accounts: {
      ...(target.accounts ?? {}),
      ...(source.accounts ?? {}),
    },
  };
}

function readTopLevelPluginConfig(cfg: OpenClawConfig): unknown {
  return (cfg as Record<string, unknown>)[DINGTALK_ENTERPRISE_PLUGIN_ID];
}

function readChannelScopedConfig(cfg: OpenClawConfig): unknown {
  return isRecord(cfg.channels) ? cfg.channels[DINGTALK_ENTERPRISE_PLUGIN_ID] : undefined;
}

function readPluginEntryConfig(cfg: OpenClawConfig): unknown {
  const plugins = isRecord((cfg as { plugins?: unknown }).plugins)
    ? ((cfg as { plugins?: Record<string, unknown> }).plugins ?? {})
    : {};
  const entries = isRecord(plugins.entries) ? (plugins.entries as Record<string, unknown>) : {};
  const entry = isRecord(entries[DINGTALK_ENTERPRISE_PLUGIN_ID])
    ? (entries[DINGTALK_ENTERPRISE_PLUGIN_ID] as Record<string, unknown>)
    : {};
  return entry.config;
}

export function resolveDingTalkEnterprisePluginConfig(
  cfg: OpenClawConfig,
): DingTalkEnterprisePluginConfig {
  return [
    normalizeDingTalkEnterprisePluginConfig(readTopLevelPluginConfig(cfg)),
    normalizeDingTalkEnterprisePluginConfig(readChannelScopedConfig(cfg)),
    normalizeDingTalkEnterprisePluginConfig(readPluginEntryConfig(cfg)),
  ].reduce(mergePluginConfig, normalizeDingTalkEnterprisePluginConfig(undefined));
}

function hasBaseAccountOverrides(config: DingTalkEnterprisePluginConfig): boolean {
  return Boolean(
    config.name ||
      config.appKey ||
      config.appSecret ||
      config.clientId ||
      config.clientSecret ||
      config.agentId ||
      config.robotCode ||
      config.tenantId ||
      config.callbackBaseUrl ||
      config.messageCallbackPath ||
      config.cardCallbackPath ||
      config.oaCallbackPath ||
      config.dmPolicy ||
      config.groupPolicy ||
      typeof config.requireMention === "boolean" ||
      (config.allowFrom?.length ?? 0) > 0 ||
      (config.groupAllowFrom?.length ?? 0) > 0 ||
      (config.defaultRoles?.length ?? 0) > 0 ||
      (config.departmentHints?.length ?? 0) > 0 ||
      (config.toolScopes?.length ?? 0) > 0 ||
      (config.dataScopes?.length ?? 0) > 0 ||
      (config.adminStaffIds?.length ?? 0) > 0 ||
      config.defaultRoute ||
      config.approvalLevel ||
      config.riskTier ||
      config.language ||
      (config.blockedToolClasses?.length ?? 0) > 0 ||
      Boolean(config.knowledgeBaseSync),
  );
}

export function listDingTalkEnterpriseAccountIds(cfg: OpenClawConfig): string[] {
  const config = resolveDingTalkEnterprisePluginConfig(cfg);
  const accountIds = new Set<string>();
  if (hasBaseAccountOverrides(config) || !config.accounts || Object.keys(config.accounts).length === 0) {
    accountIds.add(DEFAULT_ACCOUNT_ID);
  }
  for (const accountId of Object.keys(config.accounts ?? {})) {
    accountIds.add(normalizeAccountId(accountId));
  }
  return [...accountIds];
}

export function resolveDefaultDingTalkEnterpriseAccountId(cfg: OpenClawConfig): string {
  const config = resolveDingTalkEnterprisePluginConfig(cfg);
  const accountIds = listDingTalkEnterpriseAccountIds(cfg);
  const preferred = config.defaultAccount ? normalizeAccountId(config.defaultAccount) : undefined;
  if (preferred && accountIds.includes(preferred)) {
    return preferred;
  }
  if (accountIds.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return accountIds[0] ?? DEFAULT_ACCOUNT_ID;
}

function stripPluginConfigMetadata(
  config: DingTalkEnterprisePluginConfig,
): DingTalkEnterpriseAccountConfig {
  const { accounts: _accounts, defaultAccount: _defaultAccount, ...rest } = config;
  return rest;
}

function resolveCredentialMode(account: DingTalkEnterpriseAccountConfig): DingTalkCredentialMode {
  const hasAppSecretPair = Boolean(account.appKey && account.appSecret);
  const hasClientSecretPair = Boolean(account.clientId && account.clientSecret);
  if (hasAppSecretPair && hasClientSecretPair) {
    return "mixed";
  }
  if (hasAppSecretPair) {
    return "appSecret";
  }
  if (hasClientSecretPair) {
    return "clientSecret";
  }
  return "none";
}

function resolveMissingRequired(account: DingTalkEnterpriseAccountConfig): string[] {
  const missing: string[] = [];
  if (!account.appKey && !account.clientId) {
    missing.push("appKey / clientId");
  }
  if (!account.appSecret && !account.clientSecret) {
    missing.push("appSecret / clientSecret");
  }
  if (!account.agentId) {
    missing.push("agentId");
  }
  return missing;
}

function resolveMissingOptional(account: DingTalkEnterpriseAccountConfig): string[] {
  const missing: string[] = [];
  if (!account.tenantId) {
    missing.push("tenantId");
  }
  if (!account.robotCode) {
    missing.push("robotCode");
  }
  if (!account.callbackBaseUrl) {
    missing.push("callbackBaseUrl");
  }
  return missing;
}

function buildCallbackUrl(baseUrl: string | undefined, callbackPath: string): string | null {
  const normalizedBase = readTrimmedString(baseUrl);
  if (!normalizedBase) {
    return null;
  }
  const base = normalizedBase.replace(/\/+$/, "");
  const path = normalizePath(callbackPath, callbackPath);
  return `${base}${path}`;
}

export function resolveDingTalkEnterpriseAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): DingTalkEnterpriseResolvedAccount {
  const pluginConfig = resolveDingTalkEnterprisePluginConfig(cfg);
  const resolvedAccountId = normalizeAccountId(
    accountId?.trim() || resolveDefaultDingTalkEnterpriseAccountId(cfg),
  );
  const baseAccount = stripPluginConfigMetadata(pluginConfig);
  const accountConfig = isRecord(pluginConfig.accounts)
    ? pluginConfig.accounts?.[resolvedAccountId]
    : undefined;
  const merged = mergeAccountConfig<DingTalkEnterpriseAccountConfig>({
    channelConfig: baseAccount,
    accountConfig,
    nestedObjectKeys: ["knowledgeBaseSync"],
  });
  const enabled = merged.enabled !== false;
  const missingRequired = resolveMissingRequired(merged);
  const messageCallbackPath = resolveDingTalkEnterpriseCallbackPath({
    accountId: resolvedAccountId,
    kind: "message",
    configuredPath: merged.messageCallbackPath,
  });
  const cardCallbackPath = resolveDingTalkEnterpriseCallbackPath({
    accountId: resolvedAccountId,
    kind: "card",
    configuredPath: merged.cardCallbackPath,
  });
  const oaCallbackPath = resolveDingTalkEnterpriseCallbackPath({
    accountId: resolvedAccountId,
    kind: "oa",
    configuredPath: merged.oaCallbackPath,
  });
  const callbacks = {
    baseUrl: merged.callbackBaseUrl ?? null,
    message: {
      path: messageCallbackPath,
      url: buildCallbackUrl(merged.callbackBaseUrl, messageCallbackPath),
    },
    card: {
      path: cardCallbackPath,
      url: buildCallbackUrl(merged.callbackBaseUrl, cardCallbackPath),
    },
    oa: {
      path: oaCallbackPath,
      url: buildCallbackUrl(merged.callbackBaseUrl, oaCallbackPath),
    },
  };
  return {
    ...merged,
    accountId: resolvedAccountId,
    enabled,
    configured: missingRequired.length === 0,
    credentialMode: resolveCredentialMode(merged),
    missingRequired,
    missingOptional: resolveMissingOptional(merged),
    callbacks,
  };
}

export const dingtalkEnterprisePluginConfigSchema: OpenClawPluginConfigSchema = {
  parse(value: unknown): DingTalkEnterprisePluginConfig {
    return normalizeDingTalkEnterprisePluginConfig(value);
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      enabled: { type: "boolean", default: true },
      name: { type: "string" },
      defaultAccount: { type: "string" },
      appKey: { type: "string" },
      appSecret: { type: "string" },
      clientId: { type: "string" },
      clientSecret: { type: "string" },
      agentId: { type: "string" },
      robotCode: { type: "string" },
      tenantId: { type: "string" },
      callbackBaseUrl: { type: "string" },
      messageCallbackPath: { type: "string", default: DEFAULT_MESSAGE_CALLBACK_PATH },
      cardCallbackPath: { type: "string", default: DEFAULT_CARD_CALLBACK_PATH },
      oaCallbackPath: { type: "string", default: DEFAULT_OA_CALLBACK_PATH },
      dmPolicy: { type: "string", enum: ["open", "allowlist", "pairing", "disabled"], default: "pairing" },
      groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"], default: "allowlist" },
      requireMention: { type: "boolean", default: true },
      allowFrom: { type: "array", items: { type: "string" } },
      groupAllowFrom: { type: "array", items: { type: "string" } },
      defaultRoles: { type: "array", items: { type: "string" } },
      departmentHints: { type: "array", items: { type: "string" } },
      toolScopes: { type: "array", items: { type: "string" } },
      dataScopes: { type: "array", items: { type: "string" } },
      adminStaffIds: { type: "array", items: { type: "string" } },
      defaultRoute: { type: "string" },
      approvalLevel: { type: "string", enum: ["L0", "L1", "L2", "L3", "L4"], default: "L1" },
      riskTier: {
        type: "string",
        enum: ["low", "normal", "elevated", "high", "critical"],
        default: "normal",
      },
      language: { type: "string", default: "zh-CN" },
      blockedToolClasses: {
        type: "array",
        items: {
          type: "string",
          enum: ["chat-only", "read-only", "internal-api", "browser-automation", "host-exec"],
        },
      },
      knowledgeBaseSync: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", default: false },
          operatorId: { type: "string" },
          targetAgentId: { type: "string" },
          workspaceIds: { type: "array", items: { type: "string" } },
          maxWorkspaces: { type: "number" },
          maxNodesPerWorkspace: { type: "number" },
        },
      },
      accounts: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            name: { type: "string" },
            appKey: { type: "string" },
            appSecret: { type: "string" },
            clientId: { type: "string" },
            clientSecret: { type: "string" },
            agentId: { type: "string" },
            robotCode: { type: "string" },
            tenantId: { type: "string" },
            callbackBaseUrl: { type: "string" },
            messageCallbackPath: { type: "string", default: DEFAULT_MESSAGE_CALLBACK_PATH },
            cardCallbackPath: { type: "string", default: DEFAULT_CARD_CALLBACK_PATH },
            oaCallbackPath: { type: "string", default: DEFAULT_OA_CALLBACK_PATH },
            dmPolicy: {
              type: "string",
              enum: ["open", "allowlist", "pairing", "disabled"],
              default: "pairing",
            },
            groupPolicy: {
              type: "string",
              enum: ["open", "allowlist", "disabled"],
              default: "allowlist",
            },
            requireMention: { type: "boolean", default: true },
            allowFrom: { type: "array", items: { type: "string" } },
            groupAllowFrom: { type: "array", items: { type: "string" } },
            defaultRoles: { type: "array", items: { type: "string" } },
            departmentHints: { type: "array", items: { type: "string" } },
            toolScopes: { type: "array", items: { type: "string" } },
            dataScopes: { type: "array", items: { type: "string" } },
            adminStaffIds: { type: "array", items: { type: "string" } },
            defaultRoute: { type: "string" },
            approvalLevel: { type: "string", enum: ["L0", "L1", "L2", "L3", "L4"], default: "L1" },
            riskTier: {
              type: "string",
              enum: ["low", "normal", "elevated", "high", "critical"],
              default: "normal",
            },
            language: { type: "string", default: "zh-CN" },
            blockedToolClasses: {
              type: "array",
              items: {
                type: "string",
                enum: ["chat-only", "read-only", "internal-api", "browser-automation", "host-exec"],
              },
            },
            knowledgeBaseSync: {
              type: "object",
              additionalProperties: false,
              properties: {
                enabled: { type: "boolean", default: false },
                operatorId: { type: "string" },
                targetAgentId: { type: "string" },
                workspaceIds: { type: "array", items: { type: "string" } },
                maxWorkspaces: { type: "number" },
                maxNodesPerWorkspace: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
  uiHints: {
    enabled: {
      label: "启用钉钉企业接入",
      help: "关闭后仍保留配置，但频道状态与测试会标记为禁用。",
    },
    name: { label: "显示名称", placeholder: "例如：总部钉钉" },
    defaultAccount: { label: "默认账号 ID", placeholder: DEFAULT_ACCOUNT_ID },
    appKey: { label: "应用 AppKey", placeholder: "dingxxxxxxxx" },
    appSecret: { label: "应用 AppSecret", sensitive: true },
    clientId: {
      label: "客户端 ID",
      help: "如你的企业应用文档使用 clientId/clientSecret 命名，可填在这里。",
    },
    clientSecret: { label: "客户端 Secret", sensitive: true },
    agentId: { label: "Agent ID", placeholder: "123456789" },
    robotCode: { label: "机器人 Code", placeholder: "dingxxxxxxxx" },
    tenantId: { label: "租户 ID", placeholder: "企业或租户标识" },
    callbackBaseUrl: {
      label: "回调基地址",
      help: "例如 https://gateway.example.com，系统会自动拼接消息、卡片和 OA 回调路径。",
      placeholder: "https://gateway.example.com",
    },
    messageCallbackPath: { label: "消息回调路径", placeholder: DEFAULT_MESSAGE_CALLBACK_PATH },
    cardCallbackPath: { label: "卡片动作回调路径", placeholder: DEFAULT_CARD_CALLBACK_PATH },
    oaCallbackPath: { label: "OA 事件回调路径", placeholder: DEFAULT_OA_CALLBACK_PATH },
    dmPolicy: {
      label: "私聊接入策略",
      help: "建议使用 pairing 或 allowlist；open 只适合临时联调，disabled 为完全关闭私聊入口。",
    },
    groupPolicy: {
      label: "群聊接入策略",
      help: "企业默认建议为 allowlist，仅允许白名单群或白名单触发者进入系统。",
    },
    requireMention: {
      label: "群聊必须 @ 机器人",
      help: "开启后，群消息只有在显式 @ 机器人时才会进入企业运行链路。",
    },
    allowFrom: {
      label: "私聊白名单",
      help: "可填写员工号、发送者 ID 或 *，用于控制谁能通过私聊触发企业助理。",
    },
    groupAllowFrom: {
      label: "群聊白名单",
      help: "可填写群 ID、群名标签、员工号或 *，用于控制哪些群或成员能进入系统。",
    },
    defaultRoles: { label: "默认角色" },
    departmentHints: { label: "默认部门" },
    toolScopes: {
      label: "工具权限范围",
      help: "例如 chat.read、oa.submit.leave、browser.open、host.exec。",
    },
    dataScopes: { label: "数据范围" },
    adminStaffIds: { label: "管理员员工号列表" },
    defaultRoute: { label: "默认 Agent 路由", placeholder: "general-agent" },
    approvalLevel: { label: "默认审批级别" },
    riskTier: { label: "默认风险等级" },
    language: { label: "默认语言", placeholder: "zh-CN" },
    blockedToolClasses: { label: "强制禁用工具类别" },
    knowledgeBaseSync: {
      label: "知识库同步",
      help: "把钉钉知识库同步到指定 Agent 工作区的 memory/dingtalk-kb 目录，供 memory_search 检索。",
    },
    "knowledgeBaseSync.enabled": { label: "启用知识库同步" },
    "knowledgeBaseSync.operatorId": {
      label: "操作人 UnionId",
      help: "知识库读取接口要求传 operatorId，建议填写具备读取权限的管理员 UnionId。",
    },
    "knowledgeBaseSync.targetAgentId": { label: "同步目标 Agent" },
    "knowledgeBaseSync.workspaceIds": {
      label: "限定知识库 ID",
      help: "留空时按当前账号可见范围同步；填写后只同步这些 workspaceId。",
    },
    "knowledgeBaseSync.maxWorkspaces": { label: "最多同步知识库数量" },
    "knowledgeBaseSync.maxNodesPerWorkspace": { label: "单个知识库最大节点数" },
    accounts: {
      label: "多账号配置",
      help: "按账号 ID 维护多套钉钉接入参数；未覆盖的字段会继承上方默认值。",
    },
    "accounts.*.name": { label: "账号名称" },
    "accounts.*.appKey": { label: "账号应用 AppKey" },
    "accounts.*.appSecret": { label: "账号应用 AppSecret", sensitive: true },
    "accounts.*.clientId": { label: "账号客户端 ID" },
    "accounts.*.clientSecret": { label: "账号客户端 Secret", sensitive: true },
    "accounts.*.agentId": { label: "账号 Agent ID" },
    "accounts.*.robotCode": { label: "账号机器人 Code" },
    "accounts.*.tenantId": { label: "账号租户 ID" },
    "accounts.*.callbackBaseUrl": { label: "账号回调基地址" },
    "accounts.*.dmPolicy": { label: "账号私聊接入策略" },
    "accounts.*.groupPolicy": { label: "账号群聊接入策略" },
    "accounts.*.requireMention": { label: "账号群聊必须 @" },
    "accounts.*.allowFrom": { label: "账号私聊白名单" },
    "accounts.*.groupAllowFrom": { label: "账号群聊白名单" },
    "accounts.*.defaultRoles": { label: "账号默认角色" },
    "accounts.*.departmentHints": { label: "账号默认部门" },
    "accounts.*.toolScopes": { label: "账号工具权限范围" },
    "accounts.*.dataScopes": { label: "账号数据范围" },
    "accounts.*.adminStaffIds": { label: "账号管理员员工号列表" },
    "accounts.*.defaultRoute": { label: "账号默认 Agent 路由" },
    "accounts.*.approvalLevel": { label: "账号默认审批级别" },
    "accounts.*.riskTier": { label: "账号默认风险等级" },
    "accounts.*.language": { label: "账号默认语言" },
    "accounts.*.blockedToolClasses": { label: "账号强制禁用工具类别" },
    "accounts.*.knowledgeBaseSync": { label: "账号知识库同步" },
    "accounts.*.knowledgeBaseSync.enabled": { label: "账号启用知识库同步" },
    "accounts.*.knowledgeBaseSync.operatorId": { label: "账号操作人 UnionId" },
    "accounts.*.knowledgeBaseSync.targetAgentId": { label: "账号同步目标 Agent" },
    "accounts.*.knowledgeBaseSync.workspaceIds": { label: "账号限定知识库 ID" },
    "accounts.*.knowledgeBaseSync.maxWorkspaces": { label: "账号最多同步知识库数量" },
    "accounts.*.knowledgeBaseSync.maxNodesPerWorkspace": { label: "账号单个知识库最大节点数" },
  },
};
