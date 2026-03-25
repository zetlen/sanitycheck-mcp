// src/fetchers/official/gcp.ts
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:gcp");
const STATUS_URL = "https://status.cloud.google.com/";
const INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";

export async function fetchGcpStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(INCIDENTS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const incidents = (await response.json()) as any[];
    log.debug("fetched", { elapsed: Date.now() - start, incidents: incidents.length });

    // Filter to active (non-resolved) incidents
    const active = incidents.filter(
      (i: any) =>
        i.most_recent_update?.status !== "RESOLVED" &&
        // Only recent incidents (last 24h)
        new Date(i.begin).getTime() > Date.now() - 86_400_000,
    );

    if (active.length === 0) {
      return {
        name: "GCP",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    const hasOutage = active.some((i: any) => i.severity === "high");
    return {
      name: "GCP",
      status: hasOutage ? "outage" : "degraded",
      summary: active
        .map((i: any) => `${i.service_name}: ${i.external_desc}`)
        .join("; ")
        .slice(0, 200),
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
    name: "GCP",
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source: STATUS_URL,
  };
}
