// src/tools/whats-going-on-with.ts
import { resolveService, type ServiceEntry } from "../registry.js";
import { fetchOfficialDetail } from "../fetchers/official/index.js";
import { fetchDowndetectorReports } from "../fetchers/aggregators/downdetector.js";
import { fetchStatusGatorStatus } from "../fetchers/aggregators/statusgator.js";
import { STATUS_EMOJI } from "../types.js";
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
    return fallbackToDowndetector(params.service, cache);
  }

  const results = await Promise.allSettled(
    matches.map((entry) => fetchServiceDetail(entry, cache))
  );

  const lines: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      lines.push(formatDetail(r.value));
    }
  }

  return { content: [{ type: "text", text: lines.join("\n\n---\n\n") }] };
}

async function fetchServiceDetail(entry: ServiceEntry, cache?: FileCache): Promise<ServiceDetail> {
  const cacheKey = `detail--${entry.slug}`;
  if (cache) {
    const cached = cache.get<ServiceDetail>(cacheKey);
    if (cached) return cached;
  }

  const [detail, dd, sg] = await Promise.allSettled([
    fetchOfficialDetail(entry.slug),
    entry.downdetectorSlug ? fetchDowndetectorReports(entry.downdetectorSlug) : Promise.resolve(null),
    fetchStatusGatorStatus(entry.slug),
  ]);

  const result = detail.status === "fulfilled" ? detail.value : {
    name: entry.name, status: "unknown" as const, summary: "Failed to fetch",
    updatedAt: new Date().toISOString(), source: entry.statusUrl,
    components: [], incidents: [], thirdPartyReports: {},
  };

  if (dd.status === "fulfilled" && dd.value) {
    result.thirdPartyReports.downdetector = {
      reportCount: dd.value.reportCount,
      trend: dd.value.trend,
    };
  }

  if (sg.status === "fulfilled" && sg.value) {
    result.thirdPartyReports.statusgator = {
      status: sg.value.status,
      summary: sg.value.summary,
    };
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
    const text = `"${service}" is not in the known service list, but here's what downdetector.com shows:\n\nReports: ${dd.reportCount}\nTrend: ${dd.trend}\nSource: ${dd.url}`;
    if (cache) cache.set(cacheKey, text, DD_TTL);
    return { content: [{ type: "text", text }] };
  }

  return { content: [{ type: "text", text: `"${service}" is not in the known service list and no Downdetector page was found for it.` }] };
}

function formatDetail(d: ServiceDetail): string {
  const lines: string[] = [];
  lines.push(`${STATUS_EMOJI[d.status]} **${d.name}**: ${d.summary}`);
  lines.push(`Source: ${d.source}`);

  if (d.components.length > 0) {
    lines.push("\nComponents:");
    for (const c of d.components) {
      lines.push(`  ${STATUS_EMOJI[c.status]} ${c.name}: ${c.summary}`);
    }
  }

  if (d.incidents.length > 0) {
    lines.push("\nActive Incidents:");
    for (const i of d.incidents) {
      lines.push(`  - ${i.title} (${i.status}) — updated ${i.updatedAt}`);
      if (i.components.length > 0) {
        lines.push(`    Affecting: ${i.components.join(", ")}`);
      }
    }
  }

  if (d.thirdPartyReports.downdetector) {
    const dd = d.thirdPartyReports.downdetector;
    lines.push(`\nDowndetector: ${dd.reportCount} reports (${dd.trend})`);
  }

  return lines.join("\n");
}
