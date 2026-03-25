// src/fetchers/ai-vibes/aistupidlevel.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:aistupidlevel");

const MODEL_URLS: Record<string, string> = {
  claude: "https://aistupidlevel.info",
  gpt: "https://aistupidlevel.info",
  gemini: "https://aistupidlevel.info",
};

export async function fetchAiStupidLevel(model: string): Promise<VibeResult | null> {
  const url = MODEL_URLS[model.toLowerCase()] ?? "https://aistupidlevel.info";

  try {
    const html = await fetchWithBrowser(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract scores and rankings for the requested model
    // The site shows benchmark scores across 9 dimensions
    const modelLower = model.toLowerCase();
    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const relevant = lines
      .filter(
        (l) => l.toLowerCase().includes(modelLower) && /\d/.test(l), // must contain a number (score, rank, etc.)
      )
      .slice(0, 5);

    const sentiment =
      relevant.length > 0
        ? relevant.join("; ").slice(0, 200)
        : `No specific benchmark data found for "${model}"`;

    return { source: "aistupidlevel.info", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
