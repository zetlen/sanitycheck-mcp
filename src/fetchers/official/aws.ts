// src/fetchers/official/aws.ts
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:aws");
const STATUS_URL = "https://health.aws.amazon.com/health/status";
const DATA_URL = "https://health.aws.amazon.com/health/status";

export async function fetchAwsStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(DATA_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return makeUnknown(`HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const current = data?.current ?? [];
    log.debug("fetched", { elapsed: Date.now() - start, currentEvents: current.length });

    if (current.length === 0) {
      return {
        name: "AWS",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    // Check severity of current events
    const hasOutage = current.some((e: any) =>
      e.status_text?.toLowerCase().includes("disruption") ||
      e.status_text?.toLowerCase().includes("outage")
    );

    return {
      name: "AWS",
      status: hasOutage ? "outage" : "degraded",
      summary: current.map((e: any) => `${e.service_name}: ${e.summary}`).join("; "),
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "AWS", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
