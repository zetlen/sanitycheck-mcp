// test/fetchers/ai-vibes/aistupidlevel.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser module
vi.mock("../../../src/browser.js", () => ({
  fetchWithBrowser: vi.fn(),
}));

import { fetchAiStupidLevel } from "../../../src/fetchers/ai-vibes/aistupidlevel.js";
import { fetchWithBrowser } from "../../../src/browser.js";

const mockFetchWithBrowser = vi.mocked(fetchWithBrowser);

describe("aistupidlevel fetcher", () => {
  beforeEach(() => mockFetchWithBrowser.mockReset());

  it("returns a vibe result with benchmark data", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(
      `<html><body><div>Claude 3.5: Score 87</div><div>GPT-4: Score 82</div></body></html>`
    );

    const result = await fetchAiStupidLevel("claude");
    expect(result).toBeDefined();
    expect(result!.source).toBe("aistupidlevel.info");
    expect(result!.url).toContain("aistupidlevel.info");
  });

  it("returns null when browser is unavailable", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(null);
    const result = await fetchAiStupidLevel("claude");
    expect(result).toBeNull();
  });
});
