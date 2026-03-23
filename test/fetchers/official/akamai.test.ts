// test/fetchers/official/akamai.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAkamaiStatus } from "../../../src/fetchers/official/akamai.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Akamai fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy Akamai status page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>All systems operational</p></body></html>`,
    });

    const result = await fetchAkamaiStatus();
    expect(result.name).toBe("Akamai");
    expect(result.status).toBe("operational");
  });

  it("detects outage keywords", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>Major outage affecting CDN</p></body></html>`,
    });

    const result = await fetchAkamaiStatus();
    expect(result.status).toBe("outage");
  });

  it("detects non-outage issues as degraded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>Performance degradation in some regions</p></body></html>`,
    });

    const result = await fetchAkamaiStatus();
    expect(result.status).toBe("degraded");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchAkamaiStatus();
    expect(result.status).toBe("unknown");
  });
});
