// src/fetchers/ai-vibes/aidailycheck.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:aidailycheck");

export interface VibeResult {
  source: string;
  sentiment: string;
  url: string;
}

export async function fetchAiDailyCheck(model: string): Promise<VibeResult | null> {
  const url = "https://aidailycheck.com";

  try {
    const html = await fetchWithBrowser(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract sentiment for the requested model from the page text
    // The site shows voting results like "Genius", "Good", "Bad", "Terrible"
    const modelLower = model.toLowerCase();
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
    const relevant = lines.filter((l) => l.toLowerCase().includes(modelLower));

    const sentiment = relevant.length > 0
      ? relevant.join("; ").slice(0, 200)
      : `No specific data found for "${model}"`;

    return { source: "aidailycheck.com", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
