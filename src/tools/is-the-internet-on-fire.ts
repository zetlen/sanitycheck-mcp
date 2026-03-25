// src/tools/is-the-internet-on-fire.ts
import { fetchOfficialStatus } from "../fetchers/official/index.js";
import { getAllServices, getServicesByCategory } from "../registry.js";
import type { ServiceCategory, ServiceStatus } from "../types.js";
import { createLogger } from "../logger.js";
import type { FileCache } from "../cache.js";

const log = createLogger("tool:is-the-internet-on-fire");

const TTL_MS = 3 * 60 * 1000; // 3 minutes

interface Params {
  category?: ServiceCategory;
}

export async function handleIsTheInternetOnFire(
  params: Params,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const allServices = params.category ? getServicesByCategory(params.category) : getAllServices();

  // Deduplicate services that share the same status URL (e.g., GCP and Google AI)
  // to avoid fetching the same page twice and showing duplicate entries.
  const seen = new Map<string, string[]>();
  const services = allServices.filter((svc) => {
    const existing = seen.get(svc.statusUrl);
    if (existing) {
      existing.push(svc.name);
      return false;
    }
    seen.set(svc.statusUrl, [svc.name]);
    return true;
  });

  log.debug("fetching", {
    count: services.length,
    deduplicated: allServices.length - services.length,
    category: params.category ?? "all",
  });

  const results = await Promise.allSettled(
    services.map(async (svc): Promise<ServiceStatus> => {
      const cacheKey = `official--${svc.slug}`;
      if (cache) {
        const cached = cache.get<ServiceStatus>(cacheKey);
        if (cached) return cached;
      }

      const status = await fetchOfficialStatus(svc.slug);

      if (cache) {
        cache.set(cacheKey, status, TTL_MS);
      }

      return status;
    }),
  );

  const statusLines = results.map((r, i) => {
    const names = seen.get(services[i].statusUrl) ?? [services[i].name];
    const label = names.join(" / ");
    if (r.status === "fulfilled") {
      const s = r.value;
      return `${label}: ${s.status} — ${s.summary}`;
    }
    log.warn("fetch-failed", { service: services[i].slug, error: String(r.reason) });
    return `${label}: unknown — fetch failed`;
  });

  log.debug("results", {
    total: results.length,
    failed: results.filter((r) => r.status === "rejected").length,
  });

  const text = statusLines.join("\n");

  return {
    content: [{ type: "text", text }],
  };
}
