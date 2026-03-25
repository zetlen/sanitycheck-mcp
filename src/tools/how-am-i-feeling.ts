// src/tools/how-am-i-feeling.ts
import { fetchOfficialDetail } from "../fetchers/official/index.js";
import { fetchAiDailyCheck, fetchIsClaudeCodeDumb, fetchAiStupidLevel, fetchLmArena, type VibeResult } from "../fetchers/ai-vibes/index.js";
import { inferModel } from "../client-inference.js";
import type { ServiceDetail } from "../types.js";
import type { FileCache } from "../cache.js";
import { createLogger } from "../logger.js";

const log = createLogger("tool:how-am-i-feeling");

const MODEL_TO_PROVIDER: Record<string, string> = {
  claude: "anthropic",
  gpt: "openai",
  gemini: "google-ai",
  chatgpt: "openai",
};

const OFFICIAL_TTL = 3 * 60 * 1000;
const VIBES_TTL = 5 * 60 * 1000;

interface Params {
  model?: string;
}

export async function handleHowAmIFeeling(
  params: Params,
  clientName: string | null,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const model = params.model?.toLowerCase() || inferModel(clientName ?? undefined);

  if (!model) {
    log.warn("no-model", { clientName, reason: "could not auto-detect model and no model parameter provided" });
    return {
      content: [{
        type: "text",
        text: "I'd love to check on that, but I'm not sure who's asking! Could you tell me which model you are? Pass a `model` parameter like \"claude\", \"gpt\", or \"gemini\".",
      }],
    };
  }

  log.debug("checking", { model, clientName });

  const providerSlug = MODEL_TO_PROVIDER[model] ?? model;

  // Fetch official status + all vibes in parallel
  const [officialResult, ...vibeResults] = await Promise.allSettled([
    fetchWithCache(cache, `detail--${providerSlug}`, OFFICIAL_TTL, () => fetchOfficialDetail(providerSlug)),
    fetchWithCache(cache, `vibes--aidailycheck--${model}`, VIBES_TTL, () => fetchAiDailyCheck(model)),
    fetchWithCache(cache, `vibes--isclaudecodedumb--${model}`, VIBES_TTL, () => fetchIsClaudeCodeDumb(model)),
    fetchWithCache(cache, `vibes--aistupidlevel--${model}`, VIBES_TTL, () => fetchAiStupidLevel(model)),
    fetchWithCache(cache, `vibes--lmarena--${model}`, VIBES_TTL, () => fetchLmArena(model)),
  ]);

  const official: ServiceDetail = officialResult.status === "fulfilled" && officialResult.value
    ? officialResult.value
    : { name: providerSlug, status: "unknown", summary: "Could not fetch official status", updatedAt: new Date().toISOString(), source: "", components: [], incidents: [], thirdPartyReports: {} };

  if (officialResult.status === "rejected") {
    log.warn("official-fetch-failed", { providerSlug, error: String(officialResult.reason) });
  }

  const vibes: VibeResult[] = [];
  const vibeNames = ["aidailycheck", "isclaudecodedumb", "aistupidlevel", "lmarena"];
  for (let i = 0; i < vibeResults.length; i++) {
    const r = vibeResults[i];
    if (r.status === "fulfilled" && r.value) {
      vibes.push(r.value);
    } else if (r.status === "rejected") {
      log.warn("vibe-fetch-failed", { source: vibeNames[i], model, error: String(r.reason) });
    }
  }

  log.debug("results", { model, officialStatus: official.status, vibeCount: vibes.length });
  return { content: [{ type: "text", text: formatSanityCheck(model, official, vibes) }] };
}

function formatSanityCheck(model: string, official: ServiceDetail, vibes: VibeResult[]): string {
  const lines: string[] = [];

  lines.push(`model: ${model}`);
  lines.push(`provider: ${official.name}`);
  lines.push(`status: ${official.status}`);
  lines.push(`summary: ${official.summary}`);
  lines.push(`source: ${official.source}`);

  const degraded = official.components.filter((c) => c.status !== "operational");
  if (degraded.length > 0) {
    lines.push(``);
    lines.push(`degraded_components:`);
    for (const c of degraded) {
      lines.push(`- ${c.name}: ${c.status} — ${c.summary}`);
    }
  }

  if (official.incidents.length > 0) {
    lines.push(``);
    lines.push(`active_incidents:`);
    for (const inc of official.incidents) {
      lines.push(`- title: ${inc.title}`);
      lines.push(`  status: ${inc.status}`);
      lines.push(`  updated: ${inc.updatedAt}`);
      if (inc.components.length > 0) {
        lines.push(`  affecting: ${inc.components.join(", ")}`);
      }
    }
  }

  if (vibes.length > 0) {
    lines.push(``);
    lines.push(`community_vibes:`);
    for (const v of vibes) {
      lines.push(`- source: ${v.source}`);
      lines.push(`  url: ${v.url}`);
      lines.push(`  raw_sentiment: ${v.sentiment}`);
    }
  } else {
    lines.push(``);
    lines.push(`community_vibes: unavailable (headless browser not running)`);
  }

  return lines.join("\n");
}

async function fetchWithCache<T>(
  cache: FileCache | undefined,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (cache) {
    const cached = cache.get<T>(key);
    if (cached) return cached;
  }
  const result = await fetcher();
  if (cache && result) cache.set(key, result, ttl);
  return result;
}
