// src/fetchers/official/slack.ts
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:slack");
const STATUS_URL = "https://slack-status.com";
const API_URL = "https://slack-status.com/api/v2.0.0/current";

export async function fetchSlackStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "sanitycheck-mcp/0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return makeUnknown(`HTTP ${response.status}`);
    }

    const data = await response.json() as { status: string; active_incidents: any[] };
    log.debug("fetched", { elapsed: Date.now() - start, status: data.status });

    if (data.status === "ok" && (!data.active_incidents || data.active_incidents.length === 0)) {
      return {
        name: "Slack",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    const incidents = data.active_incidents ?? [];
    const hasOutage = incidents.some((i: any) =>
      i.type?.toLowerCase().includes("outage") ||
      i.title?.toLowerCase().includes("outage")
    );

    return {
      name: "Slack",
      status: hasOutage ? "outage" : "degraded",
      summary: incidents.map((i: any) => i.title ?? i.type ?? "Incident").join("; ") || "Active incidents reported",
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
    name: "Slack",
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source: STATUS_URL,
  };
}
