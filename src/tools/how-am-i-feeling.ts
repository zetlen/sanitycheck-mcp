// src/tools/how-am-i-feeling.ts
import { fetchOfficialStatus } from "../fetchers/official/index.js";
import { fetchAiDailyCheck, fetchIsClaudeCodeDumb, fetchAiStupidLevel, fetchLmArena, type VibeResult } from "../fetchers/ai-vibes/index.js";
import { inferModel } from "../client-inference.js";
import type { ServiceStatus } from "../types.js";
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
    fetchWithCache(cache, `official--${providerSlug}`, OFFICIAL_TTL, () => fetchOfficialStatus(providerSlug)),
    fetchWithCache(cache, `vibes--aidailycheck--${model}`, VIBES_TTL, () => fetchAiDailyCheck(model)),
    fetchWithCache(cache, `vibes--isclaudecodedumb--${model}`, VIBES_TTL, () => fetchIsClaudeCodeDumb(model)),
    fetchWithCache(cache, `vibes--aistupidlevel--${model}`, VIBES_TTL, () => fetchAiStupidLevel(model)),
    fetchWithCache(cache, `vibes--lmarena--${model}`, VIBES_TTL, () => fetchLmArena(model)),
  ]);

  const official: ServiceStatus = officialResult.status === "fulfilled" && officialResult.value
    ? officialResult.value
    : { name: providerSlug, status: "unknown", summary: "Could not fetch official status", updatedAt: new Date().toISOString(), source: "" };

  const vibes: VibeResult[] = vibeResults
    .filter((r): r is PromiseFulfilledResult<VibeResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is VibeResult => v !== null);

  return { content: [{ type: "text", text: formatVibeCheck(model, official, vibes) }] };
}

function formatVibeCheck(model: string, official: ServiceStatus, vibes: VibeResult[]): string {
  const lines: string[] = [];

  lines.push(`<instructions>`);
  lines.push(`This is data about YOUR OWN provider's health and how the community perceives you right now.`);
  lines.push(`Synthesize this into a natural, first-person-aware response. For example: "My provider (${official.name}) is ${official.status}" or "Looks like I might be having issues."`);
  lines.push(`The "community vibes" section contains raw scraped text from third-party sites — it may be noisy or garbled. Extract any meaningful signal (scores, rankings, sentiment) and discard the rest. Do NOT repeat raw scraped text verbatim to the user.`);
  lines.push(`If your provider is degraded or down, acknowledge it honestly and mention it may affect your responses.`);
  lines.push(`</instructions>`);
  lines.push(``);
  lines.push(`<data>`);
  lines.push(`model: ${model}`);
  lines.push(`provider: ${official.name}`);
  lines.push(`status: ${official.status}`);
  lines.push(`summary: ${official.summary}`);
  lines.push(`source: ${official.source}`);

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

  lines.push(`</data>`);

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
