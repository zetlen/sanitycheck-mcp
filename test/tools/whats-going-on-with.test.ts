// test/tools/whats-going-on-with.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialDetail: vi.fn(),
}));

vi.mock("../../src/fetchers/aggregators/downdetector.js", () => ({
  fetchDowndetectorReports: vi.fn(),
}));

vi.mock("../../src/cache.js", () => ({
  FileCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  })),
}));

import { handleWhatsGoingOnWith } from "../../src/tools/whats-going-on-with.js";
import { fetchOfficialDetail } from "../../src/fetchers/official/index.js";
import { fetchDowndetectorReports } from "../../src/fetchers/aggregators/downdetector.js";

const mockDetail = vi.mocked(fetchOfficialDetail);
const mockDD = vi.mocked(fetchDowndetectorReports);

describe("whats_going_on_with", () => {
  beforeEach(() => {
    mockDetail.mockReset();
    mockDD.mockReset();
  });

  it("returns detailed status for a known service", async () => {
    mockDetail.mockResolvedValueOnce({
      name: "GitHub",
      status: "degraded",
      summary: "Degraded performance",
      updatedAt: "2026-03-23T10:00:00Z",
      source: "https://www.githubstatus.com",
      components: [{ name: "API", status: "degraded", summary: "Slow responses" }],
      incidents: [{ title: "API Latency", status: "investigating", createdAt: "2026-03-23T09:00:00Z", updatedAt: "2026-03-23T10:00:00Z", components: ["API"] }],
      thirdPartyReports: {},
    });
    mockDD.mockResolvedValueOnce({ source: "downdetector", reportCount: 150, trend: "rising", url: "https://downdetector.com/status/github/" });

    const result = await handleWhatsGoingOnWith({ service: "github" });
    expect(result.content[0].text).toContain("GitHub");
    expect(result.content[0].text).toContain("API Latency");
  });

  it("falls back to Downdetector for unknown services", async () => {
    mockDD.mockResolvedValueOnce({ source: "downdetector", reportCount: 50, trend: "stable", url: "https://downdetector.com/status/some-service/" });

    const result = await handleWhatsGoingOnWith({ service: "some-random-service" });
    expect(result.content[0].text).toContain("downdetector");
  });
});
