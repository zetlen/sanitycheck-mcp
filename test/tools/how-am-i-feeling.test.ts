// test/tools/how-am-i-feeling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialDetail: vi.fn(),
}));

vi.mock("../../src/fetchers/ai-vibes/index.js", () => ({
  fetchAiDailyCheck: vi.fn(),
  fetchIsClaudeCodeDumb: vi.fn(),
  fetchAiStupidLevel: vi.fn(),
  fetchLmArena: vi.fn(),
}));

import { handleHowAmIFeeling } from "../../src/tools/how-am-i-feeling.js";
import { fetchOfficialDetail } from "../../src/fetchers/official/index.js";
import * as vibes from "../../src/fetchers/ai-vibes/index.js";

const mockOfficialDetail = vi.mocked(fetchOfficialDetail);
const mockAiDaily = vi.mocked(vibes.fetchAiDailyCheck);
const mockClaudeDumb = vi.mocked(vibes.fetchIsClaudeCodeDumb);
const mockStupidLevel = vi.mocked(vibes.fetchAiStupidLevel);
const mockLmArena = vi.mocked(vibes.fetchLmArena);

function makeDetail(overrides = {}) {
  return {
    name: "Anthropic",
    status: "operational",
    summary: "All systems operational",
    updatedAt: "2026-03-23T10:00:00Z",
    source: "https://status.anthropic.com",
    components: [],
    incidents: [],
    thirdPartyReports: {},
    ...overrides,
  };
}

describe("how_am_i_feeling", () => {
  beforeEach(() => {
    mockOfficialDetail.mockReset();
    mockAiDaily.mockReset();
    mockClaudeDumb.mockReset();
    mockStupidLevel.mockReset();
    mockLmArena.mockReset();
  });

  it("returns combined status for claude", async () => {
    mockOfficialDetail.mockResolvedValueOnce(makeDetail());
    mockAiDaily.mockResolvedValueOnce({
      source: "aidailycheck.com",
      sentiment: "Genius 90%",
      url: "https://aidailycheck.com",
    });
    mockClaudeDumb.mockResolvedValueOnce({
      source: "isclaudecodedumb.today",
      sentiment: "Not dumb today",
      url: "https://www.isclaudecodedumb.today/",
    });
    mockStupidLevel.mockResolvedValueOnce({
      source: "aistupidlevel.info",
      sentiment: "Score: 92/100",
      url: "https://aistupidlevel.info",
    });
    mockLmArena.mockResolvedValueOnce({
      source: "lmarena.ai",
      sentiment: "Elo: 1250",
      url: "https://lmarena.ai",
    });

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

  it("auto-detects claude model from claude-code clientName when model is undefined", async () => {
    mockOfficialDetail.mockResolvedValueOnce(makeDetail());
    mockAiDaily.mockResolvedValueOnce({
      source: "aidailycheck.com",
      sentiment: "Genius 90%",
      url: "https://aidailycheck.com",
    });
    mockClaudeDumb.mockResolvedValueOnce(null);
    mockStupidLevel.mockResolvedValueOnce(null);
    mockLmArena.mockResolvedValueOnce(null);

    const result = await handleHowAmIFeeling({ model: undefined }, "claude-code");
    const text = result.content[0].text;
    expect(text).toContain("Anthropic");
    expect(text).toContain("claude");
  });

  it("includes degraded components in output", async () => {
    mockOfficialDetail.mockResolvedValueOnce(
      makeDetail({
        status: "degraded",
        summary: "Partial degradation",
        components: [
          { name: "API", status: "operational", summary: "Working" },
          { name: "SIP Endpoints", status: "degraded", summary: "Elevated errors" },
        ],
      }),
    );
    mockAiDaily.mockResolvedValueOnce(null);
    mockClaudeDumb.mockResolvedValueOnce(null);
    mockStupidLevel.mockResolvedValueOnce(null);
    mockLmArena.mockResolvedValueOnce(null);

    const result = await handleHowAmIFeeling({ model: "claude" }, null);
    const text = result.content[0].text;
    expect(text).toContain("degraded_components:");
    expect(text).toContain("SIP Endpoints");
    expect(text).not.toContain("API: operational");
  });
});
