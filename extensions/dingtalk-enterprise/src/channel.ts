import { describeAccountSnapshot } from "openclaw/plugin-sdk/account-helpers";
import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import {
  listDingTalkEnterpriseAccountIds,
  resolveDefaultDingTalkEnterpriseAccountId,
  resolveDingTalkEnterpriseAccount,
  type DingTalkEnterpriseResolvedAccount,
} from "./config.js";
import { probeDingTalkEnterpriseAccount, type DingTalkEnterpriseProbe } from "./probe.js";

export const dingtalkEnterprisePlugin: ChannelPlugin<
  DingTalkEnterpriseResolvedAccount,
  DingTalkEnterpriseProbe
> = {
  id: "dingtalk-enterprise",
  meta: {
    id: "dingtalk-enterprise",
    label: "钉钉",
    selectionLabel: "钉钉企业版",
    docsPath: "/channels/dingtalk-enterprise",
    docsLabel: "dingtalk",
    blurb: "企业钉钉接入、配置联调和日志观察。",
    order: 12,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
  },
  reload: {
    configPrefixes: [
      "plugins.entries.dingtalk-enterprise",
      "channels.dingtalk-enterprise",
      "dingtalk-enterprise",
    ],
  },
  gatewayMethods: [
    "dingtalk-enterprise.test",
    "dingtalk-enterprise.resolve-claims",
    "dingtalk-enterprise.preview-policy",
  ],
  config: {
    listAccountIds: listDingTalkEnterpriseAccountIds,
    resolveAccount: resolveDingTalkEnterpriseAccount,
    inspectAccount: resolveDingTalkEnterpriseAccount,
    defaultAccountId: resolveDefaultDingTalkEnterpriseAccountId,
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => account.configured,
    describeAccount: (account) =>
      describeAccountSnapshot({
        account,
        configured: account.configured,
        extra: {
          dmPolicy: account.dmPolicy ?? "pairing",
          groupPolicy: account.groupPolicy ?? "allowlist",
          requireMention: account.requireMention ?? true,
          allowFrom: account.allowFrom ?? [],
          groupAllowFrom: account.groupAllowFrom ?? [],
          toolScopes: account.toolScopes ?? [],
          approvalLevel: account.approvalLevel ?? "L1",
          riskTier: account.riskTier ?? "normal",
          webhookPath: account.callbacks.message.path,
          webhookUrl: account.callbacks.message.url,
          application: {
            credentialMode: account.credentialMode,
            callbackBaseUrl: account.callbacks.baseUrl,
            cardCallbackPath: account.callbacks.card.path,
            cardCallbackUrl: account.callbacks.card.url,
            oaCallbackPath: account.callbacks.oa.path,
            oaCallbackUrl: account.callbacks.oa.url,
            missingRequired: account.missingRequired,
            missingOptional: account.missingOptional,
            staticProbeOnly: true,
          },
        },
      }),
  },
  status: {
    probeAccount: async ({ account, timeoutMs }) =>
      probeDingTalkEnterpriseAccount(account, timeoutMs),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      connected: runtime?.connected ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      webhookPath: account.callbacks.message.path,
      webhookUrl: account.callbacks.message.url ?? undefined,
      dmPolicy: account.dmPolicy ?? "pairing",
      groupPolicy: account.groupPolicy ?? "allowlist",
      requireMention: account.requireMention ?? true,
      allowFrom: account.allowFrom ?? [],
      groupAllowFrom: account.groupAllowFrom ?? [],
      probe,
      application: {
        credentialMode: account.credentialMode,
        callbackBaseUrl: account.callbacks.baseUrl,
        cardCallbackPath: account.callbacks.card.path,
        cardCallbackUrl: account.callbacks.card.url,
        oaCallbackPath: account.callbacks.oa.path,
        oaCallbackUrl: account.callbacks.oa.url,
        toolScopes: account.toolScopes ?? [],
        approvalLevel: account.approvalLevel ?? "L1",
        riskTier: account.riskTier ?? "normal",
        missingRequired: account.missingRequired,
        missingOptional: account.missingOptional,
        staticProbeOnly: true,
      },
    }),
    buildChannelSummary: ({ account, defaultAccountId, snapshot }) => ({
      configured: snapshot.configured ?? account.configured,
      enabled: account.enabled,
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
      defaultAccountId,
      dmPolicy: account.dmPolicy ?? "pairing",
      groupPolicy: account.groupPolicy ?? "allowlist",
      requireMention: account.requireMention ?? true,
      allowFrom: account.allowFrom ?? [],
      groupAllowFrom: account.groupAllowFrom ?? [],
      credentialMode: account.credentialMode,
      callbackBaseUrl: account.callbacks.baseUrl,
      messageCallbackPath: account.callbacks.message.path,
      messageCallbackUrl: account.callbacks.message.url ?? undefined,
      cardCallbackPath: account.callbacks.card.path,
      cardCallbackUrl: account.callbacks.card.url ?? undefined,
      oaCallbackPath: account.callbacks.oa.path,
      oaCallbackUrl: account.callbacks.oa.url ?? undefined,
      missingRequired: account.missingRequired,
      missingOptional: account.missingOptional,
      staticProbeOnly: true,
    }),
    resolveAccountState: ({ configured, enabled }) => {
      if (!enabled) {
        return "disabled";
      }
      return configured ? "configured" : "not configured";
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((account) => {
        const issues = [];
        if (account.enabled !== false && account.configured === false) {
          issues.push({
            channel: "dingtalk-enterprise" as const,
            accountId: account.accountId,
            kind: "config" as const,
            message: "钉钉企业接入缺少必填字段。",
            fix: "补齐 appKey/appSecret 或 clientId/clientSecret，并设置 agentId。",
          });
        }
        if (account.lastError) {
          issues.push({
            channel: "dingtalk-enterprise" as const,
            accountId: account.accountId,
            kind: "runtime" as const,
            message: account.lastError,
          });
        }
        return issues;
      }),
  },
};
