// test/fetchers/official/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOfficialStatus, fetchOfficialDetail } from "../../../src/fetchers/official/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("official fetchers", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const MOCK_HEALTHY = {
    status: { indicator: "none", description: "All Systems Operational" },
    components: [],
    incidents: [],
    page: { updated_at: "2026-03-23T10:00:00Z" },
  };

  it("fetches status for a Statuspage-based service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HEALTHY,
    });

    const result = await fetchOfficialStatus("github");
    expect(result.name).toBe("GitHub");
    expect(result.status).toBe("operational");
  });

  it("returns unknown for an unrecognized service slug", async () => {
    const result = await fetchOfficialStatus("nonexistent");
    expect(result.status).toBe("unknown");
  });

  it("fetches detail for a Statuspage-based service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HEALTHY,
    });

    const result = await fetchOfficialDetail("github");
    expect(result.name).toBe("GitHub");
    expect(result.components).toBeDefined();
    expect(result.incidents).toBeDefined();
  });
});
