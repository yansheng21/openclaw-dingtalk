import { describe, expect, it } from "vitest";
import * as pluginSdk from "./index.ts";

describe("plugin-sdk root compat exports", () => {
  it("keeps legacy runtime helpers available for root imports", () => {
    for (const name of [
      "DEFAULT_ACCOUNT_ID",
      "DEFAULT_GROUP_HISTORY_LIMIT",
      "createAccountListHelpers",
      "buildAgentMediaPayload",
      "createReplyPrefixOptions",
      "createTypingCallbacks",
      "logInboundDrop",
      "logTypingFailure",
      "buildPendingHistoryContextFromMap",
      "clearHistoryEntriesIfEnabled",
      "recordPendingHistoryEntryIfEnabled",
      "resolveControlCommandGate",
      "resolveDmGroupAccessWithLists",
      "resolveAllowlistProviderRuntimeGroupPolicy",
      "resolveDefaultGroupPolicy",
      "resolveChannelMediaMaxBytes",
      "warnMissingProviderGroupPolicyFallbackOnce",
      "emptyPluginConfigSchema",
      "onDiagnosticEvent",
      "normalizePluginHttpPath",
      "registerPluginHttpRoute",
    ] as const) {
      expect(name in pluginSdk, `${name} should stay exported from openclaw/plugin-sdk root`).toBe(
        true,
      );
    }
  });
});
