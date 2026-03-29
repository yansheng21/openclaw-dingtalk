import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { resolveDingTalkEnterpriseAccount } from "./config.js";
import { probeDingTalkEnterpriseAccount, type DingTalkEnterpriseProbe } from "./probe.js";

type DingTalkEnterpriseTestLogger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
};

export type DingTalkEnterpriseStaticTestResult = {
  channel: "dingtalk-enterprise";
  accountId: string;
  testedAt: number;
  staticProbeOnly: true;
  probe: DingTalkEnterpriseProbe;
};

export async function runDingTalkEnterpriseStaticTest(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  timeoutMs?: number;
  logger?: DingTalkEnterpriseTestLogger;
}): Promise<DingTalkEnterpriseStaticTestResult> {
  const timeoutMs =
    typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
      ? Math.max(1_000, Math.floor(params.timeoutMs))
      : 8_000;
  const account = resolveDingTalkEnterpriseAccount(params.cfg, params.accountId);

  params.logger?.info?.("dingtalk-enterprise: 开始执行静态接入测试", {
    accountId: account.accountId,
    timeoutMs,
  });

  const probe = await probeDingTalkEnterpriseAccount(account, timeoutMs);
  const callbackMeta = {
    message: account.callbacks.message.url ?? account.callbacks.message.path,
    card: account.callbacks.card.url ?? account.callbacks.card.path,
    oa: account.callbacks.oa.url ?? account.callbacks.oa.path,
  };

  if (probe.ok) {
    params.logger?.info?.("dingtalk-enterprise: 接入测试通过", {
      accountId: account.accountId,
      credentialMode: probe.credentialMode,
      callbacks: callbackMeta,
      staticProbeOnly: true,
    });
  } else {
    params.logger?.warn?.("dingtalk-enterprise: 接入测试未通过", {
      accountId: account.accountId,
      error: probe.error,
      missingRequired: probe.missingRequired,
      callbacks: callbackMeta,
      staticProbeOnly: true,
    });
  }

  return {
    channel: "dingtalk-enterprise",
    accountId: account.accountId,
    testedAt: Date.now(),
    staticProbeOnly: true,
    probe,
  };
}
