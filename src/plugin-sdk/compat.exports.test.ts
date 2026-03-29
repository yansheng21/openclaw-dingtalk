import { describe, expect, it } from "vitest";
import * as compatSdk from "./compat.js";

describe("plugin-sdk compat exports", () => {
  it("keeps reply pipeline helpers available for legacy external plugins", () => {
    expect(typeof compatSdk.createReplyPrefixOptions).toBe("function");
    expect(typeof compatSdk.createTypingCallbacks).toBe("function");
    expect(typeof compatSdk.logTypingFailure).toBe("function");
  });
});
