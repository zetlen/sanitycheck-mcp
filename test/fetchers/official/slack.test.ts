// test/fetchers/official/slack.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSlackStatus } from "../../../src/fetchers/official/slack.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Slack fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns operational when status is ok and no active incidents", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", active_incidents: [] }),
    });

    const result = await fetchSlackStatus();
    expect(result.name).toBe("Slack");
    expect(result.status).toBe("operational");
  });

  it("returns degraded when active incidents are present without outage keyword", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "active",
        active_incidents: [
          { title: "Slow message delivery", type: "incident" },
        ],
      }),
    });

    const result = await fetchSlackStatus();
    expect(result.name).toBe("Slack");
    expect(result.status).toBe("degraded");
  });

  it("returns outage when active incidents include outage type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "active",
        active_incidents: [
          { title: "Complete service outage", type: "outage" },
        ],
      }),
    });

    const result = await fetchSlackStatus();
    expect(result.name).toBe("Slack");
    expect(result.status).toBe("outage");
  });

  it("returns unknown on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await fetchSlackStatus();
    expect(result.status).toBe("unknown");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchSlackStatus();
    expect(result.status).toBe("unknown");
  });
});
