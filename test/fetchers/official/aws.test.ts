// test/fetchers/official/aws.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwsStatus } from "../../../src/fetchers/official/aws.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("AWS fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy AWS status page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        archive: [],
        current: [],
      }),
      json: async () => ({ archive: [], current: [] }),
    });

    const result = await fetchAwsStatus();
    expect(result.name).toBe("AWS");
    expect(result.status).toBe("operational");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchAwsStatus();
    expect(result.status).toBe("unknown");
  });
});
