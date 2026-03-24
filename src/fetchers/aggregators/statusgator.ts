// src/fetchers/aggregators/statusgator.ts
import * as cheerio from "cheerio";
import type { StatusLevel } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:statusgator");

export interface StatusGatorResult {
  status: StatusLevel;
  summary: string;
}

export async function fetchStatusGatorStatus(slug: string): Promise<StatusGatorResult | null> {
  const url = `https://statusgator.com/services/${slug}`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; sanitycheck-mcp/0.1)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("http-error", { slug, status: response.status, elapsed: Date.now() - start });
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { slug, size: html.length, elapsed: Date.now() - start });

    const pageText = $("body").text().toLowerCase();
    let status: StatusLevel = "unknown";
    let summary = "Unable to determine status";

    if (pageText.includes("operational") && !pageText.includes("not operational")) {
      status = "operational";
      summary = "All systems operational";
    } else if (pageText.includes("outage") || pageText.includes("major")) {
      status = "outage";
      summary = "Service outage reported";
    } else if (pageText.includes("degraded") || pageText.includes("partial") || pageText.includes("minor")) {
      status = "degraded";
      summary = "Degraded performance reported";
    }

    return { status, summary };
  } catch (err) {
    log.error("fetch-error", { slug, error: String(err), elapsed: Date.now() - start });
    return null;
  }
}
