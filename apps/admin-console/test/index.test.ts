import assert from "node:assert/strict";
import test from "node:test";
import { adminConsoleCards, adminConsoleSections, adminConsoleTitle, serviceName } from "../src/index.ts";

test("admin console module", () => {
  assert.equal(serviceName, "@dingclaw/admin-console");
  assert.equal(adminConsoleTitle, "DingClaw 管理端");
  assert.ok(adminConsoleSections.includes("工作台"));
  assert.ok(adminConsoleSections.includes("渠道接入"));
  assert.ok(adminConsoleCards.some((card) => card.title === "模型与中转"));
});
