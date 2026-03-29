import type { IncomingMessage, ServerResponse } from "node:http";
import {
  readJsonBodyWithLimit,
  recordChannelActivity,
  requestBodyErrorToText,
} from "openclaw/plugin-sdk/infra-runtime";
import { normalizeAccountId, type OpenClawConfig } from "openclaw/plugin-sdk/core";
import {
  normalizeDingTalkEnterpriseAccountConfig,
  listDingTalkEnterpriseAccountIds,
  resolveDefaultDingTalkEnterpriseAccountId,
  resolveDingTalkEnterpriseAccount,
  resolveDingTalkEnterprisePluginConfig,
  type DingTalkEnterpriseAccountConfig,
  type DingTalkEnterprisePluginConfig,
  type DingTalkEnterpriseResolvedAccount,
} from "./config.js";
import { resolveRuntimeDecision, type RuntimeBridgeResult } from "../../../packages/runtime-bridge/src/index.js";
import type { EnterpriseAccessPolicy, ToolClass } from "../../../packages/shared-types/src/index.js";
import { probeDingTalkEnterpriseAccount } from "./probe.js";
import { runDingTalkEnterpriseStaticTest } from "./test-runner.js";

type HttpLogger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

type DingTalkWebhookKind = "message" | "card" | "oa";

type WebhookRouteDefinition = {
  path: string;
  kind: DingTalkWebhookKind;
  accountIdHint?: string;
};

type WebhookResponsePayload = {
  ok: true;
  accepted: true;
  channel: "dingtalk-enterprise";
  kind: DingTalkWebhookKind;
  accountId: string;
  receivedAt: number;
  staticHandler: true;
  eventType?: string | null;
  traceId?: string | null;
  challenge?: string;
  summary?: WebhookEventSummary;
  enterprise?: RuntimeBridgeResult;
};

type WebhookEventSummary = {
  messageId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  conversationId?: string | null;
  conversationTitle?: string | null;
  messageType?: string | null;
  contentPreview?: string | null;
  actionId?: string | null;
  cardInstanceId?: string | null;
  processCode?: string | null;
  result?: string | null;
};

export type DingTalkEnterpriseRuntimePreviewParams = {
  cfg: OpenClawConfig;
  kind: DingTalkWebhookKind;
  body: unknown;
  accountId?: string;
  traceId?: string | null;
  receivedAt?: number;
  requestedToolClasses?: ToolClass[];
};

const ADMIN_BASE_PATH = "/api/admin/connectors/dingtalk";
const ACCOUNTS_PATH = `${ADMIN_BASE_PATH}/accounts`;
const GROUPS_PATH = `${ADMIN_BASE_PATH}/groups`;
const DINGTALK_ENTERPRISE_PLUGIN_ID = "dingtalk-enterprise";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendMethodNotAllowed(res: ServerResponse, allow: string): void {
  res.setHeader("Allow", allow);
  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

function sendBodyReadError(res: ServerResponse, code: string, message: string): true {
  if (code === "PAYLOAD_TOO_LARGE") {
    sendJson(res, 413, { ok: false, error: requestBodyErrorToText("PAYLOAD_TOO_LARGE") });
    return true;
  }
  if (code === "REQUEST_BODY_TIMEOUT") {
    sendJson(res, 408, { ok: false, error: requestBodyErrorToText("REQUEST_BODY_TIMEOUT") });
    return true;
  }
  if (code === "CONNECTION_CLOSED") {
    sendJson(res, 400, { ok: false, error: requestBodyErrorToText("CONNECTION_CLOSED") });
    return true;
  }
  sendJson(res, 400, { ok: false, error: message });
  return true;
}

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
}

function decodePathSegment(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedStringAtPath(
  value: unknown,
  path: ReadonlyArray<string | number>,
): string | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || current.length <= segment) {
        return undefined;
      }
      current = current[segment];
      continue;
    }
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return readTrimmedString(current);
}

function readStringArrayAtPath(
  value: unknown,
  path: ReadonlyArray<string | number>,
): string[] | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || current.length <= segment) {
        return undefined;
      }
      current = current[segment];
      continue;
    }
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  if (!Array.isArray(current)) {
    return undefined;
  }
  const normalized = current
    .map((entry) => readTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
}

