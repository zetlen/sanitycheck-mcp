// test/fetchers/ai-vibes/lmarena.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser module
vi.mock("../../../src/browser.js", () => ({
  fetchWithBrowser: vi.fn(),
}));

import { fetchLmArena } from "../../../src/fetchers/ai-vibes/lmarena.js";
import { fetchWithBrowser } from "../../../src/browser.js";

const mockFetchWithBrowser = vi.mocked(fetchWithBrowser);

describe("lmarena fetcher", () => {
  beforeEach(() => mockFetchWithBrowser.mockReset());

  it("returns a vibe result with leaderboard data", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(
      `<html><body><div>Claude 3.5 Sonnet Elo: 1289</div><div>GPT-4o Elo: 1265</div></body></html>`
    );

    const result = await fetchLmArena("claude");
    expect(result).toBeDefined();
    expect(result!.source).toBe("lmarena.ai");
    expect(result!.url).toContain("lmarena.ai");
  });

  it("returns null when browser is unavailable", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(null);
    const result = await fetchLmArena("claude");
    expect(result).toBeNull();
  });
});
