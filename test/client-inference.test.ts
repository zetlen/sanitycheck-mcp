// test/client-inference.test.ts
import { describe, it, expect } from "vitest";
import { inferModel, CLIENT_MODEL_MAP } from "../src/client-inference.js";

describe("client inference", () => {
  it("infers claude from claude-code client", () => {
    expect(inferModel("claude-code")).toBe("claude");
  });

  it("infers claude from claude-desktop client", () => {
    expect(inferModel("claude-desktop")).toBe("claude");
  });

  it("infers gpt from copilot client", () => {
    expect(inferModel("copilot")).toBe("gpt");
  });

  it("returns null for unknown client", () => {
    expect(inferModel("cursor")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(inferModel(undefined)).toBeNull();
  });
});
