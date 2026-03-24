// src/fetchers/official/aws.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:aws");
const STATUS_URL = "https://health.aws.amazon.com/health/status";

export async function fetchAwsStatus(): Promise<ServiceStatus> {
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

    const pageText = $("body").text().toLowerCase();

    if (
      pageText.includes("service is operating normally") ||
      pageText.includes("all services are operating normally") ||
      pageText.includes("no known issues")
    ) {
      return {
        name: "AWS",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    if (pageText.includes("service disruption") || pageText.includes("service outage")) {
      return {
        name: "AWS",
        status: "outage",
        summary: "Service disruption reported",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    if (pageText.includes("issue") || pageText.includes("degraded") || pageText.includes("elevated")) {
      return {
        name: "AWS",
        status: "degraded",
        summary: "Issues reported",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    // Default to operational if none of the issue indicators are found
    return {
      name: "AWS",
      status: "operational",
      summary: "All systems operational",
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
    name: "AWS",
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source: STATUS_URL,
  };
}
