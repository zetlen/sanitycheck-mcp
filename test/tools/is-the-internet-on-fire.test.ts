// test/tools/is-the-internet-on-fire.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialStatus: vi.fn(),
}));

vi.mock("../../src/cache.js", () => ({
  FileCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  })),
}));

import { handleIsTheInternetOnFire } from "../../src/tools/is-the-internet-on-fire.js";
import { fetchOfficialStatus } from "../../src/fetchers/official/index.js";

const mockFetchOfficial = vi.mocked(fetchOfficialStatus);

describe("is_the_internet_on_fire", () => {
  beforeEach(() => mockFetchOfficial.mockReset());

  it("returns traffic-light summary for all services", async () => {
    mockFetchOfficial.mockResolvedValue({
      name: "TestService",
      status: "operational",
      summary: "All systems operational",
      updatedAt: "2026-03-23T10:00:00Z",
      source: "https://example.com",
    });

    const result = await handleIsTheInternetOnFire({});
    expect(result.content[0].text).toContain("🟢");
  });

  it("filters by category", async () => {
    // Track which slugs are fetched
    const fetchedSlugs: string[] = [];
    mockFetchOfficial.mockImplementation(async (slug: string) => {
      fetchedSlugs.push(slug);
      return {
        name: slug,
        status: "operational" as const,
        summary: "All systems operational",
        updatedAt: "2026-03-23T10:00:00Z",
        source: "https://example.com",
      };
    });

    await handleIsTheInternetOnFire({ category: "cloud" });
    // Should only fetch cloud services (aws, gcp, azure)
    expect(fetchedSlugs).toContain("aws");
    expect(fetchedSlugs).toContain("gcp");
    expect(fetchedSlugs).toContain("azure");
    expect(fetchedSlugs).not.toContain("github");
    expect(fetchedSlugs).not.toContain("slack");
  });
});