function pickFirstTrimmedString(
  value: unknown,
  paths: ReadonlyArray<ReadonlyArray<string | number>>,
): string | undefined {
  for (const path of paths) {
    const resolved = readTrimmedStringAtPath(value, path);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function pickFirstStringArray(
  value: unknown,
  paths: ReadonlyArray<ReadonlyArray<string | number>>,
): string[] | undefined {
  for (const path of paths) {
    const resolved = readStringArrayAtPath(value, path);
    if (resolved && resolved.length > 0) {
      return resolved;
    }
  }
  return undefined;
}

function clipPreview(value: string | undefined, maxLength = 120): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function resolveBooleanQuery(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function resolveTimeoutMs(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveChatType(kind: DingTalkWebhookKind, body: unknown): "direct" | "group" | "workflow" {
  if (kind === "oa") {
    return "workflow";
  }
  const rawType = pickFirstTrimmedString(body, [
    ["chatType"],
    ["conversationType"],
    ["conversation", "type"],
    ["sessionWebhook", "conversationType"],
  ])?.toLowerCase();
  if (rawType && ["1", "single", "direct", "dm", "private"].includes(rawType)) {
    return "direct";
  }
  if (rawType && ["2", "group", "chat", "groupchat"].includes(rawType)) {
    return "group";
  }
  const conversationId = pickFirstTrimmedString(body, [
    ["conversationId"],
    ["chatId"],
    ["openConversationId"],
  ]);
  return conversationId ? "group" : "direct";
}

function resolveMentioned(body: unknown): boolean {
  const bodyRecord = isRecord(body) ? body : null;
  const direct =
    bodyRecord?.mentioned === true ||
    bodyRecord?.isMentioned === true ||
    bodyRecord?.isInAtList === true ||
    readTrimmedStringAtPath(body, ["mentioned"]) === "true" ||
    readTrimmedStringAtPath(body, ["isMentioned"]) === "true" ||
    readTrimmedStringAtPath(body, ["isInAtList"]) === "true";
  if (direct) {
    return true;
  }
  const atUsers = bodyRecord && Array.isArray(bodyRecord.atUsers) ? bodyRecord.atUsers : [];
  const atOpenIds = bodyRecord && Array.isArray(bodyRecord.atOpenIds) ? bodyRecord.atOpenIds : [];
  return atUsers.length > 0 || atOpenIds.length > 0;
}

function resolveRequestedToolClasses(
  kind: DingTalkWebhookKind,
  preview: string | undefined,
  eventType?: string | null,
): ToolClass[] {
  const classes = new Set<ToolClass>();
  const normalized = `${eventType ?? ""} ${preview ?? ""}`.toLowerCase();

  if (kind === "oa") {
    classes.add("internal-api");
  }
  if (kind === "card") {
    classes.add("browser-automation");
  }
  if (
    normalized.includes("执行脚本") ||
    normalized.includes("运行命令") ||
    normalized.includes("shell") ||
    normalized.includes("exec")
  ) {
    classes.add("host-exec");
  }
  if (
    normalized.includes("审批") ||
    normalized.includes("流程") ||
    normalized.includes("报销") ||
    normalized.includes("请假") ||
    normalized.includes("process")
  ) {
    classes.add("internal-api");
  }
  if (
    normalized.includes("审批") ||
    normalized.includes("提交") ||
    normalized.includes("创建") ||
    normalized.includes("更新") ||
    normalized.includes("发送")
  ) {
    classes.add("internal-api");
  }
  if (
    normalized.includes("浏览器") ||
    normalized.includes("打开网页") ||
    normalized.includes("点击") ||
    normalized.includes("login") ||
    normalized.includes("form")
  ) {
    classes.add("browser-automation");
  }
  if (
    normalized.includes("查询") ||
    normalized.includes("读取") ||
    normalized.includes("日志") ||
    normalized.includes("详情") ||
    normalized.includes("报表")
  ) {
    classes.add("read-only");
  }
  if (classes.size === 0) {
    classes.add("chat-only");
  }
  return [...classes];
}

function resolveEnterprisePolicy(account: DingTalkEnterpriseResolvedAccount): EnterpriseAccessPolicy {
  return {
    dmPolicy: account.dmPolicy,
    groupPolicy: account.groupPolicy,
    requireMention: account.requireMention,
    allowFrom: account.allowFrom,
    groupAllowFrom: account.groupAllowFrom,
    defaultRoles: account.defaultRoles,
    departmentHints: account.departmentHints,
    toolScopes: account.toolScopes,
    dataScopes: account.dataScopes,
    adminStaffIds: account.adminStaffIds,
    defaultRoute: account.defaultRoute,
    approvalLevel: account.approvalLevel,
    riskTier: account.riskTier,
    language: account.language,
    blockedToolClasses: account.blockedToolClasses,
  };
}

function buildAccountSummary(
  account: DingTalkEnterpriseResolvedAccount,
  probe?: Awaited<ReturnType<typeof probeDingTalkEnterpriseAccount>>,
) {
  return {
    accountId: account.accountId,
    name: account.name ?? null,
    enabled: account.enabled,
    configured: account.configured,
    credentialMode: account.credentialMode,
    callbackBaseUrl: account.callbacks.baseUrl,
    messageCallbackPath: account.callbacks.message.path,
    messageCallbackUrl: account.callbacks.message.url,
    cardCallbackPath: account.callbacks.card.path,
    cardCallbackUrl: account.callbacks.card.url,
    oaCallbackPath: account.callbacks.oa.path,
    oaCallbackUrl: account.callbacks.oa.url,
    dmPolicy: account.dmPolicy ?? "pairing",
    groupPolicy: account.groupPolicy ?? "allowlist",
    requireMention: account.requireMention ?? true,
    allowFrom: account.allowFrom ?? [],
    groupAllowFrom: account.groupAllowFrom ?? [],
    defaultRoles: account.defaultRoles ?? [],
    departmentHints: account.departmentHints ?? [],
    toolScopes: account.toolScopes ?? [],
    dataScopes: account.dataScopes ?? [],
    adminStaffIds: account.adminStaffIds ?? [],
    defaultRoute: account.defaultRoute ?? "general-agent",
    approvalLevel: account.approvalLevel ?? "L1",
    riskTier: account.riskTier ?? "normal",
    language: account.language ?? "zh-CN",
    blockedToolClasses: account.blockedToolClasses ?? [],
    missingRequired: account.missingRequired,
    missingOptional: account.missingOptional,
    ...(probe ? { probe } : {}),
  };
}

function resolveAdminTestAccountId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/admin\/connectors\/dingtalk\/accounts\/([^/]+)\/test\/?$/);
  if (!match) {
    return null;
  }
  return decodePathSegment(match[1]);
}

function resolveAdminAccountId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/admin\/connectors\/dingtalk\/accounts\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }
  return decodePathSegment(match[1]);
}

