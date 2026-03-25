// src/fetchers/ai-vibes/lmarena.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:lmarena");

// Model name variations to search for on the leaderboard
const MODEL_VARIANTS: Record<string, string[]> = {
  claude: ["claude", "claude-4", "claude-3", "sonnet", "opus", "haiku"],
  gpt: ["gpt", "gpt-5", "gpt-4", "o1", "o3", "chatgpt"],
  gemini: ["gemini", "gemini-3", "gemini-2"],
};

export async function fetchLmArena(model: string): Promise<VibeResult | null> {
  const url = "https://lmarena.ai/?leaderboard=";

  try {
    // LMArena's leaderboard is a heavy SPA — give it extra time
    const html = await fetchWithBrowser(url, undefined, 20_000);
    if (!html) return null;

    const $ = cheerio.load(html);
    $("script, style, noscript, svg, nav, header, footer").remove();
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    const modelLower = model.toLowerCase();
    const variants = MODEL_VARIANTS[modelLower] ?? [modelLower];

    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Look for lines with Elo scores (3-4 digit numbers) near model names
    const eloLines: string[] = [];
    for (const variant of variants) {
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (
          lower.includes(variant) &&
          /\d{3,4}/.test(line) &&
          line.length < 150 &&
          line.length > 5
        ) {
          eloLines.push(line.trim());
        }
      }
      if (eloLines.length >= 3) break;
    }

    const unique = [...new Set(eloLines)].slice(0, 3);

    const sentiment =
      unique.length > 0 ? unique.join(" | ") : `No leaderboard data found for "${model}"`;

    return { source: "lmarena.ai", sentiment, url: "https://lmarena.ai" };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
