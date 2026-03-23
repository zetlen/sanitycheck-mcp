// test/index.test.ts
import { describe, it, expect } from "vitest";

describe("server module", () => {
  it("exports without errors", async () => {
    // Verify the module can be imported without crashing
    // (actual MCP server won't start because we don't connect transport)
    const mod = await import("../src/server.js");
    expect(mod.createServer).toBeDefined();
  });
});
