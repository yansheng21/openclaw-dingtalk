import type { MsgContext } from "../../auto-reply/templating.js";
import { DEFAULT_DM_SCOPE } from "../dm-scope.js";
import { buildAgentSessionKey } from "../../routing/resolve-route.js";
import {
  buildAgentMainSessionKey,
  DEFAULT_AGENT_ID,
  normalizeMainKey,
} from "../../routing/session-key.js";
import { normalizeConversationText } from "../../acp/conversation-id.js";
import { normalizeE164 } from "../../utils.js";
import { normalizeExplicitSessionKey } from "./explicit-session-key-normalization.js";
import { resolveGroupSessionKey } from "./group.js";
import type { SessionScope } from "./types.js";

// Decide which session bucket to use (per-sender vs global).
export function deriveSessionKey(scope: SessionScope, ctx: MsgContext) {
  if (scope === "global") {
    return "global";
  }
  const resolvedGroup = resolveGroupSessionKey(ctx);
  if (resolvedGroup) {
    return resolvedGroup.key;
  }
  const from = ctx.From ? normalizeE164(ctx.From) : "";
  return from || "unknown";
}

/**
 * Resolve the session key.
 * Direct chats with channel context use isolated per-sender buckets; legacy
 * callers without channel context still fall back to the canonical main key.
 */
export function resolveSessionKey(scope: SessionScope, ctx: MsgContext, mainKey?: string) {
  const explicit = ctx.SessionKey?.trim();
  if (explicit) {
    return normalizeExplicitSessionKey(explicit, ctx);
  }
  const raw = deriveSessionKey(scope, ctx);
  if (scope === "global") {
    return raw;
  }
  const canonicalMainKey = normalizeMainKey(mainKey);
  const canonical = buildAgentMainSessionKey({
    agentId: DEFAULT_AGENT_ID,
    mainKey: canonicalMainKey,
  });
  const isGroup = raw.includes(":group:") || raw.includes(":channel:");
  if (!isGroup) {
    const channel =
      normalizeConversationText(
        (ctx.OriginatingChannel as string | undefined) ?? ctx.Surface ?? ctx.Provider ?? "",
      )
        .trim()
        .toLowerCase() || "";
    if (channel) {
      return buildAgentSessionKey({
        agentId: DEFAULT_AGENT_ID,
        channel,
        accountId: ctx.AccountId,
        peer: { kind: "direct", id: raw },
        dmScope: DEFAULT_DM_SCOPE,
      });
    }
    return canonical;
  }
  return `agent:${DEFAULT_AGENT_ID}:${raw}`;
}
