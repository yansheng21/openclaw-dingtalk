import { describe, expect, it } from "vitest";
import { buildPromptSection } from "./index.ts";

describe("memory-core prompt section", () => {
  it("mentions synced knowledge files in recall guidance", () => {
    const lines = buildPromptSection({
      availableTools: new Set(["memory_search", "memory_get"]),
      citationsMode: "auto",
    });

    expect(lines.join("\n")).toContain("memory/dingtalk-kb");
    expect(lines.join("\n")).toContain("knowledge");
  });
});
