// src/fetchers/official/fastly.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:fastly");
const STATUS_URL = "https://www.fastlystatus.com";

export async function fetchFastlyStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        // Fastly's StatusCast WAF blocks non-browser User-Agents
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();
    log.debug("fetched", { elapsed: Date.now() - start, size: html.length });

    const pageText = $("body").text().toLowerCase();
    if (pageText.includes("operating normally") || pageText.includes("all systems normal")) {
      return { name: "Fastly", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    if (pageText.includes("unavailable") || pageText.includes("outage") || pageText.includes("disruption")) {
      return { name: "Fastly", status: "outage", summary: "Service disruption reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    if (pageText.includes("degraded") || pageText.includes("maintenance") || pageText.includes("investigating") || pageText.includes("identified")) {
      return { name: "Fastly", status: "degraded", summary: "Issues reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    // Default: assume operational if no incident keywords found
    return { name: "Fastly", status: "operational", summary: "No incidents reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "Fastly", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
