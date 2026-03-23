// test/tools/how-am-i-feeling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialStatus: vi.fn(),
}));

vi.mock("../../src/fetchers/ai-vibes/index.js", () => ({
  fetchAiDailyCheck: vi.fn(),
  fetchIsClaudeCodeDumb: vi.fn(),
  fetchAiStupidLevel: vi.fn(),
  fetchLmArena: vi.fn(),
}));

import { handleHowAmIFeeling } from "../../src/tools/how-am-i-feeling.js";
import { fetchOfficialStatus } from "../../src/fetchers/official/index.js";
import * as vibes from "../../src/fetchers/ai-vibes/index.js";

const mockOfficial = vi.mocked(fetchOfficialStatus);
const mockAiDaily = vi.mocked(vibes.fetchAiDailyCheck);
const mockClaudeDumb = vi.mocked(vibes.fetchIsClaudeCodeDumb);
const mockStupidLevel = vi.mocked(vibes.fetchAiStupidLevel);
const mockLmArena = vi.mocked(vibes.fetchLmArena);

describe("how_am_i_feeling", () => {
  beforeEach(() => {
    mockOfficial.mockReset();
    mockAiDaily.mockReset();
    mockClaudeDumb.mockReset();
    mockStupidLevel.mockReset();
    mockLmArena.mockReset();
  });

  it("returns combined status for claude", async () => {
    mockOfficial.mockResolvedValueOnce({
      name: "Anthropic", status: "operational", summary: "All systems operational",
      updatedAt: "2026-03-23T10:00:00Z", source: "https://status.anthropic.com",
    });
    mockAiDaily.mockResolvedValueOnce({ source: "aidailycheck.com", sentiment: "Genius 90%", url: "https://aidailycheck.com" });
    mockClaudeDumb.mockResolvedValueOnce({ source: "isclaudecodedumb.today", sentiment: "Not dumb today", url: "https://www.isclaudecodedumb.today/" });
    mockStupidLevel.mockResolvedValueOnce({ source: "aistupidlevel.info", sentiment: "Score: 92/100", url: "https://aistupidlevel.info" });
    mockLmArena.mockResolvedValueOnce({ source: "lmarena.ai", sentiment: "Elo: 1250", url: "https://lmarena.ai" });

    const result = await handleHowAmIFeeling({ model: "claude" }, null);
    const text = result.content[0].text;
    expect(text).toContain("Anthropic");
    expect(text).toContain("aidailycheck");
  });

  it("returns friendly error when model is unknown and no clientInfo", async () => {
    const result = await handleHowAmIFeeling({}, null);
    const text = result.content[0].text;
    expect(text.toLowerCase()).toContain("who");
  });
});
