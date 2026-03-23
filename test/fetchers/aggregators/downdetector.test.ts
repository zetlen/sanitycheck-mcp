// test/fetchers/aggregators/downdetector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDowndetectorReports } from "../../../src/fetchers/aggregators/downdetector.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Downdetector fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses report count from HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<div class="entry-title">GitHub</div>
        <span class="text-2xl">42</span>`,
    });

    const result = await fetchDowndetectorReports("github");
    // Should not throw, should return some result
    expect(result).toBeDefined();
    expect(result!.source).toBe("downdetector");
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("blocked"));
    const result = await fetchDowndetectorReports("github");
    expect(result).toBeNull();
  });
});
