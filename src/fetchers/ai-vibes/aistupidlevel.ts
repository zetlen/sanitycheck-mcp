// src/fetchers/ai-vibes/aistupidlevel.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:aistupidlevel");

export async function fetchAiStupidLevel(model: string): Promise<VibeResult | null> {
  const url = "https://aistupidlevel.info";

  try {
    const html = await fetchWithBrowser(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    $("script, style, noscript, svg, nav, header, footer").remove();
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    const modelLower = model.toLowerCase();

    // Look for score patterns: "Score: 85/100", "85 points", "performance: 92%"
    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const scoreLines = lines.filter((l) => {
      const lower = l.toLowerCase();
      return (
        lower.includes(modelLower) &&
        /\d/.test(l) &&
        l.length < 120 && // skip junk
        l.length > 5 && // skip single numbers
        !/^[A-Z]{2,}/.test(l) // skip nav items like "STUPIDMETERDASHBOARD..."
      );
    });

    // Also look for alert-style messages about the model
    const alerts = lines.filter((l) => {
      const lower = l.toLowerCase();
      return (
        lower.includes(modelLower) &&
        /drop|surge|alert|critical|performance|improved/i.test(l) &&
        l.length < 150
      );
    });

    const relevant = [...new Set([...scoreLines, ...alerts])].slice(0, 3);

    const sentiment =
      relevant.length > 0 ? relevant.join(" | ") : `No benchmark data found for "${model}"`;

    return { source: "aistupidlevel.info", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
