// src/fetchers/official/index.ts
import { SERVICES } from "../../registry.js";
import { fetchStatuspageSummary } from "../statuspage.js";
import type { ServiceStatus, ServiceDetail } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:official");

function makeUnknownStatus(name: string, reason: string): ServiceStatus {
  return {
    name,
    status: "unknown",
    summary: reason,
    updatedAt: new Date().toISOString(),
    source: "",
  };
}

function makeUnknownDetail(name: string, reason: string): ServiceDetail {
  return {
    ...makeUnknownStatus(name, reason),
    components: [],
    incidents: [],
    thirdPartyReports: {},
  };
}

export async function fetchOfficialStatus(slug: string): Promise<ServiceStatus> {
  const entry = SERVICES.find((s) => s.slug === slug);
  if (!entry) {
    return makeUnknownStatus(slug, `Unknown service: ${slug}`);
  }

  // Services with Statuspage use the generic fetcher
  if (entry.statuspageId) {
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name);
    return result.status;
  }

  // Non-Statuspage services (AWS, GCP, Azure, Akamai, Google AI)
  // return unknown for now — custom fetchers to be implemented in Task 9
  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownStatus(entry.name, "Custom status page — fetcher not yet implemented");
}

export async function fetchOfficialDetail(slug: string): Promise<ServiceDetail> {
  const entry = SERVICES.find((s) => s.slug === slug);
  if (!entry) {
    return makeUnknownDetail(slug, `Unknown service: ${slug}`);
  }

  if (entry.statuspageId) {
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name);
    return result.detail;
  }

  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownDetail(entry.name, "Custom status page — fetcher not yet implemented");
}
