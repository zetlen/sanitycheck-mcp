// test/fetchers/official/azure.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAzureStatus } from "../../../src/fetchers/official/azure.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Azure fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy Azure status page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><div class="status-healthy">All systems operational</div></body></html>`,
    });

    const result = await fetchAzureStatus();
    expect(result.name).toBe("Azure");
    expect(result.status).toBe("operational");
  });

  it("detects unhealthy indicators as degraded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body>
        <span class="status-icon--warning"></span>
        <span class="status-icon--warning"></span>
      </body></html>`,
    });

    const result = await fetchAzureStatus();
    expect(result.name).toBe("Azure");
    expect(result.status).toBe("degraded");
  });

  it("detects many issues as outage", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body>
        <span class="status-icon--unhealthy"></span>
        <span class="status-icon--unhealthy"></span>
        <span class="status-icon--unhealthy"></span>
        <span class="status-icon--unhealthy"></span>
      </body></html>`,
    });

    const result = await fetchAzureStatus();
    expect(result.status).toBe("outage");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchAzureStatus();
    expect(result.status).toBe("unknown");
  });
});