function resolveWebhookRequestAccountId(params: {
  req: IncomingMessage;
  url: URL;
  body: unknown;
  fallbackAccountId?: string;
}): string {
  const queryAccountId = readTrimmedString(params.url.searchParams.get("accountId"));
  const headerAccountId = readTrimmedString(params.req.headers["x-openclaw-account-id"]);
  const bodyRecord = isRecord(params.body) ? params.body : null;
  const bodyAccountId =
    readTrimmedString(bodyRecord?.accountId) ??
    readTrimmedString(bodyRecord?.dingtalkAccountId) ??
    readTrimmedString(bodyRecord?.connectorAccountId);
  return normalizeAccountId(
    queryAccountId ?? headerAccountId ?? bodyAccountId ?? params.fallbackAccountId,
  );
}

function resolveEventType(body: unknown): string | null {
  const bodyRecord = isRecord(body) ? body : null;
  return (
    readTrimmedString(bodyRecord?.eventType) ??
    readTrimmedString(bodyRecord?.EventType) ??
    readTrimmedString(bodyRecord?.type) ??
    (isRecord(bodyRecord?.header)
      ? readTrimmedString((bodyRecord.header as Record<string, unknown>).eventType)
      : undefined) ??
    null
  );
}

function resolveTraceId(req: IncomingMessage, body: unknown): string | null {
  const bodyRecord = isRecord(body) ? body : null;
  const requestId = req.headers["x-request-id"];
  return (
    readTrimmedString(Array.isArray(requestId) ? requestId[0] : requestId) ??
    readTrimmedString(bodyRecord?.traceId) ??
    readTrimmedString(bodyRecord?.eventId) ??
    readTrimmedString(bodyRecord?.EventId) ??
    readTrimmedString(bodyRecord?.msgId) ??
    null
  );
}

function resolveWebhookChallenge(body: unknown): string | undefined {
  const bodyRecord = isRecord(body) ? body : null;
  return readTrimmedString(bodyRecord?.challenge);
}

