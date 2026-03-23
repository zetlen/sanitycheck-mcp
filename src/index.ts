#!/usr/bin/env node
// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { closeBrowser } from "./browser.js";

const server = createServer();
const transport = new StdioServerTransport();

await server.connect(transport);
console.error("vibecheck-mcp running on stdio");

// Clean up browser on exit
process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
