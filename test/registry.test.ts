// test/registry.test.ts
import { describe, it, expect } from "vitest";
import { resolveService, getServicesByCategory, SERVICE_ALIASES } from "../src/registry.js";

describe("registry", () => {
  it("resolves an exact service name", () => {
    const result = resolveService("github");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GitHub");
  });

  it("resolves a service alias", () => {
    const result = resolveService("s3");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("AWS");
  });

  it("resolves case-insensitively", () => {
    const result = resolveService("GITHUB");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GitHub");
  });

  it("returns empty array for unknown service", () => {
    const result = resolveService("nonexistent-service-xyz");
    expect(result).toHaveLength(0);
  });

  it("returns services by category", () => {
    const cloud = getServicesByCategory("cloud");
    const names = cloud.map((s) => s.name);
    expect(names).toContain("AWS");
    expect(names).toContain("GCP");
    expect(names).toContain("Azure");
  });
});
