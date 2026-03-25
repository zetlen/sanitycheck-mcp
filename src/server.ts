// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleIsTheInternetOnFire } from "./tools/is-the-internet-on-fire.js";
import { handleWhatsGoingOnWith } from "./tools/whats-going-on-with.js";
import { handleHowAmIFeeling } from "./tools/how-am-i-feeling.js";
import { createDefaultCache } from "./cache.js";
import { createLogger } from "./logger.js";

const log = createLogger("server");

export function createServer() {
  const server = new McpServer({
    name: "sanitycheck-mcp",
    version: "0.1.0",
  });

  const cache = createDefaultCache();

  // Lazily read clientInfo from the McpServer's internal state.
  // clientInfo is set during the initialize handshake (after connect but before
  // any tool calls), so reading it at tool-call time is safe.
  function getClientName(): string | null {
    try {
      // Use the public getClientVersion() API on the underlying Server instance.
      const serverAny = server as any;
      const lowLevelServer = serverAny.server;
      if (!lowLevelServer) {
        log.warn("client-info-failed", { reason: "no underlying server instance" });
        return null;
      }
      const clientInfo =
        typeof lowLevelServer.getClientVersion === "function"
          ? lowLevelServer.getClientVersion()
          : (lowLevelServer._clientInfo ?? lowLevelServer._clientVersion);
      if (!clientInfo) {
        log.warn("client-info-failed", {
          reason: "clientInfo not set (handshake may not have completed)",
        });
        return null;
      }
      log.debug("client-info", { clientInfo });
      return clientInfo.name ?? null;
    } catch (err) {
      log.warn("client-info-failed", { reason: String(err) });
      return null;
    }
  }

  server.registerTool(
    "is_the_internet_on_fire",
    {
      description:
        "Check the health of major internet infrastructure and services. Call this when you encounter unexpected API errors, connection timeouts, or degraded responses from cloud services, and you want to know if it's a widespread issue or just local. Also useful when the user asks things like 'is AWS down?' or 'why is everything broken?'\n\nPresenting the results: Lead with the overall picture. If everything is operational, say so briefly — do NOT list every service. Only call out services that are NOT operational or have unknown status.",
      inputSchema: {
        category: z
          .enum(["cloud", "cdn", "devtools", "ai", "comms", "infra"])
          .optional()
          .describe("Filter to a specific category of services. Omit for all."),
      },
    },
    async (params) => {
      return handleIsTheInternetOnFire(params, cache);
    },
  );

  server.registerTool(
    "whats_going_on_with",
    {
      description:
        "Investigate the status of a specific service in detail. Call this when you're seeing problems with a particular service — deploys failing, API returning 500s, git push hanging, npm install timing out — and want to check if that service is having an incident. Accepts any service name (e.g. 'github', 'aws s3', 'vercel', 'npm').\n\nPresenting the results: Synthesize all data sources (official status, components, incidents, Downdetector, StatusGator) into a clear assessment. Lead with active incidents if any exist. If everything is operational, say so briefly. Mention third-party reports if they disagree with the official status.",
      inputSchema: {
        service: z
          .string()
          .describe("The service name to investigate, e.g. 'github', 'aws', 'vercel', 'npm'"),
      },
    },
    async (params) => {
      return handleWhatsGoingOnWith(params, cache);
    },
  );

  server.registerTool(
    "how_am_i_feeling",
    {
      description:
        "Check your own model/provider health, status, and community-reported quality. Use this tool whenever the user asks about your current condition, behavior, responsiveness, or whether something is wrong with you — even if the question is phrased casually or anthropomorphically.\n\nTrigger examples: 'How are you feeling?', 'How are you doing?', 'Are you okay?', 'You seem off today', 'What is wrong with you?', 'Why are you so slow?', 'Are you having a bad day?', 'Are you broken?', 'What\\'s your status?', 'You\\'re being dumb today'.\n\nDecision rule: If the user is asking about you (the assistant/system) rather than a specific external service, prefer this tool. Only skip it if the user is clearly making pure social small talk with no implication of system health or performance.\n\nAlso call this proactively if you notice your own responses are slow, error-prone, unusually weak, or you're struggling with tasks you'd normally handle easily.\n\nPresenting the results: This is about YOUR OWN provider and the local system you're running on. Synthesize it into a natural, self-aware response. The output includes component-level detail and active incidents. Check whether any degraded components or incidents actually affect your core functionality (API, chat completions, model inference). If the only degraded components are unrelated to your operation (e.g. SIP endpoints, DALL-E, billing portal), say the provider has issues but clarify they don't affect you directly. The 'local_system' section shows CPU load, memory pressure, and network latency on the machine running this MCP server — if CPU is pegged, memory is exhausted, or network is slow/failing, mention that as a possible cause of sluggishness independent of provider health. The 'community_vibes' field contains raw scraped text from third-party sites — extract any meaningful signal (scores, rankings, sentiment) but do NOT repeat raw scraped text verbatim.",
      inputSchema: {
        model: z
          .string()
          .optional()
          .describe(
            "The model name to check, e.g. 'claude', 'gpt', 'gemini'. Auto-detected from client info if omitted.",
          ),
      },
    },
    async (params) => {
      return handleHowAmIFeeling(params, getClientName(), cache);
    },
  );

  return server;
}
