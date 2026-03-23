// test/fetchers/official/aws.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwsStatus } from "../../../src/fetchers/official/aws.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("AWS fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy AWS status page (HTML with 'operating normally')", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>Service is operating normally</p></body></html>`,
    });

    const result = await fetchAwsStatus();
    expect(result.name).toBe("AWS");
    expect(result.status).toBe("operational");
  });

  it("detects outage keyword in HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>Service disruption affecting EC2</p></body></html>`,
    });

    const result = await fetchAwsStatus();
    expect(result.status).toBe("outage");
  });

  it("detects degraded keyword in HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>Elevated error rates in us-east-1</p></body></html>`,
    });

    const result = await fetchAwsStatus();
    expect(result.status).toBe("degraded");
  });

  it("defaults to operational when no issue indicators found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>AWS Health Dashboard</p></body></html>`,
    });

    const result = await fetchAwsStatus();
    expect(result.status).toBe("operational");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchAwsStatus();
    expect(result.status).toBe("unknown");
  });
});
