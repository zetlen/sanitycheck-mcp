// src/fetchers/statuspage.ts
import type {
  ServiceStatus,
  ServiceDetail,
  StatusLevel,
  ComponentStatus,
  Incident,
} from "../types.js";
import { createLogger } from "../logger.js";

const log = createLogger("fetcher:statuspage");

const INDICATOR_MAP: Record<string, StatusLevel> = {
  none: "operational",
  minor: "degraded",
  major: "outage",
  critical: "outage",
};

const COMPONENT_STATUS_MAP: Record<string, StatusLevel> = {
  operational: "operational",
  degraded_performance: "degraded",
  partial_outage: "degraded",
  major_outage: "outage",
  under_maintenance: "degraded",
};

export function parseStatuspageStatus(
  data: any,
  serviceName: string,
  sourceUrl: string,
): ServiceStatus {
  const indicator = data?.status?.indicator ?? "unknown";
  const description = data?.status?.description ?? "Unknown";
  const updatedAt = data?.page?.updated_at ?? new Date().toISOString();

  return {
    name: serviceName,
    status: INDICATOR_MAP[indicator] ?? "unknown",
    summary: description,
    updatedAt,
    source: sourceUrl,
  };
}

export function parseStatuspageDetail(
  data: any,
  serviceName: string,
  sourceUrl: string,
): ServiceDetail {
  const base = parseStatuspageStatus(data, serviceName, sourceUrl);

  const components: ComponentStatus[] = (data?.components ?? []).map((c: any) => ({
    name: c.name,
    status: COMPONENT_STATUS_MAP[c.status] ?? "unknown",
    summary: c.description || c.status,
  }));

  const incidents: Incident[] = (data?.incidents ?? []).map((i: any) => ({
    title: i.name,
    status: i.status,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    components: (i.components ?? []).map((c: any) => c.name),
  }));

  return {
    ...base,
    components,
    incidents,
    thirdPartyReports: {},
  };
}

export async function fetchStatuspageSummary(
  baseUrl: string,
  serviceName: string,
  statuspageId?: string,
): Promise<{ status: ServiceStatus; detail: ServiceDetail }> {
  const url = `${baseUrl}/api/v2/summary.json`;
  const start = Date.now();

  const commonHeaders = {
    Accept: "application/json",
    "User-Agent": "sanitycheck-mcp/0.1",
  };

  try {
    const response = await fetch(url, {
      headers: commonHeaders,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("http-error", { serviceName, url, status: response.status });

      // If the vanity URL returned 403/404 and we have a statuspageId, try the canonical URL
      if ((response.status === 403 || response.status === 404) && statuspageId) {
        const fallbackUrl = `https://${statuspageId}.statuspage.io/api/v2/summary.json`;
        log.debug("trying-fallback", { serviceName, fallbackUrl });
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: commonHeaders,
            signal: AbortSignal.timeout(10_000),
          });
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            log.debug("fetched-fallback", {
              serviceName,
              fallbackUrl,
              elapsed: Date.now() - start,
            });
            const status = parseStatuspageStatus(data, serviceName, baseUrl);
            const detail = parseStatuspageDetail(data, serviceName, baseUrl);
            return { status, detail };
          }
          log.warn("fallback-http-error", {
            serviceName,
            fallbackUrl,
            status: fallbackResponse.status,
          });
        } catch (fallbackErr) {
          log.error("fallback-fetch-error", {
            serviceName,
            fallbackUrl,
            error: String(fallbackErr),
          });
        }
      }

      const unknown = makeUnknown(serviceName, baseUrl, `HTTP ${response.status}`);
      return {
        status: unknown,
        detail: { ...unknown, components: [], incidents: [], thirdPartyReports: {} },
      };
    }

    const data = await response.json();
    log.debug("fetched", { serviceName, url, elapsed: Date.now() - start });

    const status = parseStatuspageStatus(data, serviceName, baseUrl);
    const detail = parseStatuspageDetail(data, serviceName, baseUrl);
    return { status, detail };
  } catch (err) {
    log.error("fetch-error", { serviceName, url, error: String(err), elapsed: Date.now() - start });
    const unknown = makeUnknown(serviceName, baseUrl, String(err));
    return {
      status: unknown,
      detail: { ...unknown, components: [], incidents: [], thirdPartyReports: {} },
    };
  }
}

function makeUnknown(name: string, source: string, reason: string): ServiceStatus {
  return {
    name,
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source,
  };
}
