// test/fetchers/official/gcp.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGcpStatus } from "../../../src/fetchers/official/gcp.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GCP fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy GCP incidents feed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await fetchGcpStatus();
    expect(result.name).toBe("GCP");
    expect(result.status).toBe("operational");
  });

  it("detects an active incident as degraded", async () => {
    const recentBegin = new Date(Date.now() - 3_600_000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          service_name: "Cloud Storage",
          external_desc: "Elevated error rates",
          begin: recentBegin,
          severity: "medium",
          most_recent_update: { status: "ACTIVE" },
        },
      ],
    });

    const result = await fetchGcpStatus();
    expect(result.name).toBe("GCP");
    expect(result.status).toBe("degraded");
  });

  it("detects a high-severity incident as outage", async () => {
    const recentBegin = new Date(Date.now() - 3_600_000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          service_name: "Compute Engine",
          external_desc: "Complete service outage",
          begin: recentBegin,
          severity: "high",
          most_recent_update: { status: "ACTIVE" },
        },
      ],
    });

    const result = await fetchGcpStatus();
    expect(result.status).toBe("outage");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchGcpStatus();
    expect(result.status).toBe("unknown");
  });
});
