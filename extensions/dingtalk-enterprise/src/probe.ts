import type { BaseProbeResult } from "openclaw/plugin-sdk/channel-contract";
import type { DingTalkEnterpriseResolvedAccount } from "./config.js";

export type DingTalkEnterpriseProbe = BaseProbeResult<string | null> & {
  mode: "static";
  configured: boolean;
  enabled: boolean;
  credentialMode: DingTalkEnterpriseResolvedAccount["credentialMode"];
  missingRequired: string[];
  missingOptional: string[];
  callbacks: DingTalkEnterpriseResolvedAccount["callbacks"];
  notes: string[];
  elapsedMs: number;
};

export async function probeDingTalkEnterpriseAccount(
  account: DingTalkEnterpriseResolvedAccount,
  _timeoutMs = 8_000,
): Promise<DingTalkEnterpriseProbe> {
  const startedAt = Date.now();
  const notes: string[] = [];

  if (!account.callbacks.baseUrl) {
    notes.push("未配置 callbackBaseUrl，当前只能校验回调路径，无法生成完整外部 URL。");
  } else {
    notes.push("已生成消息、卡片和 OA 事件的完整回调地址，可用于钉钉控制台配置。");
  }
  notes.push("当前测试为本地静态探测，尚未发起真实钉钉 API 握手。");

  let error: string | null = null;
  if (!account.enabled) {
    error = "接入已禁用";
  } else if (!account.configured) {
    error = `缺少必填字段：${account.missingRequired.join("、")}`;
  }

  return {
    ok: account.enabled && account.configured,
    error,
    mode: "static",
    configured: account.configured,
    enabled: account.enabled,
    credentialMode: account.credentialMode,
    missingRequired: account.missingRequired,
    missingOptional: account.missingOptional,
    callbacks: account.callbacks,
    notes,
    elapsedMs: Date.now() - startedAt,
  };
}
