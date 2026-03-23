// test/fetchers/official/pagerduty.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPagerDutyStatus } from "../../../src/fetchers/official/pagerduty.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeHtmlWithInlineJson = (headline: string) => `
<html>
<head></head>
<body>
  <script id="data" type="application/json">${JSON.stringify({
  layout: {
    layout_settings: {
      statusPage: {
        globalStatusHeadline: headline,
      },
    },
  },
})}</script>
</body>
</html>`;

describe("PagerDuty fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns operational when headline says 'running smoothly'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => makeHtmlWithInlineJson("All Systems Running Smoothly"),
    });

    const result = await fetchPagerDutyStatus();
    expect(result.name).toBe("PagerDuty");
    expect(result.status).toBe("operational");
    expect(result.summary).toBe("All Systems Running Smoothly");
  });

  it("returns operational when headline says 'operational'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => makeHtmlWithInlineJson("All Systems Operational"),
    });

    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("operational");
  });

  it("returns outage when headline mentions outage", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => makeHtmlWithInlineJson("Major Service Outage"),
    });

    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("outage");
  });

  it("returns degraded when headline indicates partial issues", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => makeHtmlWithInlineJson("Some Systems Experiencing Delays"),
    });

    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("degraded");
  });

  it("falls back to page text scan when no inline JSON found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body><p>All systems operational</p></body></html>`,
    });

    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("operational");
  });

  it("returns unknown on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("unknown");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchPagerDutyStatus();
    expect(result.status).toBe("unknown");
  });
});
