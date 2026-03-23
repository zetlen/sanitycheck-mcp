// src/fetchers/ai-vibes/lmarena.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:lmarena");

export async function fetchLmArena(model: string): Promise<VibeResult | null> {
  const url = "https://lmarena.ai/?leaderboard=";

  try {
    // LMArena's leaderboard is a heavy SPA — give it extra time
    const html = await fetchWithBrowser(url, undefined, 20_000);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract Elo ratings and rankings
    // The leaderboard shows model names with their Elo scores
    const modelLower = model.toLowerCase();
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);

    // Look for lines that mention the model and contain numbers (Elo scores)
    const relevant = lines.filter((l) => {
      const lower = l.toLowerCase();
      return (lower.includes(modelLower) || lower.includes(modelLower.replace("-", " "))) && /\d{3,4}/.test(l);
    }).slice(0, 3);

    const sentiment = relevant.length > 0
      ? relevant.join("; ").slice(0, 200)
      : `No leaderboard data found for "${model}"`;

    return { source: "lmarena.ai", sentiment, url: "https://lmarena.ai" };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
