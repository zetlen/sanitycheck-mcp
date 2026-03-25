// test/fetchers/ai-vibes/isclaudecodedumb.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser module
vi.mock("../../../src/browser.js", () => ({
  fetchWithBrowser: vi.fn(),
}));

import { fetchIsClaudeCodeDumb } from "../../../src/fetchers/ai-vibes/isclaudecodedumb.js";
import { fetchWithBrowser } from "../../../src/browser.js";

const mockFetchWithBrowser = vi.mocked(fetchWithBrowser);

describe("isclaudecodedumb fetcher", () => {
  beforeEach(() => mockFetchWithBrowser.mockReset());

  it("returns null for non-Claude models without fetching", async () => {
    const result = await fetchIsClaudeCodeDumb("gpt-4");
    expect(result).toBeNull();
    expect(mockFetchWithBrowser).not.toHaveBeenCalled();
  });

  it("fetches for Claude models", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(
      `<html><body><div>Yes 65%</div><div>No 35%</div><div>1234 votes</div></body></html>`,
    );

    const result = await fetchIsClaudeCodeDumb("claude");
    expect(result).toBeDefined();
    expect(result!.source).toBe("isclaudecodedumb.today");
    expect(mockFetchWithBrowser).toHaveBeenCalledOnce();
  });

  it("returns null when browser is unavailable", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(null);
    const result = await fetchIsClaudeCodeDumb("claude");
    expect(result).toBeNull();
  });
});
