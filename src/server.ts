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
    name: "vibecheck-mcp",
    version: "0.1.0",
  });

  const cache = createDefaultCache();

  // Lazily read clientInfo from the McpServer's internal state.
  // clientInfo is set during the initialize handshake (after connect but before
  // any tool calls), so reading it at tool-call time is safe.
  function getClientName(): string | null {
    try {
      // The underlying Server instance stores clientInfo as _clientVersion
      // after the initialize handshake. Access it lazily at tool-call time.
      const serverAny = server as any;
      const clientInfo = serverAny.server?._clientInfo ?? serverAny.server?._clientVersion;
      if (clientInfo) {
        log.debug("client-info", { clientInfo });
        return clientInfo.name ?? null;
      }
    } catch {}
    return null;
  }

  server.registerTool(
    "is_the_internet_on_fire",
    {
      description: "Check the health of major internet infrastructure and services. Call this when you encounter unexpected API errors, connection timeouts, or degraded responses from cloud services, and you want to know if it's a widespread issue or just local. Also useful when the user asks things like 'is AWS down?' or 'why is everything broken?' Returns a traffic-light rollup of AWS, GCP, Azure, GitHub, Cloudflare, and other major platforms.",
      inputSchema: {
        category: z.enum(["cloud", "cdn", "devtools", "ai", "comms", "infra"]).optional()
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
      description: "Investigate the status of a specific service in detail. Call this when you're seeing problems with a particular service — deploys failing, API returning 500s, git push hanging, npm install timing out — and want to check if that service is having an incident. Accepts any service name (e.g. 'github', 'aws s3', 'vercel', 'npm'). Returns active incidents, affected components, and user-reported outage volume.",
      inputSchema: {
        service: z.string().describe("The service name to investigate, e.g. 'github', 'aws', 'vercel', 'npm'"),
      },
    },
    async (params) => {
      return handleWhatsGoingOnWith(params, cache);
    },
  );

  server.registerTool(
    "how_am_i_feeling",
    {
      description: "Check your own model provider's health and community-reported quality. Call this when you notice your own responses are slow, your reasoning feels off, you're making unusual mistakes, or the user says things like 'what is wrong with you?', 'you're being dumb today', 'are you having a bad day?', or 'why are you so slow?' Also call this proactively if you're producing unexpected errors or struggling with tasks you'd normally handle easily. Returns both official provider status and third-party community sentiment about current AI model quality.",
      inputSchema: {
        model: z.string().optional()
          .describe("The model name to check, e.g. 'claude', 'gpt', 'gemini'. Auto-detected from client info if omitted."),
      },
    },
    async (params) => {
      return handleHowAmIFeeling(params, getClientName(), cache);
    },
  );

  return server;
}
