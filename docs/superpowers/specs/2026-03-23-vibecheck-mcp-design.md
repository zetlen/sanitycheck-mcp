# vibecheck-mcp Design Spec

An MCP server that exposes tools for checking the health of internet services and AI model providers. Integrates official status pages, third-party outage aggregators, and crowdsourced AI quality trackers into a unified interface for LLM-powered coding assistants.

## Tool Descriptions (LLM-facing)

MCP tool descriptions are what the LLM reads to decide when to call a tool. They must contain strong behavioral hints — not just "what it does" but "when you should reach for it."

### `is_the_internet_on_fire`

**Description (shown to LLM):**
> Check the health of major internet infrastructure and services. Call this when you encounter unexpected API errors, connection timeouts, or degraded responses from cloud services, and you want to know if it's a widespread issue or just local. Also useful when the user asks things like "is AWS down?" or "why is everything broken?" Returns a traffic-light rollup of AWS, GCP, Azure, GitHub, Cloudflare, and other major platforms.

**Parameters:**
- `category?: "cloud" | "cdn" | "devtools" | "ai" | "comms" | "infra"` — optional filter, defaults to all

**Services by category:**
- **cloud:** AWS, GCP, Azure
- **cdn:** Cloudflare, Fastly, Akamai
- **devtools:** GitHub, GitLab, Vercel, Netlify
- **ai:** OpenAI, Anthropic, Google AI
- **comms:** Slack, Discord
- **infra:** Datadog, PagerDuty, npm

**Behavior:** Fires all relevant official status page fetchers in parallel via `Promise.allSettled`. Returns a list of `ServiceStatus` objects with traffic lights. Failed/timed-out fetchers report `"unknown"`.

**Example response:**
```
🟢 AWS: All systems operational
🟢 GitHub: All systems operational
🟡 Cloudflare: Degraded — DNS resolution delays in EU
🔴 OpenAI: Major outage — API errors reported
⚪ Fastly: Unknown (status page unreachable)
```

### `whats_going_on_with`

**Description (shown to LLM):**
> Investigate the status of a specific service in detail. Call this when you're seeing problems with a particular service — deploys failing, API returning 500s, git push hanging, npm install timing out — and want to check if that service is having an incident. Accepts any service name (e.g. "github", "aws s3", "vercel", "npm"). Returns active incidents, affected components, and user-reported outage volume.

**Parameters:**
- `service: string` — free text, e.g. "github", "aws s3", "vercel"

**Behavior:** Matches the service name against known services using case-insensitive substring matching plus an alias map (e.g., "s3" -> "AWS", "actions" -> "GitHub", "cf" -> "Cloudflare"). On zero matches, falls back to Downdetector/StatusGator search. On multiple matches, returns all matching services.

Fetches official status page, Downdetector reports, AND StatusGator data in parallel. Returns `ServiceDetail` with components, active incidents, and third-party report volume. If the service isn't in the known list, searches Downdetector by constructing a slug from the service name (lowercased, hyphenated) and reports unknown if no Downdetector page exists.

### `how_am_i_feeling`

**Description (shown to LLM):**
> Check your own model provider's health and community-reported quality. Call this when you notice your own responses are slow, your reasoning feels off, you're making unusual mistakes, or the user says things like "what is wrong with you?", "you're being dumb today", "are you having a bad day?", or "why are you so slow?" Also call this proactively if you're producing unexpected errors or struggling with tasks you'd normally handle easily. Returns both official provider status and third-party community sentiment about current AI model quality.

**Parameters:**
- `model?: string` — e.g. "claude", "gpt", "gemini". Optional: auto-detected from MCP `clientInfo` when possible.

**Client inference:** The server stores `clientInfo` from the MCP `initialize` request and makes it available to tool handlers. Model is inferred from a simple lookup table that's easy to extend:

| `clientInfo.name` | Inferred provider |
|---|---|
| `claude-code`, `claude-desktop` | Anthropic/Claude |
| `copilot` | OpenAI/GPT |
| Other/unknown | No default — requires explicit `model` param |

If the model can't be inferred and isn't provided, responds with a friendly message asking who's calling.

