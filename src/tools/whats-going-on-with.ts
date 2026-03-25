// src/tools/whats-going-on-with.ts
import { resolveService, type ServiceEntry } from "../registry.js";
import { fetchOfficialDetail } from "../fetchers/official/index.js";
import { fetchDowndetectorReports } from "../fetchers/aggregators/downdetector.js";
import { fetchStatusGatorStatus } from "../fetchers/aggregators/statusgator.js";
import type { ServiceDetail } from "../types.js";
import type { FileCache } from "../cache.js";
import { createLogger } from "../logger.js";

const log = createLogger("tool:whats-going-on-with");

const OFFICIAL_TTL = 3 * 60 * 1000;
const DD_TTL = 2 * 60 * 1000;

interface Params {
  service: string;
}

export async function handleWhatsGoingOnWith(
  params: Params,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const matches = resolveService(params.service);
  log.debug("resolved", { query: params.service, matches: matches.length });

  if (matches.length === 0) {
    log.debug("no-matches", { query: params.service, fallback: "downdetector" });
    return fallbackToDowndetector(params.service, cache);
  }

  const results = await Promise.allSettled(
    matches.map((entry) => fetchServiceDetail(entry, cache)),
  );

  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      lines.push(formatDetail(r.value));
    } else {
      log.warn("detail-fetch-failed", { service: matches[i].slug, error: String(r.reason) });
    }
  }

  return { content: [{ type: "text", text: lines.join("\n\n") }] };
}

async function fetchServiceDetail(entry: ServiceEntry, cache?: FileCache): Promise<ServiceDetail> {
  const cacheKey = `detail--${entry.slug}`;
  if (cache) {
    const cached = cache.get<ServiceDetail>(cacheKey);
    if (cached) return cached;
  }

  const [detail, dd, sg] = await Promise.allSettled([
    fetchOfficialDetail(entry.slug),
    entry.downdetectorSlug
      ? fetchDowndetectorReports(entry.downdetectorSlug)
      : Promise.resolve(null),
    fetchStatusGatorStatus(entry.slug),
  ]);

  if (detail.status === "rejected") {
    log.warn("official-detail-failed", { slug: entry.slug, error: String(detail.reason) });
  }
  const result =
    detail.status === "fulfilled"
      ? detail.value
      : {
          name: entry.name,
          status: "unknown" as const,
          summary: "Failed to fetch",
          updatedAt: new Date().toISOString(),
          source: entry.statusUrl,
          components: [],
          incidents: [],
          thirdPartyReports: {},
        };

  if (dd.status === "fulfilled" && dd.value) {
    result.thirdPartyReports.downdetector = {
      reportCount: dd.value.reportCount,
      trend: dd.value.trend,
    };
  } else if (dd.status === "rejected") {
    log.warn("downdetector-failed", { slug: entry.slug, error: String(dd.reason) });
  }

  if (sg.status === "fulfilled" && sg.value) {
    result.thirdPartyReports.statusgator = {
      status: sg.value.status,
      summary: sg.value.summary,
    };
  } else if (sg.status === "rejected") {
    log.warn("statusgator-failed", { slug: entry.slug, error: String(sg.reason) });
  }

  if (cache) cache.set(cacheKey, result, OFFICIAL_TTL);
  return result;
}

async function fallbackToDowndetector(
  service: string,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const slug = service.toLowerCase().replace(/\s+/g, "-");
  const cacheKey = `dd--${slug}`;

  if (cache) {
    const cached = cache.get<any>(cacheKey);
    if (cached) return { content: [{ type: "text", text: cached }] };
  }

  const dd = await fetchDowndetectorReports(slug);
  if (dd) {
    const text = [
      `service: ${service} (not in tracked list, Downdetector only)`,
      `downdetector_reports: ${dd.reportCount}`,
      `trend: ${dd.trend}`,
      `source: ${dd.url}`,
    ].join("\n");
    if (cache) cache.set(cacheKey, text, DD_TTL);
    return { content: [{ type: "text", text }] };
  }

  return {
    content: [
      {
        type: "text",
        text: `"${service}" is not in the tracked service list and no Downdetector data was found.`,
      },
    ],
  };
}

function formatDetail(d: ServiceDetail): string {
  const lines: string[] = [];
  lines.push(`service: ${d.name}`);
  lines.push(`status: ${d.status}`);
  lines.push(`summary: ${d.summary}`);
  lines.push(`source: ${d.source}`);

  if (d.components.length > 0) {
    // Only include non-operational components to reduce noise
    const degraded = d.components.filter((c) => c.status !== "operational");
    if (degraded.length > 0) {
      lines.push(`degraded_components:`);
      for (const c of degraded) {
        lines.push(`  - ${c.name}: ${c.status} — ${c.summary}`);
      }
    } else {
      lines.push(`components: all ${d.components.length} operational`);
    }
  }

  if (d.incidents.length > 0) {
    lines.push(`active_incidents:`);
    for (const i of d.incidents) {
      lines.push(`  - title: ${i.title}`);
      lines.push(`    status: ${i.status}`);
      lines.push(`    updated: ${i.updatedAt}`);
      if (i.components.length > 0) {
        lines.push(`    affecting: ${i.components.join(", ")}`);
      }
    }
  }

  if (d.thirdPartyReports.downdetector) {
    const dd = d.thirdPartyReports.downdetector;
    lines.push(`downdetector: ${dd.reportCount} reports (trend: ${dd.trend})`);
  }

  if (d.thirdPartyReports.statusgator) {
    const sg = d.thirdPartyReports.statusgator;
    lines.push(`statusgator: ${sg.status} — ${sg.summary}`);
  }

  return lines.join("\n");
}
