// src/fetchers/ai-vibes/isclaudecodedumb.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:isclaudecodedumb");

export async function fetchIsClaudeCodeDumb(model: string): Promise<VibeResult | null> {
  // This site is specifically about Claude Code — only relevant for claude
  if (!model.toLowerCase().includes("claude")) {
    return { source: "isclaudecodedumb.today", sentiment: "N/A (Claude-only tracker)", url: "https://www.isclaudecodedumb.today/" };
  }

  const url = "https://www.isclaudecodedumb.today/";
  try {
    const html = await fetchWithBrowser(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract the main verdict and vote counts
    // Look for patterns like "Yes/No" verdicts, percentages, vote counts
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
    const relevant = lines.filter((l) =>
      /dumb|smart|yes|no|vote|percent|%|\d+/i.test(l)
    ).slice(0, 5);

    const sentiment = relevant.length > 0
      ? relevant.join("; ").slice(0, 200)
      : "Could not parse vote results";

    return { source: "isclaudecodedumb.today", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
