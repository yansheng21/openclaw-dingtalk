import type { AuditEvent } from "../../shared-types/src/index.js";

export const auditService = "@dingclaw/audit-service";

const auditEvents: AuditEvent[] = [];

export function emitAuditEvent(event: AuditEvent): AuditEvent {
  auditEvents.push(event);
  return event;
}

export function queryAuditEvents(params?: {
  channel?: string;
  accountId?: string;
  subjectId?: string;
  limit?: number;
}): AuditEvent[] {
  const filtered = auditEvents.filter((event) => {
    if (params?.channel && event.channel !== params.channel) {
      return false;
    }
    if (params?.accountId && event.accountId !== params.accountId) {
      return false;
    }
    if (params?.subjectId && event.subjectId !== params.subjectId) {
      return false;
    }
    return true;
  });
  const sorted = filtered.toSorted((left, right) => right.occurredAt - left.occurredAt);
  return typeof params?.limit === "number" ? sorted.slice(0, params.limit) : sorted;
}

export function exportAuditEvents(): string {
  return JSON.stringify(auditEvents, null, 2);
}

export function resetAuditEventsForTest(): void {
  auditEvents.length = 0;
}
