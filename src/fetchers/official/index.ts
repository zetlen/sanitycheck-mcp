// src/fetchers/official/index.ts
import { SERVICES } from "../../registry.js";
import { fetchStatuspageSummary } from "../statuspage.js";
import type { ServiceStatus, ServiceDetail } from "../../types.js";
import { createLogger } from "../../logger.js";
import { fetchAwsStatus } from "./aws.js";
import { fetchGcpStatus } from "./gcp.js";
import { fetchAzureStatus } from "./azure.js";
import { fetchAkamaiStatus } from "./akamai.js";
import { fetchSlackStatus } from "./slack.js";
import { fetchPagerDutyStatus } from "./pagerduty.js";
import { fetchFastlyStatus } from "./fastly.js";
import { fetchGitLabStatus } from "./gitlab.js";

const log = createLogger("fetcher:official");

const CUSTOM_FETCHERS: Record<string, () => Promise<ServiceStatus>> = {
  aws: fetchAwsStatus,
  gcp: fetchGcpStatus,
  azure: fetchAzureStatus,
  akamai: fetchAkamaiStatus,
  slack: fetchSlackStatus,
  pagerduty: fetchPagerDutyStatus,
  fastly: fetchFastlyStatus,
  gitlab: fetchGitLabStatus,
  "google-ai": fetchGcpStatus, // Google AI uses the same GCP status endpoint
};

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
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name, entry.statuspageId);
    return result.status;
  }

  // Non-Statuspage services — dispatch to custom fetchers
  if (CUSTOM_FETCHERS[slug]) {
    return CUSTOM_FETCHERS[slug]();
  }

  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownStatus(entry.name, "Custom status page — fetcher not yet implemented");
}

export async function fetchOfficialDetail(slug: string): Promise<ServiceDetail> {
  const entry = SERVICES.find((s) => s.slug === slug);
  if (!entry) {
    return makeUnknownDetail(slug, `Unknown service: ${slug}`);
  }

  if (entry.statuspageId) {
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name, entry.statuspageId);
    return result.detail;
  }

  // Non-Statuspage services — dispatch to custom fetchers for basic status
  if (CUSTOM_FETCHERS[slug]) {
    const status = await CUSTOM_FETCHERS[slug]();
    return { ...status, components: [], incidents: [], thirdPartyReports: {} };
  }

  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownDetail(entry.name, "Custom status page — fetcher not yet implemented");
}
