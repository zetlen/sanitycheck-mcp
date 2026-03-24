// src/fetchers/official/pagerduty.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:pagerduty");
const STATUS_URL = "https://status.pagerduty.com";

export async function fetchPagerDutyStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_URL, {
      headers: {
        Accept: "text/html",
        "User-Agent": "sanitycheck-mcp/0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return makeUnknown(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { elapsed: Date.now() - start, size: html.length });

    // Look for inline JSON in <script id="data" type="application/json">
    const scriptContent = $('script#data[type="application/json"]').html();
    if (scriptContent) {
      try {
        const data = JSON.parse(scriptContent);
        const headline: string | undefined =
          data?.layout?.layout_settings?.statusPage?.globalStatusHeadline;
        if (headline) {
          const lc = headline.toLowerCase();
          if (lc.includes("running smoothly") || lc.includes("operational") || lc.includes("all systems")) {
            return {
              name: "PagerDuty",
              status: "operational",
              summary: headline,
              updatedAt: new Date().toISOString(),
              source: STATUS_URL,
            };
          }
          const hasOutage = lc.includes("outage") || lc.includes("disruption");
          return {
            name: "PagerDuty",
            status: hasOutage ? "outage" : "degraded",
            summary: headline,
            updatedAt: new Date().toISOString(),
            source: STATUS_URL,
          };
        }
      } catch (parseErr) {
        log.warn("json-parse-error", { error: String(parseErr) });
      }
    }

    // Fallback: scan page text for status indicators
    const pageText = $("body").text().toLowerCase();
    if (pageText.includes("all systems operational") || pageText.includes("running smoothly")) {
      return {
        name: "PagerDuty",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }
    if (pageText.includes("outage") || pageText.includes("disruption")) {
      return {
        name: "PagerDuty",
        status: "outage",
        summary: "Service disruption reported",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    return {
      name: "PagerDuty",
      status: "degraded",
      summary: "Issues reported",
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return {
    name: "PagerDuty",
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source: STATUS_URL,
  };
}
