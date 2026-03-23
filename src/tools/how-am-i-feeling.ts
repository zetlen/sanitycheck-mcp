// src/tools/how-am-i-feeling.ts
import { fetchOfficialStatus } from "../fetchers/official/index.js";
import { fetchAiDailyCheck, fetchIsClaudeCodeDumb, fetchAiStupidLevel, fetchLmArena, type VibeResult } from "../fetchers/ai-vibes/index.js";
import { inferModel } from "../client-inference.js";
import { STATUS_EMOJI } from "../types.js";
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

  lines.push(`## Vibe Check: ${model}`);
  lines.push("");
  lines.push(`**Official Status (${official.name}):** ${STATUS_EMOJI[official.status]} ${official.summary}`);
  lines.push(`Source: ${official.source}`);

  if (vibes.length > 0) {
    lines.push("");
    lines.push("**Community Vibes:**");
    for (const v of vibes) {
      lines.push(`- ${v.source}: ${v.sentiment} (${v.url})`);
    }
  } else {
    lines.push("");
    lines.push("*No community vibe data available (headless browser may be unavailable)*");
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
