import { ChannelsStatusSnapshot } from "../types.ts";
import type { ChannelsState } from "./channels.types.ts";

export type { ChannelsState };

export async function loadChannels(state: ChannelsState, probe: boolean) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.channelsLoading) {
    return;
  }
  state.channelsLoading = true;
  state.channelsError = null;
  try {
    const res = await state.client.request<ChannelsStatusSnapshot | null>("channels.status", {
      probe,
      timeoutMs: 8000,
    });
    state.channelsSnapshot = res;
    state.channelsLastSuccess = Date.now();
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.channelsLoading = false;
  }
}

export async function testDingTalkEnterprise(
  state: ChannelsState,
  accountId?: string | null,
) {
  if (!state.client || !state.connected || state.dingtalkTestBusy) {
    return;
  }
  state.dingtalkTestBusy = true;
  state.channelsError = null;
  try {
    await state.client.request("dingtalk-enterprise.test", {
      ...(typeof accountId === "string" && accountId.trim() ? { accountId } : {}),
      timeoutMs: 8000,
    });
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.dingtalkTestBusy = false;
  }
}

export type DingTalkPreviewKind = "message" | "card" | "oa";

export type DingTalkPreviewResult = {
  accepted: boolean;
  claims: {
    channel: string;
    accountId: string;
    subjectId: string;
    displayName?: string | null;
    conversationId?: string | null;
    chatType: "direct" | "group" | "workflow";
    mentioned: boolean;
    riskTier: string;
  };
  route: {
    allowed: boolean;
    route: string;
    reason: string;
  };
  toolPolicy: {
    allowed: boolean;
    allowedToolClasses: string[];
    deniedToolClasses: string[];
    reason?: string | null;
  };
  approval: {
    required: boolean;
    level: string;
    requestId?: string | null;
  };
  auditEvent: {
    eventId: string;
    outcome: string;
    summary: string;
  };
};

export async function previewDingTalkPolicy(
  state: ChannelsState,
  params: {
    accountId?: string | null;
    kind: DingTalkPreviewKind;
    body: Record<string, unknown>;
  },
): Promise<DingTalkPreviewResult | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  try {
    const result = await state.client.request<DingTalkPreviewResult>(
      "dingtalk-enterprise.preview-policy",
      {
        accountId: params.accountId,
        kind: params.kind,
        body: params.body,
        timeoutMs: 8000,
      },
    );
    return result;
  } catch (err) {
    state.channelsError = String(err);
    return null;
  }
}

export async function startWhatsAppLogin(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    const res = await state.client.request<{ message?: string; qrDataUrl?: string }>(
      "web.login.start",
      {
        force,
        timeoutMs: 30000,
      },
    );
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function waitWhatsAppLogin(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    const res = await state.client.request<{ message?: string; connected?: boolean }>(
      "web.login.wait",
      {
        timeoutMs: 120000,
      },
    );
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginConnected = res.connected ?? null;
    if (res.connected) {
      state.whatsappLoginQrDataUrl = null;
    }
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function logoutWhatsApp(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "whatsapp" });
    state.whatsappLoginMessage = "Logged out.";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
  } finally {
    state.whatsappBusy = false;
  }
}