function resolveWebhookSummary(
  kind: DingTalkWebhookKind,
  body: unknown,
  traceId: string | null,
): WebhookEventSummary | undefined {
  const messageId =
    pickFirstTrimmedString(body, [
      ["msgId"],
      ["messageId"],
      ["EventId"],
      ["eventId"],
    ]) ?? traceId ?? undefined;
  const senderId = pickFirstTrimmedString(body, [
    ["senderStaffId"],
    ["staffId"],
    ["senderId"],
    ["operatorStaffId"],
    ["userId"],
  ]);
  const senderName = pickFirstTrimmedString(body, [
    ["senderNick"],
    ["senderName"],
    ["operatorName"],
    ["userName"],
  ]);
  const conversationId = pickFirstTrimmedString(body, [
    ["conversationId"],
    ["chatId"],
    ["openConversationId"],
    ["conversation", "id"],
  ]);
  const conversationTitle = pickFirstTrimmedString(body, [
    ["conversationTitle"],
    ["conversation", "title"],
    ["chatbotTitle"],
    ["title"],
  ]);
  const messageType = pickFirstTrimmedString(body, [
    ["msgtype"],
    ["msgType"],
    ["messageType"],
    ["type"],
  ]);
  const contentPreview = clipPreview(
    pickFirstTrimmedString(body, [
      ["text", "content"],
      ["content", "text"],
      ["content"],
      ["msgContent"],
      ["title"],
      ["remark"],
    ]),
  );
  const actionId = pickFirstTrimmedString(body, [
    ["actionId"],
    ["actionIds", 0],
    ["action", "id"],
  ]);
  const cardInstanceId = pickFirstTrimmedString(body, [
    ["cardInstanceId"],
    ["cardData", "cardInstanceId"],
    ["card", "instanceId"],
  ]);
  const processCode = pickFirstTrimmedString(body, [
    ["processCode"],
    ["processInstance", "processCode"],
    ["bizCategory"],
  ]);
  const result = pickFirstTrimmedString(body, [
    ["result"],
    ["status"],
    ["eventStatus"],
  ]);

  const summary: WebhookEventSummary = {
    ...(messageId ? { messageId } : {}),
    ...(senderId ? { senderId } : {}),
    ...(senderName ? { senderName } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(conversationTitle ? { conversationTitle } : {}),
    ...(messageType ? { messageType } : {}),
    ...(contentPreview ? { contentPreview } : {}),
    ...(actionId ? { actionId } : {}),
    ...(cardInstanceId ? { cardInstanceId } : {}),
    ...(processCode ? { processCode } : {}),
    ...(result ? { result } : {}),
  };

  if (Object.keys(summary).length === 0) {
    return undefined;
  }

  if (kind === "card") {
    delete summary.messageType;
  }
  return summary;
}

export function previewDingTalkEnterpriseRuntime(
  params: DingTalkEnterpriseRuntimePreviewParams,
): RuntimeBridgeResult {
  const account = resolveDingTalkEnterpriseAccount(params.cfg, params.accountId);
  const bodyRecord = isRecord(params.body) ? params.body : null;
  const traceId =
    params.traceId ??
    readTrimmedString(bodyRecord?.traceId) ??
    readTrimmedString(bodyRecord?.eventId) ??
    readTrimmedString(bodyRecord?.EventId) ??
    readTrimmedString(bodyRecord?.msgId) ??
    null;
  const summary = resolveWebhookSummary(params.kind, params.body, traceId);
  const receivedAt = params.receivedAt ?? Date.now();
  const staffId =
    pickFirstTrimmedString(params.body, [
      ["senderStaffId"],
      ["staffId"],
      ["operatorStaffId"],
      ["userId"],
    ]) ??
    summary?.senderId ??
    null;
  const eventType = resolveEventType(params.body);
  return resolveRuntimeDecision({
    ingress: {
      channel: "dingtalk-enterprise",
      accountId: account.accountId,
      webhookKind: params.kind,
      eventType,
      traceId,
      messageId: summary?.messageId ?? null,
      senderId: summary?.senderId ?? null,
      staffId,
      senderName: summary?.senderName ?? null,
      conversationId: summary?.conversationId ?? null,
      conversationTitle: summary?.conversationTitle ?? null,
      senderRoles: pickFirstStringArray(params.body, [
        ["senderRoles"],
        ["sender", "roles"],
        ["roles"],
      ]),
      senderDepartments: pickFirstStringArray(params.body, [
        ["senderDepartments"],
        ["senderDepartmentNames"],
        ["sender", "departments"],
        ["departments"],
      ]),
      groupTags: pickFirstStringArray(params.body, [["groupTags"], ["conversation", "tags"], ["tags"]]),
      chatType: resolveChatType(params.kind, params.body),
      mentioned: resolveMentioned(params.body),
      contentPreview: summary?.contentPreview ?? null,
      language:
        pickFirstTrimmedString(params.body, [["language"], ["lang"], ["locale"]]) ??
        account.language ??
        "zh-CN",
      receivedAt,
      metadata: {
        eventType,
        summary,
      },
    },
    policy: resolveEnterprisePolicy(account),
    requestedToolClasses:
      params.requestedToolClasses ??
      resolveRequestedToolClasses(params.kind, summary?.contentPreview ?? undefined, eventType),
    action: `dingtalk-enterprise.${params.kind}.ingress`,
  });
}

async function readWebhookBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | null> {
  const parsed = await readJsonBodyWithLimit(req, {
    maxBytes: 256 * 1024,
    timeoutMs: 10_000,
  });
  if (!parsed.ok) {
    sendBodyReadError(res, parsed.code, parsed.error);
    return null;
  }
  return parsed.value;
}

async function readAdminBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | null> {
  const parsed = await readJsonBodyWithLimit(req, {
    maxBytes: 256 * 1024,
    timeoutMs: 10_000,
  });
  if (!parsed.ok) {
    sendBodyReadError(res, parsed.code, parsed.error);
    return null;
  }
  return parsed.value;
}

async function handleListAccounts(
  req: IncomingMessage,
  res: ServerResponse,
  cfg: OpenClawConfig,
): Promise<true> {
  const url = parseUrl(req);
  const includeProbe = resolveBooleanQuery(url.searchParams.get("probe"));
  const timeoutMs = resolveTimeoutMs(url.searchParams.get("timeoutMs")) ?? 8_000;
  const accountIds = listDingTalkEnterpriseAccountIds(cfg);
  const accounts: Array<ReturnType<typeof buildAccountSummary>> = [];
  for (const accountId of accountIds) {
    const account = resolveDingTalkEnterpriseAccount(cfg, accountId);
    const probe = includeProbe
      ? await probeDingTalkEnterpriseAccount(account, timeoutMs)
      : undefined;
    accounts.push(buildAccountSummary(account, probe));
  }

  sendJson(res, 200, {
    ok: true,
    channel: "dingtalk-enterprise",
    staticProbeOnly: true,
    defaultAccountId: resolveDefaultDingTalkEnterpriseAccountId(cfg),
    accounts,
  });
  return true;
}

async function handleTestAccount(params: {
  req: IncomingMessage;
  res: ServerResponse;
  cfg: OpenClawConfig;
  logger?: HttpLogger;
}): Promise<true> {
  const url = parseUrl(params.req);
  const accountId = resolveAdminTestAccountId(url.pathname);
  if (!accountId) {
    sendJson(params.res, 404, { ok: false, error: "Account test route not found" });
    return true;
  }
  const result = await runDingTalkEnterpriseStaticTest({
    cfg: params.cfg,
    accountId,
    timeoutMs: resolveTimeoutMs(url.searchParams.get("timeoutMs")),
    logger: params.logger,
  });
  sendJson(params.res, 200, { ok: true, ...result });
  return true;
}

function resolveBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function clonePluginConfigForWrite(cfg: OpenClawConfig): DingTalkEnterprisePluginConfig {
  const resolved = resolveDingTalkEnterprisePluginConfig(cfg);
  return {
    ...resolved,
    ...(resolved.accounts ? { accounts: { ...resolved.accounts } } : { accounts: {} }),
  };
}

function resolveAccountWriteBody(raw: unknown): {
  account: DingTalkEnterpriseAccountConfig;
  accountId?: string;
  setAsDefault?: boolean;
} | null {
  if (!isRecord(raw)) {
    return null;
  }
  const account = normalizeDingTalkEnterpriseAccountConfig(raw);
  const accountId = readTrimmedString(raw.accountId);
  const setAsDefault =
    resolveBooleanFlag(raw.defaultAccount) ?? resolveBooleanFlag(raw.setAsDefault);
  return {
    account,
    ...(accountId ? { accountId } : {}),
    ...(typeof setAsDefault === "boolean" ? { setAsDefault } : {}),
  };
}

function buildNextConfigWithSavedAccount(params: {
  cfg: OpenClawConfig;
  accountId: string;
  account: DingTalkEnterpriseAccountConfig;
  replaceExisting: boolean;
  setAsDefault?: boolean;
}): OpenClawConfig {
  const writable = clonePluginConfigForWrite(params.cfg);
  const previous = writable.accounts?.[params.accountId] ?? {};
  const nextAccount = params.replaceExisting ? params.account : { ...previous, ...params.account };
  writable.accounts = {
    ...(writable.accounts ?? {}),
    [params.accountId]: nextAccount,
  };
  if (params.setAsDefault === true || !writable.defaultAccount) {
    writable.defaultAccount = params.accountId;
  }

  const existingPlugins = isRecord(params.cfg.plugins) ? params.cfg.plugins : {};
  const existingEntries = isRecord(existingPlugins.entries) ? existingPlugins.entries : {};
  const existingEntry = isRecord(existingEntries[DINGTALK_ENTERPRISE_PLUGIN_ID])
    ? existingEntries[DINGTALK_ENTERPRISE_PLUGIN_ID]
    : {};
  const nextAllow =
    Array.isArray(existingPlugins.allow) && existingPlugins.allow.length > 0
      ? [...new Set([...existingPlugins.allow, DINGTALK_ENTERPRISE_PLUGIN_ID])]
      : existingPlugins.allow;

  return {
    ...params.cfg,
    plugins: {
      ...existingPlugins,
      ...(Array.isArray(nextAllow) ? { allow: nextAllow } : {}),
      entries: {
        ...existingEntries,
        [DINGTALK_ENTERPRISE_PLUGIN_ID]: {
          ...existingEntry,
          enabled: true,
          config: writable,
        },
      },
    },
  };
}

function buildNextConfigWithoutAccount(params: {
  cfg: OpenClawConfig;
  accountId: string;
}): OpenClawConfig | null {
  const writable = clonePluginConfigForWrite(params.cfg);
  if (!writable.accounts || !Object.hasOwn(writable.accounts, params.accountId)) {
    return null;
  }
  const nextAccounts = { ...(writable.accounts ?? {}) };
  delete nextAccounts[params.accountId];
  if (Object.keys(nextAccounts).length > 0) {
    writable.accounts = nextAccounts;
  } else {
    delete writable.accounts;
  }
  if (writable.defaultAccount === params.accountId) {
    const nextDefault = Object.keys(nextAccounts)[0];
    if (nextDefault) {
      writable.defaultAccount = nextDefault;
    } else {
      delete writable.defaultAccount;
    }
  }

  const existingPlugins = isRecord(params.cfg.plugins) ? params.cfg.plugins : {};
  const existingEntries = isRecord(existingPlugins.entries) ? existingPlugins.entries : {};
  const existingEntry = isRecord(existingEntries[DINGTALK_ENTERPRISE_PLUGIN_ID])
    ? existingEntries[DINGTALK_ENTERPRISE_PLUGIN_ID]
    : {};

  return {
    ...params.cfg,
    plugins: {
      ...existingPlugins,
      entries: {
        ...existingEntries,
        [DINGTALK_ENTERPRISE_PLUGIN_ID]: {
          ...existingEntry,
          enabled: true,
          config: writable,
        },
      },
    },
  };
}

async function handleSaveAccount(params: {
  req: IncomingMessage;
  res: ServerResponse;
  cfg: OpenClawConfig;
  writeConfig?: (nextConfig: OpenClawConfig) => Promise<void>;
  syncWebhookRoutes?: (nextConfig: OpenClawConfig) => Promise<void> | void;
}): Promise<true> {
  if (!params.writeConfig) {
    sendJson(params.res, 503, { ok: false, error: "Config write is not available" });
    return true;
  }

  const url = parseUrl(params.req);
  const body = await readAdminBody(params.req, params.res);
  if (body == null) {
    return true;
  }
  const payload = resolveAccountWriteBody(body);
  if (!payload) {
    sendJson(params.res, 400, { ok: false, error: "Expected a JSON object body" });
    return true;
  }

  const routeAccountId = resolveAdminAccountId(url.pathname);
  const accountId = normalizeAccountId(routeAccountId ?? payload.accountId);
  const replaceExisting = params.req.method === "PUT";
  const nextConfig = buildNextConfigWithSavedAccount({
    cfg: params.cfg,
    accountId,
    account: payload.account,
    replaceExisting,
    setAsDefault: payload.setAsDefault,
  });

  await params.writeConfig(nextConfig);
  await params.syncWebhookRoutes?.(nextConfig);
  const savedAccount = resolveDingTalkEnterpriseAccount(nextConfig, accountId);
  sendJson(params.res, 200, {
    ok: true,
    saved: true,
    channel: "dingtalk-enterprise",
    account: buildAccountSummary(savedAccount),
    defaultAccountId: resolveDefaultDingTalkEnterpriseAccountId(nextConfig),
    configLocation: `plugins.entries.${DINGTALK_ENTERPRISE_PLUGIN_ID}.config`,
  });
  return true;
}

async function handleDeleteAccount(params: {
  req: IncomingMessage;
  res: ServerResponse;
  cfg: OpenClawConfig;
  writeConfig?: (nextConfig: OpenClawConfig) => Promise<void>;
  syncWebhookRoutes?: (nextConfig: OpenClawConfig) => Promise<void> | void;
}): Promise<true> {
  if (!params.writeConfig) {
    sendJson(params.res, 503, { ok: false, error: "Config write is not available" });
    return true;
  }
  const url = parseUrl(params.req);
  const accountId = resolveAdminAccountId(url.pathname);
  if (!accountId) {
    sendJson(params.res, 404, { ok: false, error: "Account route not found" });
    return true;
  }
  const nextConfig = buildNextConfigWithoutAccount({
    cfg: params.cfg,
    accountId: normalizeAccountId(accountId),
  });
  if (!nextConfig) {
    sendJson(params.res, 404, { ok: false, error: "Account not found" });
    return true;
  }
  await params.writeConfig(nextConfig);
  await params.syncWebhookRoutes?.(nextConfig);
  sendJson(params.res, 200, {
    ok: true,
    deleted: true,
    accountId: normalizeAccountId(accountId),
    defaultAccountId: resolveDefaultDingTalkEnterpriseAccountId(nextConfig),
  });
  return true;
}

function handleGroups(res: ServerResponse): true {
  sendJson(res, 200, {
    ok: true,
    channel: "dingtalk-enterprise",
    staticProbeOnly: true,
    groups: [],
    note: "当前版本尚未实现钉钉群发现，先返回空列表占位。",
  });
  return true;
}

export function createDingTalkEnterpriseAdminHttpHandler(params: {
  loadConfig: () => OpenClawConfig;
  writeConfig?: (nextConfig: OpenClawConfig) => Promise<void>;
  syncWebhookRoutes?: (nextConfig: OpenClawConfig) => Promise<void> | void;
  logger?: HttpLogger;
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async (req, res) => {
    const url = parseUrl(req);
    if (!url.pathname.startsWith(ADMIN_BASE_PATH)) {
      return false;
    }

    const cfg = params.loadConfig();
    try {
      if (url.pathname === ACCOUNTS_PATH) {
        if (req.method === "GET") {
          return await handleListAccounts(req, res, cfg);
        }
        if (req.method !== "POST") {
          sendMethodNotAllowed(res, "GET, POST");
          return true;
        }
      }

      if (resolveAdminTestAccountId(url.pathname)) {
        if (req.method !== "POST") {
          sendMethodNotAllowed(res, "POST");
          return true;
        }
        return await handleTestAccount({
          req,
          res,
          cfg,
          logger: params.logger,
        });
      }

      const accountId = resolveAdminAccountId(url.pathname);
      if ((url.pathname === ACCOUNTS_PATH && req.method === "POST") || accountId) {
        if (url.pathname === ACCOUNTS_PATH) {
          if (req.method !== "POST") {
            sendMethodNotAllowed(res, "GET, POST");
            return true;
          }
        } else if (!accountId || !["PATCH", "PUT", "DELETE"].includes(req.method ?? "")) {
          sendMethodNotAllowed(res, "PATCH, PUT, DELETE");
          return true;
        }
        if (req.method === "DELETE") {
          return await handleDeleteAccount({
            req,
            res,
            cfg,
            writeConfig: params.writeConfig,
            syncWebhookRoutes: params.syncWebhookRoutes,
          });
        }
        return await handleSaveAccount({
          req,
          res,
          cfg,
          writeConfig: params.writeConfig,
          syncWebhookRoutes: params.syncWebhookRoutes,
        });
      }

      if (url.pathname === GROUPS_PATH) {
        if (req.method !== "GET") {
          sendMethodNotAllowed(res, "GET");
          return true;
        }
        return handleGroups(res);
      }

      return false;
    } catch (error) {
      params.logger?.error?.("dingtalk-enterprise: 管理接口处理失败", {
        error: error instanceof Error ? error.message : String(error),
        path: url.pathname,
      });
      sendJson(res, 500, { ok: false, error: "Internal server error" });
      return true;
    }
  };
}

async function handleWebhookRequest(params: {
  req: IncomingMessage;
  res: ServerResponse;
  kind: DingTalkWebhookKind;
  accountIdHint?: string;
  logger?: HttpLogger;
  loadConfig?: () => OpenClawConfig;
}): Promise<true> {
  if (params.req.method !== "POST") {
    sendMethodNotAllowed(params.res, "POST");
    return true;
  }

  const url = parseUrl(params.req);
  const body = await readWebhookBody(params.req, params.res);
  if (body == null) {
    return true;
  }

  const accountId = resolveWebhookRequestAccountId({
    req: params.req,
    url,
    body,
    fallbackAccountId: params.accountIdHint,
  });
  const eventType = resolveEventType(body);
  const traceId = resolveTraceId(params.req, body);
  const challenge = resolveWebhookChallenge(body);
  const summary = resolveWebhookSummary(params.kind, body, traceId);
  const enterprise = params.loadConfig
    ? previewDingTalkEnterpriseRuntime({
        cfg: params.loadConfig(),
        kind: params.kind,
        body,
        accountId,
        traceId,
      })
    : undefined;

  recordChannelActivity({
    channel: "dingtalk-enterprise",
    accountId,
    direction: "inbound",
  });

  params.logger?.info?.(`dingtalk-enterprise: webhook ${params.kind} received`, {
    accountId,
    eventType,
    traceId,
    path: url.pathname,
    staticHandler: true,
    summary,
    enterprise: enterprise
      ? {
          accepted: enterprise.accepted,
          route: enterprise.route.route,
          routeReason: enterprise.route.reason,
          approvalRequired: enterprise.approval.required,
          approvalLevel: enterprise.approval.level,
          auditOutcome: enterprise.auditEvent.outcome,
        }
      : undefined,
  });

  const payload: WebhookResponsePayload = {
    ok: true,
    accepted: true,
    channel: "dingtalk-enterprise",
    kind: params.kind,
    accountId,
    receivedAt: Date.now(),
    staticHandler: true,
    eventType,
    traceId,
    ...(challenge ? { challenge } : {}),
    ...(summary ? { summary } : {}),
    ...(enterprise ? { enterprise } : {}),
  };

  sendJson(params.res, 200, payload);
  return true;
}

export function createDingTalkEnterpriseWebhookHttpHandler(params: {
  logger?: HttpLogger;
  route: WebhookRouteDefinition;
  loadConfig?: () => OpenClawConfig;
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async (req, res) => {
    const url = parseUrl(req);
    if (url.pathname !== params.route.path) {
      return false;
    }
    try {
      return await handleWebhookRequest({
        req,
        res,
        kind: params.route.kind,
        accountIdHint: params.route.accountIdHint,
        logger: params.logger,
        loadConfig: params.loadConfig,
      });
    } catch (error) {
      params.logger?.error?.("dingtalk-enterprise: webhook handler failed", {
        error: error instanceof Error ? error.message : String(error),
        kind: params.route.kind,
        path: params.route.path,
      });
      sendJson(res, 500, { ok: false, error: "Internal server error" });
      return true;
    }
  };
}

export function resolveDingTalkEnterpriseWebhookRoutes(cfg: OpenClawConfig): WebhookRouteDefinition[] {
  const routeMap = new Map<string, WebhookRouteDefinition>();
  for (const accountId of listDingTalkEnterpriseAccountIds(cfg)) {
    const account = resolveDingTalkEnterpriseAccount(cfg, accountId);
    const definitions: WebhookRouteDefinition[] = [
      {
        path: account.callbacks.message.path,
        kind: "message",
        accountIdHint: account.accountId,
      },
      {
        path: account.callbacks.card.path,
        kind: "card",
        accountIdHint: account.accountId,
      },
      {
        path: account.callbacks.oa.path,
        kind: "oa",
        accountIdHint: account.accountId,
      },
    ];
    for (const definition of definitions) {
      const existing = routeMap.get(definition.path);
      if (!existing) {
        routeMap.set(definition.path, definition);
        continue;
      }
      routeMap.set(definition.path, {
        ...existing,
        accountIdHint:
          existing.accountIdHint === definition.accountIdHint ? existing.accountIdHint : undefined,
      });
    }
  }
  return [...routeMap.values()];
}
