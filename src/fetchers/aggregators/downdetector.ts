// src/fetchers/aggregators/downdetector.ts
import * as cheerio from "cheerio";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:downdetector");

export interface DowndetectorReport {
  source: "downdetector";
  reportCount: number;
  trend: "rising" | "stable" | "falling";
  url: string;
}

export async function fetchDowndetectorReports(slug: string): Promise<DowndetectorReport | null> {
  const url = `https://downdetector.com/status/${slug}/`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; vibecheck-mcp/0.1)",
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

    // Downdetector's HTML structure may change — this is best-effort parsing
    // Look for report count indicators in the page
    const reportText = $(".text-2xl").first().text().trim();
    const reportCount = parseInt(reportText, 10) || 0;

    return {
      source: "downdetector",
      reportCount,
      trend: "stable", // Trend detection would need historical comparison; default to stable
      url,
    };
  } catch (err) {
    log.error("fetch-error", { slug, error: String(err), elapsed: Date.now() - start });
    return null;
  }
}
