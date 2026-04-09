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
  const start = Date.now();

  const commonHeaders = {
    Accept: "application/json",
    "User-Agent": "sanitycheck-mcp/0.1",
  };

  try {
    const [statusResult, componentsResult, incidentsResult] = await Promise.allSettled([
      fetchStatuspageEndpoint(baseUrl, "status.json", serviceName, statuspageId, commonHeaders),
      fetchStatuspageEndpoint(baseUrl, "components.json", serviceName, statuspageId, commonHeaders),
      fetchStatuspageEndpoint(
        baseUrl,
        "incidents/unresolved.json",
        serviceName,
        statuspageId,
        commonHeaders,
      ),
    ]);

    if (statusResult.status === "rejected") {
      throw statusResult.reason;
    }

    if (componentsResult.status === "rejected") {
      log.warn("components-fetch-error", {
        serviceName,
        error: String(componentsResult.reason),
      });
    }

    if (incidentsResult.status === "rejected") {
      log.warn("incidents-fetch-error", {
        serviceName,
        error: String(incidentsResult.reason),
      });
    }

    const page =
      statusResult.value?.page ??
      (componentsResult.status === "fulfilled" ? componentsResult.value?.page : undefined) ??
      (incidentsResult.status === "fulfilled" ? incidentsResult.value?.page : undefined);

    const data = {
      page,
      status: statusResult.value?.status,
      components:
        componentsResult.status === "fulfilled" ? (componentsResult.value?.components ?? []) : [],
      incidents:
        incidentsResult.status === "fulfilled" ? (incidentsResult.value?.incidents ?? []) : [],
    };

    log.debug("fetched", {
      serviceName,
      elapsed: Date.now() - start,
      components: data.components.length,
      incidents: data.incidents.length,
    });

    const status = parseStatuspageStatus(data, serviceName, baseUrl);
    const detail = parseStatuspageDetail(data, serviceName, baseUrl);
    return { status, detail };
  } catch (err) {
    log.error("fetch-error", {
      serviceName,
      baseUrl,
      error: String(err),
      elapsed: Date.now() - start,
    });
    const unknown = makeUnknown(serviceName, baseUrl, String(err));
    return {
      status: unknown,
      detail: { ...unknown, components: [], incidents: [], thirdPartyReports: {} },
    };
  }
}

async function fetchStatuspageEndpoint(
  baseUrl: string,
  endpoint: string,
  serviceName: string,
  statuspageId: string | undefined,
  headers: Record<string, string>,
): Promise<any> {
  const urls = [`${baseUrl}/api/v2/${endpoint}`];
  if (statuspageId) {
    urls.push(`https://${statuspageId}.statuspage.io/api/v2/${endpoint}`);
  }

  let lastError = "Unknown fetch error";

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        if (index > 0) {
          log.debug("fetched-fallback", { serviceName, endpoint, url });
        }
        return await response.json();
      }

      log.warn("http-error", { serviceName, endpoint, url, status: response.status });
      lastError = `HTTP ${response.status}`;

      if (response.status !== 403 && response.status !== 404) {
        break;
      }
    } catch (err) {
      lastError = String(err);
      log.error("endpoint-fetch-error", { serviceName, endpoint, url, error: lastError });
    }
  }

  throw new Error(`${endpoint}: ${lastError}`);
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
