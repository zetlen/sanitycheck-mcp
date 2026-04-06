// test/fetchers/statuspage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStatuspageSummary, parseStatuspageStatus } from "../../src/fetchers/statuspage.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("statuspage fetcher", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const MOCK_STATUS = {
    status: { indicator: "none", description: "All Systems Operational" },
    page: { updated_at: "2026-03-23T10:30:00Z" },
  };

  const MOCK_COMPONENTS = {
    components: [
      { name: "API", status: "operational", description: null },
      { name: "Webhooks", status: "degraded_performance", description: null },
    ],
    page: { updated_at: "2026-03-23T10:30:00Z" },
  };

  const MOCK_INCIDENTS = {
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

  const MOCK_SUMMARY = {
    ...MOCK_STATUS,
    ...MOCK_COMPONENTS,
    ...MOCK_INCIDENTS,
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
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_STATUS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_COMPONENTS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_INCIDENTS });

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.name).toBe("GitHub");
    expect(result.detail.components).toHaveLength(2);
    expect(result.detail.incidents).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_COMPONENTS });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_INCIDENTS });

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.status).toBe("unknown");
  });

  it("falls back to canonical statuspage.io endpoints on 403 when statuspageId is provided", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "https://status.fastly.com/api/v2/status.json") {
        return { ok: false, status: 403 };
      }
      if (url === "https://889929qfzmz6.statuspage.io/api/v2/status.json") {
        return { ok: true, json: async () => MOCK_STATUS };
      }
      if (url === "https://status.fastly.com/api/v2/components.json") {
        return { ok: false, status: 403 };
      }
      if (url === "https://889929qfzmz6.statuspage.io/api/v2/components.json") {
        return { ok: true, json: async () => MOCK_COMPONENTS };
      }
      if (url === "https://status.fastly.com/api/v2/incidents/unresolved.json") {
        return { ok: false, status: 403 };
      }
      if (url === "https://889929qfzmz6.statuspage.io/api/v2/incidents/unresolved.json") {
        return { ok: true, json: async () => MOCK_INCIDENTS };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchStatuspageSummary("https://status.fastly.com", "Fastly", "889929qfzmz6");
    expect(result.status.name).toBe("Fastly");
    expect(result.status.status).toBe("operational");
    expect(mockFetch).toHaveBeenCalledTimes(6);
    const calledUrls = mockFetch.mock.calls.map(([url]) => String(url));
    expect(calledUrls).toContain("https://889929qfzmz6.statuspage.io/api/v2/status.json");
    expect(calledUrls).toContain("https://889929qfzmz6.statuspage.io/api/v2/components.json");
    expect(calledUrls).toContain("https://889929qfzmz6.statuspage.io/api/v2/incidents/unresolved.json");
  });

  it("returns unknown when the status endpoint fails on both vanity and fallback URLs", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_COMPONENTS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_INCIDENTS });

    const result = await fetchStatuspageSummary("https://status.fastly.com", "Fastly", "889929qfzmz6");
    expect(result.status.status).toBe("unknown");
  });

  it("uses partial data when components and incidents fail but status succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_STATUS })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchStatuspageSummary("https://status.example.com", "Example");
    expect(result.status.status).toBe("operational");
    expect(result.detail.components).toEqual([]);
    expect(result.detail.incidents).toEqual([]);
  });

  it("does not attempt fallback when no statuspageId is provided on 403", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchStatuspageSummary("https://status.example.com", "Example");
    expect(result.status.status).toBe("unknown");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
