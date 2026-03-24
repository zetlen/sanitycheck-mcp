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
  const services = params.category
    ? getServicesByCategory(params.category)
    : getAllServices();

  log.debug("fetching", { count: services.length, category: params.category ?? "all" });

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
    })
  );

  const statusLines = results.map((r) => {
    if (r.status === "fulfilled") {
      const s = r.value;
      return `${s.name}: ${s.status} — ${s.summary}`;
    }
    return `unknown: fetch failed`;
  });

  const text = statusLines.join("\n");

  return {
    content: [{ type: "text", text }],
  };
}
