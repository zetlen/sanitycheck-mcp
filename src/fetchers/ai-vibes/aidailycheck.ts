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
    $("script, style, noscript, svg, nav, header, footer").remove();
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    const modelLower = model.toLowerCase();

    // Look for vote category patterns: "Genius 45%", "Good 30%", "Bad 15%", "Terrible 10%"
    const votePattern = /(?:genius|good|bad|terrible|amazing|awful)\s*[:\s]*\d+\s*%/gi;
    const votes = pageText.match(votePattern) ?? [];

    // Look for score patterns near the model name
    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const scoreLine = lines.find(
      (l) => l.toLowerCase().includes(modelLower) && /\d+\s*%/.test(l) && l.length < 100, // skip nav/junk lines
    );

    let sentiment: string;
    if (votes.length > 0) {
      sentiment = `Today's votes: ${votes.join(", ")}`;
      if (scoreLine) sentiment += ` | ${scoreLine.trim()}`;
    } else if (scoreLine) {
      sentiment = scoreLine.trim();
    } else {
      sentiment = `No vote data found for "${model}"`;
    }

    return { source: "aidailycheck.com", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
