// test/fetchers/ai-vibes/aidailycheck.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser module
vi.mock("../../../src/browser.js", () => ({
  fetchWithBrowser: vi.fn(),
}));

import { fetchAiDailyCheck } from "../../../src/fetchers/ai-vibes/aidailycheck.js";
import { fetchWithBrowser } from "../../../src/browser.js";

const mockFetchWithBrowser = vi.mocked(fetchWithBrowser);

describe("aidailycheck fetcher", () => {
  beforeEach(() => mockFetchWithBrowser.mockReset());

  it("returns a vibe result with sentiment data", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(
      `<html><body><div>Claude: Genius 85%</div><div>GPT: Good 70%</div></body></html>`
    );

    const result = await fetchAiDailyCheck("claude");
    expect(result).toBeDefined();
    expect(result!.source).toBe("aidailycheck.com");
    expect(result!.url).toContain("aidailycheck.com");
  });

  it("returns null when browser is unavailable", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(null);
    const result = await fetchAiDailyCheck("claude");
    expect(result).toBeNull();
  });
});
