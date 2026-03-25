// src/fetchers/official/gitlab.ts
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:gitlab");
const STATUS_URL = "https://status.gitlab.com";
const STATUS_IO_API = "https://api.status.io/1.0/status/5b36dc6502d06804c08349f7";

// status.io status codes:
// 100 = Operational
// 300 = Degraded Performance
// 400 = Partial Service Disruption
// 500 = Service Disruption
// 600 = Security Event

export async function fetchGitLabStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_IO_API, {
      headers: {
        Accept: "application/json",
        "User-Agent": "sanitycheck-mcp/0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const data = (await response.json()) as any;
    log.debug("fetched", { elapsed: Date.now() - start });

    const overall = data?.result?.status_overall;
    if (!overall) return makeUnknown("Unexpected API response");

    const statusCode = overall.status_code;
    const statusText = overall.status ?? "Unknown";
    const updatedAt = overall.updated ?? new Date().toISOString();

    let status: ServiceStatus["status"];
    if (statusCode === 100) {
      status = "operational";
    } else if (statusCode >= 500) {
      status = "outage";
    } else if (statusCode >= 300) {
      status = "degraded";
    } else {
      status = "unknown";
    }

    return {
      name: "GitLab",
      status,
      summary: statusText,
      updatedAt,
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return {
    name: "GitLab",
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source: STATUS_URL,
  };
}
