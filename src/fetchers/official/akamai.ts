// src/fetchers/official/akamai.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:akamai");
const STATUS_URL = "https://www.akamaistatus.com";

export async function fetchAkamaiStatus(): Promise<ServiceStatus> {
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

    const pageText = $("body").text().toLowerCase();
    if (pageText.includes("all systems operational") || pageText.includes("no issues")) {
      return { name: "Akamai", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    if (pageText.includes("major") || pageText.includes("outage")) {
      return { name: "Akamai", status: "outage", summary: "Service disruption reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    return { name: "Akamai", status: "degraded", summary: "Issues reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "Akamai", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
