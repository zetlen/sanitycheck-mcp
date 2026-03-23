// test/fetchers/statuspage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStatuspageSummary, parseStatuspageStatus } from "../../src/fetchers/statuspage.js";
import type { ServiceStatus, ServiceDetail } from "../../src/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("statuspage fetcher", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const MOCK_SUMMARY = {
    status: { indicator: "none", description: "All Systems Operational" },
    components: [
      { name: "API", status: "operational", description: null },
      { name: "Webhooks", status: "degraded_performance", description: null },
    ],
    incidents: [
      {
        name: "Degraded Webhook Delivery",
        status: "investigating",
        created_at: "2026-03-23T10:00:00Z",
        updated_at: "2026-03-23T10:30:00Z",
        components: [{ name: "Webhooks" }],
      },
    ],
    page: { updated_at: "2026-03-23T10:30:00Z" },
  };

  it("parses a healthy statuspage response into ServiceStatus", () => {
    const healthy = { ...MOCK_SUMMARY, status: { indicator: "none", description: "All Systems Operational" } };
    const result = parseStatuspageStatus(healthy, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("operational");
    expect(result.name).toBe("GitHub");
  });

  it("parses a degraded statuspage response", () => {
    const degraded = { ...MOCK_SUMMARY, status: { indicator: "minor", description: "Minor issues" } };
    const result = parseStatuspageStatus(degraded, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("degraded");
  });

  it("parses a major outage response", () => {
    const major = { ...MOCK_SUMMARY, status: { indicator: "major", description: "Major outage" } };
    const result = parseStatuspageStatus(major, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("outage");
  });

  it("fetches and parses a real statuspage URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_SUMMARY,
    });

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.name).toBe("GitHub");
    expect(result.detail.components).toHaveLength(2);
    expect(result.detail.incidents).toHaveLength(1);
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.status).toBe("unknown");
  });
});
