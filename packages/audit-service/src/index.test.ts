import { beforeEach, describe, expect, it } from "vitest";
import {
  emitAuditEvent,
  exportAuditEvents,
  queryAuditEvents,
  resetAuditEventsForTest,
} from "./index.js";

describe("audit-service", () => {
  beforeEach(() => {
    resetAuditEventsForTest();
  });

  it("stores and queries structured audit events", () => {
    emitAuditEvent({
      eventId: "audit-1",
      occurredAt: 10,
      kind: "runtime",
      action: "channel.ingress",
      channel: "dingtalk-enterprise",
      accountId: "corp-a",
      subjectId: "staff-1",
      riskTier: "normal",
      outcome: "accepted",
      summary: "accepted",
    });
    emitAuditEvent({
      eventId: "audit-2",
      occurredAt: 20,
      kind: "approval",
      action: "channel.ingress",
      channel: "dingtalk-enterprise",
      accountId: "corp-a",
      subjectId: "staff-2",
      riskTier: "high",
      outcome: "pending-approval",
      summary: "pending",
    });

    const latest = queryAuditEvents({ channel: "dingtalk-enterprise", limit: 1 });
    expect(latest).toHaveLength(1);
    expect(latest[0].eventId).toBe("audit-2");
    expect(exportAuditEvents()).toContain("audit-1");
    expect(exportAuditEvents()).toContain("audit-2");
  });
});
