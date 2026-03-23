// src/fetchers/official/azure.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:azure");
const STATUS_URL = "https://status.azure.com/en-us/status";

export async function fetchAzureStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_URL, {
      headers: { Accept: "text/html", "User-Agent": "vibecheck-mcp/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { elapsed: Date.now() - start, size: html.length });

    // Azure status page uses icons/classes to indicate status
    // Look for non-good status indicators
    const issues = $(".status-icon--unhealthy, .status-icon--warning, .status-icon--information").length;

    if (issues === 0) {
      return { name: "Azure", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }

    // Extract issue summaries from the page
    const summaryText = $(".region-status-summary, .status-description").first().text().trim() || `${issues} service(s) reporting issues`;
    return {
      name: "Azure",
      status: issues > 3 ? "outage" : "degraded",
      summary: summaryText.slice(0, 200),
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "Azure", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
