import { describe, expect, it } from "vitest";
import { projectSafeChannelAccountSnapshotFields } from "./account-snapshot-fields.js";

describe("projectSafeChannelAccountSnapshotFields", () => {
  it("projects common safe snapshot fields without public-key style fields", () => {
    const snapshot = projectSafeChannelAccountSnapshotFields({
      name: "Primary",
      groupPolicy: "allowlist",
      requireMention: true,
      groupAllowFrom: ["g1", "g2"],
      tokenSource: "config",
      tokenStatus: "configured_unavailable",
      signingSecretSource: "config", // pragma: allowlist secret
      signingSecretStatus: "configured_unavailable", // pragma: allowlist secret
      webhookUrl: "https://example.com/webhook",
      webhookPath: "/webhook",
      audienceType: "project-number",
      audience: "1234567890",
      publicKey: "pk_live_123",
    });

    expect(snapshot).toEqual({
      name: "Primary",
      groupPolicy: "allowlist",
      requireMention: true,
      groupAllowFrom: ["g1", "g2"],
      tokenSource: "config",
      tokenStatus: "configured_unavailable",
      signingSecretSource: "config", // pragma: allowlist secret
      signingSecretStatus: "configured_unavailable", // pragma: allowlist secret
      webhookUrl: "https://example.com/webhook",
      webhookPath: "/webhook",
    });
  });

  it("strips embedded credentials from baseUrl fields", () => {
    const snapshot = projectSafeChannelAccountSnapshotFields({
      baseUrl: "https://bob:secret@chat.example.test",
    });

    expect(snapshot).toEqual({
      baseUrl: "https://chat.example.test/",
    });
  });
});
