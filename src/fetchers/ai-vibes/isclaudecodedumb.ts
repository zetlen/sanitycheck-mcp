// src/fetchers/ai-vibes/isclaudecodedumb.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:isclaudecodedumb");

export async function fetchIsClaudeCodeDumb(model: string): Promise<VibeResult | null> {
  // This site is specifically about Claude Code — only relevant for claude
  if (!model.toLowerCase().includes("claude")) {
    return null;
  }

  const url = "https://www.isclaudecodedumb.today/";
  try {
    const html = await fetchWithBrowser(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    $("script, style, noscript, svg, nav, header, footer").remove();
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Look for vote counts and verdicts: "Yes 234", "No 567", percentages
    const yesMatch = pageText.match(/\byes\b[:\s]*(\d+)/i);
    const noMatch = pageText.match(/\bno\b[:\s]*(\d+)/i);
    const pctMatch = pageText.match(/(\d+(?:\.\d+)?)\s*%/);

    const parts: string[] = [];
    if (yesMatch && noMatch) {
      const yes = parseInt(yesMatch[1], 10);
      const no = parseInt(noMatch[1], 10);
      const total = yes + no;
      const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
      parts.push(`${yesPct}% say dumb (${yes} yes, ${no} no, ${total} total votes)`);
    } else if (pctMatch) {
      parts.push(`${pctMatch[1]}% say dumb`);
    }

    // Look for a verdict/headline
    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const verdict = lines.find(
      (l) => /dumb|smart|verdict|today/i.test(l) && l.length < 80 && l.length > 5,
    );
    if (verdict) parts.push(verdict);

    const sentiment = parts.length > 0 ? parts.join(" — ") : "Could not parse vote results";

    return { source: "isclaudecodedumb.today", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