**Behavior:** Maps model name to provider. Fetches official provider status + all AI vibes sources in parallel. Returns `AIVibeCheck` with first-party status and third-party sentiment.

**Third-party AI quality sources:**
- [aidailycheck.com](https://aidailycheck.com) — real-time user votes on AI performance, refreshes every 60s
- [isclaudecodedumb.today](https://www.isclaudecodedumb.today/) — community daily voting on Claude Code quality
- [aistupidlevel.info](https://aistupidlevel.info) — automated benchmarks across 9 dimensions, 140+ coding tests
- [lmarena.ai](https://lmarena.ai/) — crowdsourced Elo ratings from anonymous side-by-side comparisons

## Architecture

### Approach: Fetcher-per-source with unified cache

Each data source gets its own fetcher module that knows how to scrape/parse one source and return a normalized result. A shared file-based TTL cache sits in front of all fetchers. The three MCP tools compose results from multiple fetchers.

```
MCP Tool -> Cache Layer -> Fetcher (AWS)           -> https://health.aws.amazon.com/...
                        -> Fetcher (Downdetector)   -> https://downdetector.com/...
                        -> Fetcher (aidailycheck)   -> https://aidailycheck.com/...
                        -> ...
```

### Tiered fetching strategy

| Source type | Method | Why |
|---|---|---|
| Official status pages (AWS, GitHub, etc.) | `fetch` + cheerio/RSS parsing | They publish structured feeds, no JS needed |
| Downdetector, StatusGator | `fetch` + cheerio | Server-rendered HTML |
| aidailycheck, isclaudecodedumb, aistupidlevel, LMArena | `puppeteer-core` | JS-rendered SPAs |

The browser instance is lazy-launched on first SPA fetcher call and reused for subsequent calls. Shuts down when the MCP server exits.

### No API keys

Every source is publicly accessible. Zero API keys, zero auth, zero env vars. The only external dependency beyond the MCP SDK is `cheerio` for HTML parsing and `puppeteer-core` for JS-rendered sites (uses system Chrome).

### Rate limiting

The TTL cache is the rate-limiting mechanism. There is no cache bypass and no way for a caller to force a fresh fetch. Some scraped sites (especially Downdetector) may have anti-scraping measures (CAPTCHAs, IP blocks) that could affect reliability — these are handled by the standard "unknown" degradation path.

### Browser management

`chrome-launcher` is used only for path discovery. The discovered path is passed to `puppeteer-core.launch({ executablePath })`. Since this is a local developer tool, Chrome is expected to be installed. If not found, SPA fetchers degrade gracefully (see Error Handling). An environment variable `VIBECHECK_CHROME_PATH` can override the auto-detected path.

## Project Structure

```
vibecheck-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry point, tool registration
│   ├── cache.ts              # File-based TTL cache
│   ├── types.ts              # Shared types
│   ├── browser.ts            # Lazy puppeteer-core browser manager
│   ├── tools/
│   │   ├── is-the-internet-on-fire.ts
│   │   ├── whats-going-on-with.ts
│   │   └── how-am-i-feeling.ts
│   └── fetchers/
│       ├── official/          # First-party status page fetchers
│       │   ├── aws.ts
│       │   ├── gcp.ts
│       │   ├── azure.ts
│       │   ├── cloudflare.ts
│       │   ├── fastly.ts
│       │   ├── akamai.ts
│       │   ├── github.ts
│       │   ├── gitlab.ts
│       │   ├── vercel.ts
│       │   ├── netlify.ts
│       │   ├── openai.ts
│       │   ├── anthropic.ts
│       │   ├── google-ai.ts
│       │   ├── slack.ts
│       │   ├── discord.ts
│       │   ├── datadog.ts
│       │   ├── pagerduty.ts
│       │   └── npm.ts
│       ├── aggregators/       # Third-party report aggregators
│       │   ├── downdetector.ts
│       │   └── statusgator.ts
│       └── ai-vibes/          # AI quality/sentiment sources
│           ├── aidailycheck.ts
│           ├── isclaudecodedumb.ts
│           ├── aistupidlevel.ts
│           └── lmarena.ts
└── test/
    ├── cache.test.ts
    ├── tools/
    └── fetchers/
```

## Core Types

```typescript
type StatusLevel = "operational" | "degraded" | "outage" | "unknown";

// Emoji mapping for tool responses (not a separate type — derived directly from StatusLevel):
// operational -> 🟢, degraded -> 🟡, outage -> 🔴, unknown -> ⚪

interface ServiceStatus {
  name: string;              // "AWS", "GitHub", etc.
  status: StatusLevel;
  summary: string;           // one-liner
  updatedAt: string;         // ISO timestamp of the source's last update
  source: string;            // URL we fetched from
}

interface ComponentStatus {
  name: string;              // "S3", "EC2", "API", etc.
  status: StatusLevel;
  summary: string;
}

interface Incident {
  title: string;
  status: string;            // Free-form — providers use different strings.
                             // Common values: "investigating", "identified", "monitoring", "resolved"
  createdAt: string;
  updatedAt: string;
  components: string[];
}

interface ServiceDetail extends ServiceStatus {
  components: ComponentStatus[];
  incidents: Incident[];
  thirdPartyReports: {
    downdetector?: { reportCount: number; trend: "rising" | "stable" | "falling" };
    statusgator?: { status: StatusLevel; summary: string };
  };
}

interface AIVibeCheck {
  provider: string;           // "anthropic", "openai", "google"
  officialStatus: ServiceStatus;
  vibes: {
    source: string;           // "aidailycheck.com", etc.
    sentiment: string;        // score, rating, vote tally — whatever the source reports
    url: string;              // link for reference
  }[];
}
```

## Cache Design

File-based TTL cache using one file per cache entry. Survives MCP server restarts. Safe under concurrent access from multiple MCP server instances.

**Location:** `~/.cache/vibecheck-mcp/` (respects `XDG_CACHE_HOME` if set)

**File structure:**
```
~/.cache/vibecheck-mcp/
├── official--aws.json
├── official--github.json
├── downdetector--github.json
├── aivibes--aidailycheck--claude.json
└── ...
```

Each file contains:
```json
{ "data": { ... }, "expiresAt": 1711200000000 }
```

**Concurrency safety:** Each cache key is its own file. Writes use temp file + atomic rename (atomic on POSIX; on Windows, `fs.rename` may fail if the target is open, which degrades to a re-fetch — acceptable). Worst case for same-key races is harmless — both processes just fetched the same fresh data.

**TTL values:**
- Official status pages: 3 minutes
- Downdetector/StatusGator: 2 minutes
- AI vibes sites: 5 minutes

Expired entries are dropped on read.

## Error Handling & Resilience

**Fetcher-level:** Fetchers never throw. On failure, they return `ServiceStatus` with `status: "unknown"` and a human-readable summary.

**Timeouts:** `fetch` calls get 10 seconds. Puppeteer page loads get 15 seconds.

**Tool-level:** Tools use `Promise.allSettled` so one broken fetcher doesn't block the rest. Unknowns are clearly marked in the response.

**Browser resilience:** If Chrome can't be found or puppeteer-core fails to launch, SPA fetchers degrade to `"unknown"` with `"Headless browser unavailable — install Chrome to enable this source"`. The MCP server still works; you just lose SPA sources.

**Cache resilience:** If the cache directory is unwritable, cache operations silently no-op. Everything still works, just re-fetches every time.

**No retries.** If a fetch fails, report unknown and move on. The TTL cache means the next call in a few minutes tries again naturally.

## Transport

stdio only. Runs as a local subprocess launched by the AI assistant (Claude Code, Cursor, etc.). HTTP transport can be added later without changing core logic.

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `cheerio` — HTML parsing for server-rendered pages
- `puppeteer-core` — headless Chrome for JS-rendered SPAs
- `chrome-launcher` — find system Chrome install
- Node.js built-ins (`fs`, `path`, `os`, `crypto`) — cache, file I/O

## Versioning

The package follows semver. Tool schemas (parameter shapes and response shapes) are part of the public API — changes to them require a major version bump.
