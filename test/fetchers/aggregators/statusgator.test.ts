// test/fetchers/aggregators/statusgator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStatusGatorStatus } from "../../../src/fetchers/aggregators/statusgator.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("StatusGator fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses status from HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<div class="component-status">Operational</div>`,
    });
    const result = await fetchStatusGatorStatus("github");
    expect(result).toBeDefined();
    expect(result!.status).toBe("operational");
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchStatusGatorStatus("github");
    expect(result).toBeNull();
  });
});
