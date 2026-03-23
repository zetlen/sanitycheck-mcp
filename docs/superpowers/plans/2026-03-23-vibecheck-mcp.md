# vibecheck-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that checks internet service health and AI model quality via official status pages, third-party aggregators, and crowdsourced AI quality trackers.

**Architecture:** Fetcher-per-source with file-based TTL cache. Each data source has its own fetcher module. Three MCP tools (`is_the_internet_on_fire`, `whats_going_on_with`, `how_am_i_feeling`) compose results from multiple fetchers. stdio transport, zero API keys.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, `cheerio`, `puppeteer-core`, `chrome-launcher`, `vitest`

**Spec:** `docs/superpowers/specs/2026-03-23-vibecheck-mcp-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Initialize the project**

```bash
cd /Volumes/CaseSensitive/repos/vibecheck-mcp
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk zod cheerio puppeteer-core chrome-launcher
npm install -D typescript vitest @types/node
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: Update package.json scripts and metadata**

Set `"type": "module"` and add scripts:

```json
{
  "name": "vibecheck-mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "vibecheck-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 5: Create placeholder entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
console.error("vibecheck-mcp: not yet implemented");
```

- [ ] **Step 6: Verify build works**

```bash
npm run build
```

Expected: clean compile, `dist/index.js` created.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/index.ts
git commit -m "chore: scaffold vibecheck-mcp project"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export type StatusLevel = "operational" | "degraded" | "outage" | "unknown";

export const STATUS_EMOJI: Record<StatusLevel, string> = {
  operational: "🟢",
  degraded: "🟡",
  outage: "🔴",
  unknown: "⚪",
};

export interface ServiceStatus {
  name: string;
  status: StatusLevel;
  summary: string;
  updatedAt: string;
  source: string;
}

export interface ComponentStatus {
  name: string;
  status: StatusLevel;
  summary: string;
}

export interface Incident {
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  components: string[];
}

export interface ServiceDetail extends ServiceStatus {
  components: ComponentStatus[];
  incidents: Incident[];
  thirdPartyReports: {
    downdetector?: { reportCount: number; trend: "rising" | "stable" | "falling" };
    statusgator?: { status: StatusLevel; summary: string };
  };
}

export interface AIVibeCheck {
  provider: string;
  officialStatus: ServiceStatus;
  vibes: {
    source: string;
    sentiment: string;
    url: string;
  }[];
}

export type ServiceCategory = "cloud" | "cdn" | "devtools" | "ai" | "comms" | "infra";

export interface Fetcher {
  fetch(): Promise<ServiceStatus>;
}

export interface DetailFetcher {
  fetchDetail(): Promise<ServiceDetail>;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core types"
```

---

### Task 3: Debug Logger

**Files:**
- Create: `src/logger.ts`
- Create: `test/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.VIBECHECK_DEBUG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VIBECHECK_DEBUG;
    } else {
      process.env.VIBECHECK_DEBUG = originalEnv;
    }
  });

  it("should not log when VIBECHECK_DEBUG is unset", async () => {
    delete process.env.VIBECHECK_DEBUG;
    // Re-import to pick up env change
    const { createLogger } = await import("../src/logger.js");
    const log = createLogger("test");
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.debug("hello", { foo: "bar" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log JSON to stderr when VIBECHECK_DEBUG=1", async () => {
    process.env.VIBECHECK_DEBUG = "1";
    const { createLogger } = await import("../src/logger.js");
    const log = createLogger("test-component");
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.debug("hello", { foo: "bar" });
    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("debug");
    expect(parsed.component).toBe("test-component");
    expect(parsed.event).toBe("hello");
    expect(parsed.foo).toBe("bar");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/logger.test.ts
```

Expected: FAIL — cannot import `../src/logger.js`

- [ ] **Step 3: Implement logger.ts**

```typescript
// src/logger.ts

interface LogData {
  [key: string]: unknown;
}

interface Logger {
  debug(event: string, data?: LogData): void;
  warn(event: string, data?: LogData): void;
  error(event: string, data?: LogData): void;
}

function isEnabled(): boolean {
  return process.env.VIBECHECK_DEBUG === "1";
}

function emit(level: string, component: string, event: string, data?: LogData): void {
  if (!isEnabled()) return;
  const line = JSON.stringify({ level, component, event, ...data });
  process.stderr.write(line + "\n");
}

export function createLogger(component: string): Logger {
  return {
    debug: (event, data) => emit("debug", component, event, data),
    warn: (event, data) => emit("warn", component, event, data),
    error: (event, data) => emit("error", component, event, data),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/logger.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logger.ts test/logger.test.ts
git commit -m "feat: add debug logger with VIBECHECK_DEBUG env toggle"
```

---

### Task 4: File Cache

**Files:**
- Create: `src/cache.ts`
- Create: `test/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/cache.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileCache } from "../src/cache.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("FileCache", () => {
  let cacheDir: string;
  let cache: FileCache;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "vibecheck-test-"));
    cache = new FileCache(cacheDir);
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("returns null for missing key", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    cache.set("test-key", { hello: "world" }, 60_000);
    expect(cache.get("test-key")).toEqual({ hello: "world" });
  });

  it("returns null for expired entry", () => {
    cache.set("expired", { old: true }, 0); // 0ms TTL = immediately expired
    expect(cache.get("expired")).toBeNull();
  });

  it("invalidates a key", () => {
    cache.set("to-remove", { data: 1 }, 60_000);
    cache.invalidate("to-remove");
    expect(cache.get("to-remove")).toBeNull();
  });

  it("uses safe filenames for keys with special characters", () => {
    cache.set("official--aws", { name: "AWS" }, 60_000);
    expect(cache.get("official--aws")).toEqual({ name: "AWS" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/cache.test.ts
```

Expected: FAIL — cannot import `FileCache`

- [ ] **Step 3: Implement cache.ts**

```typescript
// src/cache.ts
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createLogger } from "./logger.js";

const log = createLogger("cache");

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class FileCache {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  private keyToFile(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.dir, `${safe}.json`);
  }

  get<T>(key: string): T | null {
    const file = this.keyToFile(key);
    try {
      const raw = readFileSync(file, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        log.debug("expired", { key, ttlRemaining: 0 });
        try { unlinkSync(file); } catch {}
        return null;
      }
      log.debug("hit", { key, ttlRemaining: entry.expiresAt - Date.now() });
      return entry.data;
    } catch {
      log.debug("miss", { key });
      return null;
    }
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const file = this.keyToFile(key);
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    const tmp = file + "." + randomBytes(4).toString("hex") + ".tmp";
    try {
      writeFileSync(tmp, JSON.stringify(entry), "utf-8");
      renameSync(tmp, file);
      log.debug("write", { key, file });
    } catch (err) {
      log.warn("write-failed", { key, error: String(err) });
      try { unlinkSync(tmp); } catch {}
    }
  }

  invalidate(key: string): void {
    const file = this.keyToFile(key);
    try {
      unlinkSync(file);
    } catch {}
  }
}

export function createDefaultCache(): FileCache {
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg || join(process.env.HOME || "/tmp", ".cache");
  return new FileCache(join(base, "vibecheck-mcp"));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/cache.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cache.ts test/cache.test.ts
git commit -m "feat: add file-based TTL cache with atomic writes"
```

---

### Task 5: Browser Manager

**Files:**
- Create: `src/browser.ts`
- Create: `test/browser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/browser.test.ts
import { describe, it, expect, vi } from "vitest";

describe("BrowserManager", () => {
  it("exports a getBrowser function", async () => {
    const { getBrowser } = await import("../src/browser.js");
    expect(typeof getBrowser).toBe("function");
  });

  it("exports a closeBrowser function", async () => {
    const { closeBrowser } = await import("../src/browser.js");
    expect(typeof closeBrowser).toBe("function");
  });
});
```

Note: We don't test actual browser launch in unit tests — that requires Chrome installed. We test the module exports and leave browser integration for manual testing.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/browser.test.ts
```

Expected: FAIL — cannot import `../src/browser.js`

- [ ] **Step 3: Implement browser.ts**

```typescript
// src/browser.ts
import { createLogger } from "./logger.js";

const log = createLogger("browser");

let browserInstance: import("puppeteer-core").Browser | null = null;
let launchPromise: Promise<import("puppeteer-core").Browser | null> | null = null;

async function findChromePath(): Promise<string | null> {
  const envPath = process.env.VIBECHECK_CHROME_PATH;
  if (envPath) {
    log.debug("chrome-path-env", { path: envPath });
    return envPath;
  }
  try {
    const { Launcher } = await import("chrome-launcher");
    const installations = Launcher.getInstallations();
    if (installations.length > 0) {
      log.debug("chrome-found", { path: installations[0] });
      return installations[0];
    }
  } catch (err) {
    log.warn("chrome-discovery-failed", { error: String(err) });
  }
  return null;
}

export async function getBrowser(): Promise<import("puppeteer-core").Browser | null> {
  if (browserInstance?.connected) return browserInstance;

  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    const chromePath = await findChromePath();
    if (!chromePath) {
      log.warn("no-chrome", {});
      return null;
    }

    try {
      const puppeteer = await import("puppeteer-core");
      const browser = await puppeteer.default.launch({
        executablePath: chromePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      log.debug("launched", { pid: browser.process()?.pid });
      browserInstance = browser;
      return browser;
    } catch (err) {
      log.error("launch-failed", { error: String(err) });
      return null;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

export async function fetchWithBrowser(url: string, waitForSelector?: string, timeoutMs = 15_000): Promise<string | null> {
  const browser = await getBrowser();
  if (!browser) return null;

  const page = await browser.newPage();
  try {
    log.debug("navigating", { url });
    await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: timeoutMs });
    }
    const html = await page.content();
    log.debug("fetched", { url, size: html.length });
    return html;
  } catch (err) {
    log.error("fetch-failed", { url, error: String(err) });
    return null;
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    log.debug("closed", {});
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/browser.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/browser.ts test/browser.test.ts
git commit -m "feat: add lazy browser manager with puppeteer-core"
```

---

### Task 6: Service Registry

**Files:**
- Create: `src/registry.ts`
- Create: `test/registry.test.ts`

The registry maps service names, aliases, and categories to fetcher modules. This is the lookup table that tools use.

- [ ] **Step 1: Write the failing test**

```typescript
// test/registry.test.ts
import { describe, it, expect } from "vitest";
import { resolveService, getServicesByCategory, SERVICE_ALIASES } from "../src/registry.js";

describe("registry", () => {
  it("resolves an exact service name", () => {
    const result = resolveService("github");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GitHub");
  });

  it("resolves a service alias", () => {
    const result = resolveService("s3");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("AWS");
  });

  it("resolves case-insensitively", () => {
    const result = resolveService("GITHUB");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GitHub");
  });

  it("returns empty array for unknown service", () => {
    const result = resolveService("nonexistent-service-xyz");
    expect(result).toHaveLength(0);
  });

  it("returns services by category", () => {
    const cloud = getServicesByCategory("cloud");
    const names = cloud.map((s) => s.name);
    expect(names).toContain("AWS");
    expect(names).toContain("GCP");
    expect(names).toContain("Azure");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/registry.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement registry.ts**

```typescript
// src/registry.ts
import type { ServiceCategory } from "./types.js";

export interface ServiceEntry {
  name: string;
  slug: string;           // lowercase id, e.g. "github"
  category: ServiceCategory;
  statusUrl: string;      // official status page URL
  statuspageId?: string;  // for Atlassian Statuspage-based services
  downdetectorSlug?: string; // for Downdetector URL construction
}

// Atlassian Statuspage-based services share a common API format:
// GET https://<domain>/api/v2/summary.json
export const SERVICES: ServiceEntry[] = [
  // Cloud
  { name: "AWS", slug: "aws", category: "cloud", statusUrl: "https://health.aws.amazon.com/health/status", downdetectorSlug: "aws-amazon-web-services" },
  { name: "GCP", slug: "gcp", category: "cloud", statusUrl: "https://status.cloud.google.com/", downdetectorSlug: "google-cloud" },
  { name: "Azure", slug: "azure", category: "cloud", statusUrl: "https://status.azure.com/en-us/status", downdetectorSlug: "windows-azure" },

  // CDN
  { name: "Cloudflare", slug: "cloudflare", category: "cdn", statusUrl: "https://www.cloudflarestatus.com", statuspageId: "yh6f0r4529hb", downdetectorSlug: "cloudflare" },
  { name: "Fastly", slug: "fastly", category: "cdn", statusUrl: "https://status.fastly.com", statuspageId: "889929qfzmz6", downdetectorSlug: "fastly" },
  { name: "Akamai", slug: "akamai", category: "cdn", statusUrl: "https://www.akamaistatus.com", downdetectorSlug: "akamai" },

  // Dev Tools
  { name: "GitHub", slug: "github", category: "devtools", statusUrl: "https://www.githubstatus.com", statuspageId: "kctbh9vbitze", downdetectorSlug: "github" },
  { name: "GitLab", slug: "gitlab", category: "devtools", statusUrl: "https://status.gitlab.com", statuspageId: "5b36dc6502d06804c08349f7", downdetectorSlug: "gitlab" },
  { name: "Vercel", slug: "vercel", category: "devtools", statusUrl: "https://www.vercel-status.com", statuspageId: "2s0kfq7n6gkl", downdetectorSlug: "vercel" },
  { name: "Netlify", slug: "netlify", category: "devtools", statusUrl: "https://www.netlifystatus.com", statuspageId: "hyyhlpkm1l3q", downdetectorSlug: "netlify" },

  // AI
  { name: "OpenAI", slug: "openai", category: "ai", statusUrl: "https://status.openai.com", statuspageId: "t56hlsb30k1c", downdetectorSlug: "openai" },
  { name: "Anthropic", slug: "anthropic", category: "ai", statusUrl: "https://status.anthropic.com", statuspageId: "2fxwrmymcl5j", downdetectorSlug: "anthropic" },
  { name: "Google AI", slug: "google-ai", category: "ai", statusUrl: "https://status.cloud.google.com/", downdetectorSlug: "google-cloud" },

  // Comms
  { name: "Slack", slug: "slack", category: "comms", statusUrl: "https://status.slack.com", statuspageId: "2qlkr10b2y0j", downdetectorSlug: "slack" },
  { name: "Discord", slug: "discord", category: "comms", statusUrl: "https://discordstatus.com", statuspageId: "srhpyqt94yxb", downdetectorSlug: "discord" },

  // Infra
  { name: "Datadog", slug: "datadog", category: "infra", statusUrl: "https://status.datadoghq.com", statuspageId: "1k6wydy513d6", downdetectorSlug: "datadog" },
  { name: "PagerDuty", slug: "pagerduty", category: "infra", statusUrl: "https://status.pagerduty.com", statuspageId: "bdbmr5p85kgr", downdetectorSlug: "pagerduty" },
  { name: "npm", slug: "npm", category: "infra", statusUrl: "https://status.npmjs.org", statuspageId: "wby3g916dnvk", downdetectorSlug: "npm" },
];

export const SERVICE_ALIASES: Record<string, string> = {
  "s3": "aws",
  "ec2": "aws",
  "lambda": "aws",
  "rds": "aws",
  "actions": "github",
  "gh": "github",
  "gl": "gitlab",
  "cf": "cloudflare",
  "dd": "datadog",
  "pd": "pagerduty",
  "gpt": "openai",
  "chatgpt": "openai",
  "claude": "anthropic",
  "gemini": "google-ai",
  "bard": "google-ai",
};

export function resolveService(query: string): ServiceEntry[] {
  const q = query.toLowerCase().trim();

  // Check aliases first
  if (SERVICE_ALIASES[q]) {
    const slug = SERVICE_ALIASES[q];
    const match = SERVICES.filter((s) => s.slug === slug);
    if (match.length > 0) return match;
  }

  // Exact slug match
  const exact = SERVICES.filter((s) => s.slug === q);
  if (exact.length > 0) return exact;

  // Substring match on name or slug
  const substring = SERVICES.filter(
    (s) => s.name.toLowerCase().includes(q) || s.slug.includes(q)
  );
  return substring;
}

export function getServicesByCategory(category: ServiceCategory): ServiceEntry[] {
  return SERVICES.filter((s) => s.category === category);
}

export function getAllServices(): ServiceEntry[] {
  return [...SERVICES];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/registry.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/registry.ts test/registry.test.ts
git commit -m "feat: add service registry with aliases and category lookup"
```

---

### Task 7: Statuspage Generic Fetcher

**Files:**
- Create: `src/fetchers/statuspage.ts`
- Create: `test/fetchers/statuspage.test.ts`

Most official status pages (GitHub, Cloudflare, OpenAI, Anthropic, Slack, Discord, Datadog, PagerDuty, npm, Vercel, Netlify, GitLab, Fastly) use Atlassian Statuspage, which serves a consistent JSON API at `/api/v2/summary.json`. This shared fetcher handles all of them.

- [ ] **Step 1: Write the failing test**

```typescript
// test/fetchers/statuspage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStatuspageSummary, parseStatuspageStatus } from "../../src/fetchers/statuspage.js";
import type { ServiceStatus, ServiceDetail } from "../../src/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("statuspage fetcher", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const MOCK_SUMMARY = {
    status: { indicator: "none", description: "All Systems Operational" },
    components: [
      { name: "API", status: "operational", description: null },
      { name: "Webhooks", status: "degraded_performance", description: null },
    ],
    incidents: [
      {
        name: "Degraded Webhook Delivery",
        status: "investigating",
        created_at: "2026-03-23T10:00:00Z",
        updated_at: "2026-03-23T10:30:00Z",
        components: [{ name: "Webhooks" }],
      },
    ],
    page: { updated_at: "2026-03-23T10:30:00Z" },
  };

  it("parses a healthy statuspage response into ServiceStatus", () => {
    const healthy = { ...MOCK_SUMMARY, status: { indicator: "none", description: "All Systems Operational" } };
    const result = parseStatuspageStatus(healthy, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("operational");
    expect(result.name).toBe("GitHub");
  });

  it("parses a degraded statuspage response", () => {
    const degraded = { ...MOCK_SUMMARY, status: { indicator: "minor", description: "Minor issues" } };
    const result = parseStatuspageStatus(degraded, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("degraded");
  });

  it("parses a major outage response", () => {
    const major = { ...MOCK_SUMMARY, status: { indicator: "major", description: "Major outage" } };
    const result = parseStatuspageStatus(major, "GitHub", "https://www.githubstatus.com");
    expect(result.status).toBe("outage");
  });

  it("fetches and parses a real statuspage URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_SUMMARY,
    });

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.name).toBe("GitHub");
    expect(result.detail.components).toHaveLength(2);
    expect(result.detail.incidents).toHaveLength(1);
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchStatuspageSummary("https://www.githubstatus.com", "GitHub");
    expect(result.status.status).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/fetchers/statuspage.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement statuspage.ts**

```typescript
// src/fetchers/statuspage.ts
import type { ServiceStatus, ServiceDetail, StatusLevel, ComponentStatus, Incident } from "../types.js";
import { createLogger } from "../logger.js";

const log = createLogger("fetcher:statuspage");

const INDICATOR_MAP: Record<string, StatusLevel> = {
  none: "operational",
  minor: "degraded",
  major: "outage",
  critical: "outage",
};

const COMPONENT_STATUS_MAP: Record<string, StatusLevel> = {
  operational: "operational",
  degraded_performance: "degraded",
  partial_outage: "degraded",
  major_outage: "outage",
  under_maintenance: "degraded",
};

export function parseStatuspageStatus(
  data: any,
  serviceName: string,
  sourceUrl: string,
): ServiceStatus {
  const indicator = data?.status?.indicator ?? "unknown";
  const description = data?.status?.description ?? "Unknown";
  const updatedAt = data?.page?.updated_at ?? new Date().toISOString();

  return {
    name: serviceName,
    status: INDICATOR_MAP[indicator] ?? "unknown",
    summary: description,
    updatedAt,
    source: sourceUrl,
  };
}

export function parseStatuspageDetail(
  data: any,
  serviceName: string,
  sourceUrl: string,
): ServiceDetail {
  const base = parseStatuspageStatus(data, serviceName, sourceUrl);

  const components: ComponentStatus[] = (data?.components ?? []).map((c: any) => ({
    name: c.name,
    status: COMPONENT_STATUS_MAP[c.status] ?? "unknown",
    summary: c.description || c.status,
  }));

  const incidents: Incident[] = (data?.incidents ?? []).map((i: any) => ({
    title: i.name,
    status: i.status,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    components: (i.components ?? []).map((c: any) => c.name),
  }));

  return {
    ...base,
    components,
    incidents,
    thirdPartyReports: {},
  };
}

export async function fetchStatuspageSummary(
  baseUrl: string,
  serviceName: string,
): Promise<{ status: ServiceStatus; detail: ServiceDetail }> {
  const url = `${baseUrl}/api/v2/summary.json`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("http-error", { serviceName, url, status: response.status });
      const unknown = makeUnknown(serviceName, baseUrl, `HTTP ${response.status}`);
      return { status: unknown, detail: { ...unknown, components: [], incidents: [], thirdPartyReports: {} } };
    }

    const data = await response.json();
    log.debug("fetched", { serviceName, url, elapsed: Date.now() - start });

    const status = parseStatuspageStatus(data, serviceName, baseUrl);
    const detail = parseStatuspageDetail(data, serviceName, baseUrl);
    return { status, detail };
  } catch (err) {
    log.error("fetch-error", { serviceName, url, error: String(err), elapsed: Date.now() - start });
    const unknown = makeUnknown(serviceName, baseUrl, String(err));
    return { status: unknown, detail: { ...unknown, components: [], incidents: [], thirdPartyReports: {} } };
  }
}

function makeUnknown(name: string, source: string, reason: string): ServiceStatus {
  return {
    name,
    status: "unknown",
    summary: `Status page unreachable (${reason})`,
    updatedAt: new Date().toISOString(),
    source,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/fetchers/statuspage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/fetchers/statuspage.ts test/fetchers/statuspage.test.ts
git commit -m "feat: add generic Atlassian Statuspage fetcher"
```

---

### Task 8: Official Fetchers — Statuspage-based Services

**Files:**
- Create: `src/fetchers/official/index.ts` (barrel export + factory)

All Statuspage-based services (GitHub, Cloudflare, Fastly, GitLab, Vercel, Netlify, OpenAI, Anthropic, Slack, Discord, Datadog, PagerDuty, npm) share the same fetch logic. Instead of 13 nearly-identical files, create a factory that generates fetcher functions from the registry.

- [ ] **Step 1: Write the failing test**

```typescript
// test/fetchers/official/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOfficialStatus, fetchOfficialDetail } from "../../../src/fetchers/official/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("official fetchers", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const MOCK_HEALTHY = {
    status: { indicator: "none", description: "All Systems Operational" },
    components: [],
    incidents: [],
    page: { updated_at: "2026-03-23T10:00:00Z" },
  };

  it("fetches status for a Statuspage-based service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HEALTHY,
    });

    const result = await fetchOfficialStatus("github");
    expect(result.name).toBe("GitHub");
    expect(result.status).toBe("operational");
  });

  it("returns unknown for an unrecognized service slug", async () => {
    const result = await fetchOfficialStatus("nonexistent");
    expect(result.status).toBe("unknown");
  });

  it("fetches detail for a Statuspage-based service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HEALTHY,
    });

    const result = await fetchOfficialDetail("github");
    expect(result.name).toBe("GitHub");
    expect(result.components).toBeDefined();
    expect(result.incidents).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/fetchers/official/index.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement official/index.ts**

```typescript
// src/fetchers/official/index.ts
import { SERVICES, type ServiceEntry } from "../../registry.js";
import { fetchStatuspageSummary } from "../statuspage.js";
import type { ServiceStatus, ServiceDetail } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:official");

function makeUnknownStatus(name: string, reason: string): ServiceStatus {
  return {
    name,
    status: "unknown",
    summary: reason,
    updatedAt: new Date().toISOString(),
    source: "",
  };
}

function makeUnknownDetail(name: string, reason: string): ServiceDetail {
  return {
    ...makeUnknownStatus(name, reason),
    components: [],
    incidents: [],
    thirdPartyReports: {},
  };
}

export async function fetchOfficialStatus(slug: string): Promise<ServiceStatus> {
  const entry = SERVICES.find((s) => s.slug === slug);
  if (!entry) {
    return makeUnknownStatus(slug, `Unknown service: ${slug}`);
  }

  // Services with Statuspage use the generic fetcher
  if (entry.statuspageId) {
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name);
    return result.status;
  }

  // Non-Statuspage services (AWS, GCP, Azure, Akamai, Google AI)
  // return unknown for now — custom fetchers to be implemented in Task 9
  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownStatus(entry.name, "Custom status page — fetcher not yet implemented");
}

export async function fetchOfficialDetail(slug: string): Promise<ServiceDetail> {
  const entry = SERVICES.find((s) => s.slug === slug);
  if (!entry) {
    return makeUnknownDetail(slug, `Unknown service: ${slug}`);
  }

  if (entry.statuspageId) {
    const result = await fetchStatuspageSummary(entry.statusUrl, entry.name);
    return result.detail;
  }

  log.debug("no-statuspage", { slug, name: entry.name });
  return makeUnknownDetail(entry.name, "Custom status page — fetcher not yet implemented");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/fetchers/official/index.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/fetchers/official/index.ts test/fetchers/official/index.test.ts
git commit -m "feat: add official status fetchers for Statuspage-based services"
```

---

### Task 9: Official Fetchers — Custom Status Pages

**Files:**
- Create: `src/fetchers/official/aws.ts`
- Create: `src/fetchers/official/gcp.ts`
- Create: `src/fetchers/official/azure.ts`
- Create: `src/fetchers/official/akamai.ts`
- Modify: `src/fetchers/official/index.ts` — wire custom fetchers into the dispatch

These services don't use Atlassian Statuspage. Each needs a custom parser. Start with AWS as a template, then implement the rest following the same pattern.

- [ ] **Step 1: Write the failing test for AWS**

```typescript
// test/fetchers/official/aws.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwsStatus } from "../../../src/fetchers/official/aws.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("AWS fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses a healthy AWS status page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        archive: [],
        current: [],
      }),
    });

    const result = await fetchAwsStatus();
    expect(result.name).toBe("AWS");
    expect(result.status).toBe("operational");
  });

  it("returns unknown on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchAwsStatus();
    expect(result.status).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/fetchers/official/aws.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement aws.ts**

The AWS Health Dashboard publishes a JSON feed. Parse it for current events.

```typescript
// src/fetchers/official/aws.ts
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:aws");
const STATUS_URL = "https://health.aws.amazon.com/health/status";
const DATA_URL = "https://health.aws.amazon.com/health/status";

export async function fetchAwsStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(DATA_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return makeUnknown(`HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const current = data?.current ?? [];
    log.debug("fetched", { elapsed: Date.now() - start, currentEvents: current.length });

    if (current.length === 0) {
      return {
        name: "AWS",
        status: "operational",
        summary: "All systems operational",
        updatedAt: new Date().toISOString(),
        source: STATUS_URL,
      };
    }

    // Check severity of current events
    const hasOutage = current.some((e: any) =>
      e.status_text?.toLowerCase().includes("disruption") ||
      e.status_text?.toLowerCase().includes("outage")
    );

    return {
      name: "AWS",
      status: hasOutage ? "outage" : "degraded",
      summary: current.map((e: any) => `${e.service_name}: ${e.summary}`).join("; "),
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "AWS", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/fetchers/official/aws.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement GCP fetcher**

GCP publishes a JSON incidents feed. Google AI uses the same status endpoint.

```typescript
// src/fetchers/official/gcp.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:gcp");
const STATUS_URL = "https://status.cloud.google.com/";
const INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";

export async function fetchGcpStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(INCIDENTS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const incidents = await response.json() as any[];
    log.debug("fetched", { elapsed: Date.now() - start, incidents: incidents.length });

    // Filter to active (non-resolved) incidents
    const active = incidents.filter((i: any) =>
      i.most_recent_update?.status !== "RESOLVED" &&
      // Only recent incidents (last 24h)
      new Date(i.begin).getTime() > Date.now() - 86_400_000
    );

    if (active.length === 0) {
      return { name: "GCP", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }

    const hasOutage = active.some((i: any) => i.severity === "high");
    return {
      name: "GCP",
      status: hasOutage ? "outage" : "degraded",
      summary: active.map((i: any) => `${i.service_name}: ${i.external_desc}`).join("; ").slice(0, 200),
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "GCP", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
```

Create `test/fetchers/official/gcp.test.ts` following the same mock pattern as `aws.test.ts`.

- [ ] **Step 6: Implement Azure fetcher**

Azure's status page is HTML. Parse with cheerio.

```typescript
// src/fetchers/official/azure.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:azure");
const STATUS_URL = "https://status.azure.com/en-us/status";

export async function fetchAzureStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_URL, {
      headers: { Accept: "text/html", "User-Agent": "vibecheck-mcp/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { elapsed: Date.now() - start, size: html.length });

    // Azure status page uses icons/classes to indicate status
    // Look for non-good status indicators
    const issues = $(".status-icon--unhealthy, .status-icon--warning, .status-icon--information").length;

    if (issues === 0) {
      return { name: "Azure", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }

    // Extract issue summaries from the page
    const summaryText = $(".region-status-summary, .status-description").first().text().trim() || `${issues} service(s) reporting issues`;
    return {
      name: "Azure",
      status: issues > 3 ? "outage" : "degraded",
      summary: summaryText.slice(0, 200),
      updatedAt: new Date().toISOString(),
      source: STATUS_URL,
    };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "Azure", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
```

Create `test/fetchers/official/azure.test.ts` with mock HTML fixtures.

- [ ] **Step 7: Implement Akamai fetcher**

```typescript
// src/fetchers/official/akamai.ts
import * as cheerio from "cheerio";
import type { ServiceStatus } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:akamai");
const STATUS_URL = "https://www.akamaistatus.com";

export async function fetchAkamaiStatus(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const response = await fetch(STATUS_URL, {
      headers: { Accept: "text/html", "User-Agent": "vibecheck-mcp/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return makeUnknown(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { elapsed: Date.now() - start, size: html.length });

    const pageText = $("body").text().toLowerCase();
    if (pageText.includes("all systems operational") || pageText.includes("no issues")) {
      return { name: "Akamai", status: "operational", summary: "All systems operational", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    if (pageText.includes("major") || pageText.includes("outage")) {
      return { name: "Akamai", status: "outage", summary: "Service disruption reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
    }
    return { name: "Akamai", status: "degraded", summary: "Issues reported", updatedAt: new Date().toISOString(), source: STATUS_URL };
  } catch (err) {
    log.error("fetch-error", { error: String(err), elapsed: Date.now() - start });
    return makeUnknown(String(err));
  }
}

function makeUnknown(reason: string): ServiceStatus {
  return { name: "Akamai", status: "unknown", summary: `Status page unreachable (${reason})`, updatedAt: new Date().toISOString(), source: STATUS_URL };
}
```

Create `test/fetchers/official/akamai.test.ts`.

- [ ] **Step 8: Wire custom fetchers into official/index.ts**

Update `fetchOfficialStatus` and `fetchOfficialDetail` to dispatch to custom fetchers:

```typescript
// Add to official/index.ts
import { fetchAwsStatus } from "./aws.js";
import { fetchGcpStatus } from "./gcp.js";
import { fetchAzureStatus } from "./azure.js";
import { fetchAkamaiStatus } from "./akamai.js";

const CUSTOM_FETCHERS: Record<string, () => Promise<ServiceStatus>> = {
  aws: fetchAwsStatus,
  gcp: fetchGcpStatus,
  azure: fetchAzureStatus,
  akamai: fetchAkamaiStatus,
  "google-ai": fetchGcpStatus, // Google AI uses the same GCP status endpoint
};

// In fetchOfficialStatus, replace the non-Statuspage branch:
if (CUSTOM_FETCHERS[slug]) {
  return CUSTOM_FETCHERS[slug]();
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/fetchers/official/ test/fetchers/official/
git commit -m "feat: add custom fetchers for AWS, GCP, Azure, Akamai"
```

---

### Task 10: Aggregator Fetchers (Downdetector + StatusGator)

**Files:**
- Create: `src/fetchers/aggregators/downdetector.ts`
- Create: `src/fetchers/aggregators/statusgator.ts`
- Create: `test/fetchers/aggregators/downdetector.test.ts`
- Create: `test/fetchers/aggregators/statusgator.test.ts`

Both are server-rendered HTML pages. Use `fetch` + `cheerio`.

- [ ] **Step 1: Write the failing test for Downdetector**

```typescript
// test/fetchers/aggregators/downdetector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDowndetectorReports } from "../../../src/fetchers/aggregators/downdetector.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Downdetector fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses report count from HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<div class="entry-title">GitHub</div>
        <span class="text-2xl">42</span>`,
    });

    const result = await fetchDowndetectorReports("github");
    // Should not throw, should return some result
    expect(result).toBeDefined();
    expect(result.source).toBe("downdetector");
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("blocked"));
    const result = await fetchDowndetectorReports("github");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/fetchers/aggregators/downdetector.test.ts
```

- [ ] **Step 3: Implement downdetector.ts**

```typescript
// src/fetchers/aggregators/downdetector.ts
import * as cheerio from "cheerio";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:downdetector");

export interface DowndetectorReport {
  source: "downdetector";
  reportCount: number;
  trend: "rising" | "stable" | "falling";
  url: string;
}

export async function fetchDowndetectorReports(slug: string): Promise<DowndetectorReport | null> {
  const url = `https://downdetector.com/status/${slug}/`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; vibecheck-mcp/0.1)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("http-error", { slug, status: response.status, elapsed: Date.now() - start });
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { slug, size: html.length, elapsed: Date.now() - start });

    // Downdetector's HTML structure may change — this is best-effort parsing
    // Look for report count indicators in the page
    const reportText = $(".text-2xl").first().text().trim();
    const reportCount = parseInt(reportText, 10) || 0;

    return {
      source: "downdetector",
      reportCount,
      trend: "stable", // Trend detection would need historical comparison; default to stable
      url,
    };
  } catch (err) {
    log.error("fetch-error", { slug, error: String(err), elapsed: Date.now() - start });
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/fetchers/aggregators/downdetector.test.ts
```

- [ ] **Step 5: Write the failing test for StatusGator**

```typescript
// test/fetchers/aggregators/statusgator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStatusGatorStatus } from "../../../src/fetchers/aggregators/statusgator.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("StatusGator fetcher", () => {
  beforeEach(() => mockFetch.mockReset());

  it("parses status from HTML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `<div class="component-status">Operational</div>`,
    });
    const result = await fetchStatusGatorStatus("github");
    expect(result).toBeDefined();
    expect(result!.status).toBe("operational");
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const result = await fetchStatusGatorStatus("github");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 6: Implement statusgator.ts**

```typescript
// src/fetchers/aggregators/statusgator.ts
import * as cheerio from "cheerio";
import type { StatusLevel } from "../../types.js";
import { createLogger } from "../../logger.js";

const log = createLogger("fetcher:statusgator");

export interface StatusGatorResult {
  status: StatusLevel;
  summary: string;
}

export async function fetchStatusGatorStatus(slug: string): Promise<StatusGatorResult | null> {
  const url = `https://statusgator.com/services/${slug}`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; vibecheck-mcp/0.1)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn("http-error", { slug, status: response.status, elapsed: Date.now() - start });
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    log.debug("fetched", { slug, size: html.length, elapsed: Date.now() - start });

    const pageText = $("body").text().toLowerCase();
    let status: StatusLevel = "unknown";
    let summary = "Unable to determine status";

    if (pageText.includes("operational") && !pageText.includes("not operational")) {
      status = "operational";
      summary = "All systems operational";
    } else if (pageText.includes("outage") || pageText.includes("major")) {
      status = "outage";
      summary = "Service outage reported";
    } else if (pageText.includes("degraded") || pageText.includes("partial") || pageText.includes("minor")) {
      status = "degraded";
      summary = "Degraded performance reported";
    }

    return { status, summary };
  } catch (err) {
    log.error("fetch-error", { slug, error: String(err), elapsed: Date.now() - start });
    return null;
  }
}
```

- [ ] **Step 6: Run all tests, commit**

```bash
npx vitest run
git add src/fetchers/aggregators/ test/fetchers/aggregators/
git commit -m "feat: add Downdetector and StatusGator aggregator fetchers"
```

---

### Task 11: AI Vibes Fetchers

**Files:**
- Create: `src/fetchers/ai-vibes/aidailycheck.ts`
- Create: `src/fetchers/ai-vibes/isclaudecodedumb.ts`
- Create: `src/fetchers/ai-vibes/aistupidlevel.ts`
- Create: `src/fetchers/ai-vibes/lmarena.ts`
- Create: `test/fetchers/ai-vibes/` (tests for each)

These are JS-rendered SPAs that need `puppeteer-core`. Each fetcher calls `fetchWithBrowser()` from `browser.ts`, then parses the HTML with cheerio.

**Important:** Because these sites are SPAs with unknown and likely-changing DOM structures, the fetchers should be written to extract data from the page text/DOM in a robust way — looking for key patterns and text rather than relying on specific CSS selectors.

- [ ] **Step 1: Write the failing test for aidailycheck**

```typescript
// test/fetchers/ai-vibes/aidailycheck.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser module
vi.mock("../../../src/browser.js", () => ({
  fetchWithBrowser: vi.fn(),
}));

import { fetchAiDailyCheck } from "../../../src/fetchers/ai-vibes/aidailycheck.js";
import { fetchWithBrowser } from "../../../src/browser.js";

const mockFetchWithBrowser = vi.mocked(fetchWithBrowser);

describe("aidailycheck fetcher", () => {
  beforeEach(() => mockFetchWithBrowser.mockReset());

  it("returns a vibe result with sentiment data", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(
      `<html><body><div>Claude: Genius 85%</div><div>GPT: Good 70%</div></body></html>`
    );

    const result = await fetchAiDailyCheck("claude");
    expect(result).toBeDefined();
    expect(result!.source).toBe("aidailycheck.com");
    expect(result!.url).toContain("aidailycheck.com");
  });

  it("returns null when browser is unavailable", async () => {
    mockFetchWithBrowser.mockResolvedValueOnce(null);
    const result = await fetchAiDailyCheck("claude");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/fetchers/ai-vibes/aidailycheck.test.ts
```

- [ ] **Step 3: Implement aidailycheck.ts**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/fetchers/ai-vibes/aidailycheck.test.ts
```

- [ ] **Step 5: Implement isclaudecodedumb.ts**

```typescript
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
```

Create `test/fetchers/ai-vibes/isclaudecodedumb.test.ts` following the aidailycheck pattern (mock `fetchWithBrowser`).

- [ ] **Step 6: Implement aistupidlevel.ts**

```typescript
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
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract scores and rankings for the requested model
    // The site shows benchmark scores across 9 dimensions
    const modelLower = model.toLowerCase();
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
    const relevant = lines.filter((l) =>
      l.toLowerCase().includes(modelLower) &&
      /\d/.test(l) // must contain a number (score, rank, etc.)
    ).slice(0, 5);

    const sentiment = relevant.length > 0
      ? relevant.join("; ").slice(0, 200)
      : `No specific benchmark data found for "${model}"`;

    return { source: "aistupidlevel.info", sentiment, url };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
```

Create `test/fetchers/ai-vibes/aistupidlevel.test.ts` following the mock pattern.

- [ ] **Step 7: Implement lmarena.ts**

```typescript
// src/fetchers/ai-vibes/lmarena.ts
import * as cheerio from "cheerio";
import { fetchWithBrowser } from "../../browser.js";
import { createLogger } from "../../logger.js";
import type { VibeResult } from "./aidailycheck.js";

const log = createLogger("fetcher:lmarena");

export async function fetchLmArena(model: string): Promise<VibeResult | null> {
  const url = "https://lmarena.ai/?leaderboard=";

  try {
    // LMArena's leaderboard is a heavy SPA — give it extra time
    const html = await fetchWithBrowser(url, undefined, 20_000);
    if (!html) return null;

    const $ = cheerio.load(html);
    const pageText = $("body").text();
    log.debug("fetched", { model, textLength: pageText.length });

    // Extract Elo ratings and rankings
    // The leaderboard shows model names with their Elo scores
    const modelLower = model.toLowerCase();
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);

    // Look for lines that mention the model and contain numbers (Elo scores)
    const relevant = lines.filter((l) => {
      const lower = l.toLowerCase();
      return (lower.includes(modelLower) || lower.includes(modelLower.replace("-", " "))) && /\d{3,4}/.test(l);
    }).slice(0, 3);

    const sentiment = relevant.length > 0
      ? relevant.join("; ").slice(0, 200)
      : `No leaderboard data found for "${model}"`;

    return { source: "lmarena.ai", sentiment, url: "https://lmarena.ai" };
  } catch (err) {
    log.error("error", { model, error: String(err) });
    return null;
  }
}
```

Create `test/fetchers/ai-vibes/lmarena.test.ts` following the mock pattern.

- [ ] **Step 6: Create barrel export**

```typescript
// src/fetchers/ai-vibes/index.ts
export { fetchAiDailyCheck } from "./aidailycheck.js";
export { fetchIsClaudeCodeDumb } from "./isclaudecodedumb.js";
export { fetchAiStupidLevel } from "./aistupidlevel.js";
export { fetchLmArena } from "./lmarena.js";
export type { VibeResult } from "./aidailycheck.js";
```

- [ ] **Step 7: Run all tests, commit**

```bash
npx vitest run
git add src/fetchers/ai-vibes/ test/fetchers/ai-vibes/
git commit -m "feat: add AI vibes fetchers (aidailycheck, isclaudecodedumb, aistupidlevel, lmarena)"
```

---

### Task 12: `is_the_internet_on_fire` Tool

**Files:**
- Create: `src/tools/is-the-internet-on-fire.ts`
- Create: `test/tools/is-the-internet-on-fire.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/tools/is-the-internet-on-fire.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialStatus: vi.fn(),
}));

vi.mock("../../src/cache.js", () => ({
  FileCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  })),
}));

import { handleIsTheInternetOnFire } from "../../src/tools/is-the-internet-on-fire.js";
import { fetchOfficialStatus } from "../../src/fetchers/official/index.js";

const mockFetchOfficial = vi.mocked(fetchOfficialStatus);

describe("is_the_internet_on_fire", () => {
  beforeEach(() => mockFetchOfficial.mockReset());

  it("returns traffic-light summary for all services", async () => {
    mockFetchOfficial.mockResolvedValue({
      name: "TestService",
      status: "operational",
      summary: "All systems operational",
      updatedAt: "2026-03-23T10:00:00Z",
      source: "https://example.com",
    });

    const result = await handleIsTheInternetOnFire({});
    expect(result.content[0].text).toContain("🟢");
  });

  it("filters by category", async () => {
    // Track which slugs are fetched
    const fetchedSlugs: string[] = [];
    mockFetchOfficial.mockImplementation(async (slug: string) => {
      fetchedSlugs.push(slug);
      return {
        name: slug,
        status: "operational" as const,
        summary: "All systems operational",
        updatedAt: "2026-03-23T10:00:00Z",
        source: "https://example.com",
      };
    });

    await handleIsTheInternetOnFire({ category: "cloud" });
    // Should only fetch cloud services (aws, gcp, azure)
    expect(fetchedSlugs).toContain("aws");
    expect(fetchedSlugs).toContain("gcp");
    expect(fetchedSlugs).toContain("azure");
    expect(fetchedSlugs).not.toContain("github");
    expect(fetchedSlugs).not.toContain("slack");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/tools/is-the-internet-on-fire.test.ts
```

- [ ] **Step 3: Implement the tool**

```typescript
// src/tools/is-the-internet-on-fire.ts
import { fetchOfficialStatus } from "../fetchers/official/index.js";
import { getAllServices, getServicesByCategory } from "../registry.js";
import { STATUS_EMOJI, type ServiceCategory, type ServiceStatus } from "../types.js";
import { createLogger } from "../logger.js";
import type { FileCache } from "../cache.js";

const log = createLogger("tool:is-the-internet-on-fire");

const TTL_MS = 3 * 60 * 1000; // 3 minutes

interface Params {
  category?: ServiceCategory;
}

export async function handleIsTheInternetOnFire(
  params: Params,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const services = params.category
    ? getServicesByCategory(params.category)
    : getAllServices();

  log.debug("fetching", { count: services.length, category: params.category ?? "all" });

  const results = await Promise.allSettled(
    services.map(async (svc): Promise<ServiceStatus> => {
      const cacheKey = `official--${svc.slug}`;
      if (cache) {
        const cached = cache.get<ServiceStatus>(cacheKey);
        if (cached) return cached;
      }

      const status = await fetchOfficialStatus(svc.slug);

      if (cache) {
        cache.set(cacheKey, status, TTL_MS);
      }

      return status;
    })
  );

  const lines = results.map((r) => {
    if (r.status === "fulfilled") {
      const s = r.value;
      return `${STATUS_EMOJI[s.status]} ${s.name}: ${s.summary}`;
    }
    return `⚪ Unknown: fetch failed`;
  });

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/tools/is-the-internet-on-fire.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/is-the-internet-on-fire.ts test/tools/is-the-internet-on-fire.test.ts
git commit -m "feat: add is_the_internet_on_fire tool"
```

---

### Task 13: `whats_going_on_with` Tool

**Files:**
- Create: `src/tools/whats-going-on-with.ts`
- Create: `test/tools/whats-going-on-with.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/tools/whats-going-on-with.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialDetail: vi.fn(),
}));

vi.mock("../../src/fetchers/aggregators/downdetector.js", () => ({
  fetchDowndetectorReports: vi.fn(),
}));

vi.mock("../../src/cache.js", () => ({
  FileCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  })),
}));

import { handleWhatsGoingOnWith } from "../../src/tools/whats-going-on-with.js";
import { fetchOfficialDetail } from "../../src/fetchers/official/index.js";
import { fetchDowndetectorReports } from "../../src/fetchers/aggregators/downdetector.js";

const mockDetail = vi.mocked(fetchOfficialDetail);
const mockDD = vi.mocked(fetchDowndetectorReports);

describe("whats_going_on_with", () => {
  beforeEach(() => {
    mockDetail.mockReset();
    mockDD.mockReset();
  });

  it("returns detailed status for a known service", async () => {
    mockDetail.mockResolvedValueOnce({
      name: "GitHub",
      status: "degraded",
      summary: "Degraded performance",
      updatedAt: "2026-03-23T10:00:00Z",
      source: "https://www.githubstatus.com",
      components: [{ name: "API", status: "degraded", summary: "Slow responses" }],
      incidents: [{ title: "API Latency", status: "investigating", createdAt: "2026-03-23T09:00:00Z", updatedAt: "2026-03-23T10:00:00Z", components: ["API"] }],
      thirdPartyReports: {},
    });
    mockDD.mockResolvedValueOnce({ source: "downdetector", reportCount: 150, trend: "rising", url: "https://downdetector.com/status/github/" });

    const result = await handleWhatsGoingOnWith({ service: "github" });
    expect(result.content[0].text).toContain("GitHub");
    expect(result.content[0].text).toContain("API Latency");
  });

  it("falls back to Downdetector for unknown services", async () => {
    mockDD.mockResolvedValueOnce({ source: "downdetector", reportCount: 50, trend: "stable", url: "https://downdetector.com/status/some-service/" });

    const result = await handleWhatsGoingOnWith({ service: "some-random-service" });
    expect(result.content[0].text).toContain("downdetector");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/tools/whats-going-on-with.test.ts
```

- [ ] **Step 3: Implement the tool**

```typescript
// src/tools/whats-going-on-with.ts
import { resolveService, type ServiceEntry } from "../registry.js";
import { fetchOfficialDetail } from "../fetchers/official/index.js";
import { fetchDowndetectorReports } from "../fetchers/aggregators/downdetector.js";
import { fetchStatusGatorStatus } from "../fetchers/aggregators/statusgator.js";
import { STATUS_EMOJI } from "../types.js";
import type { ServiceDetail } from "../types.js";
import type { FileCache } from "../cache.js";
import { createLogger } from "../logger.js";

const log = createLogger("tool:whats-going-on-with");

const OFFICIAL_TTL = 3 * 60 * 1000;
const DD_TTL = 2 * 60 * 1000;

interface Params {
  service: string;
}

export async function handleWhatsGoingOnWith(
  params: Params,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const matches = resolveService(params.service);
  log.debug("resolved", { query: params.service, matches: matches.length });

  if (matches.length === 0) {
    return fallbackToDowndetector(params.service, cache);
  }

  const results = await Promise.allSettled(
    matches.map((entry) => fetchServiceDetail(entry, cache))
  );

  const lines: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      lines.push(formatDetail(r.value));
    }
  }

  return { content: [{ type: "text", text: lines.join("\n\n---\n\n") }] };
}

async function fetchServiceDetail(entry: ServiceEntry, cache?: FileCache): Promise<ServiceDetail> {
  const cacheKey = `detail--${entry.slug}`;
  if (cache) {
    const cached = cache.get<ServiceDetail>(cacheKey);
    if (cached) return cached;
  }

  const [detail, dd, sg] = await Promise.allSettled([
    fetchOfficialDetail(entry.slug),
    entry.downdetectorSlug ? fetchDowndetectorReports(entry.downdetectorSlug) : Promise.resolve(null),
    fetchStatusGatorStatus(entry.slug),
  ]);

  const result = detail.status === "fulfilled" ? detail.value : {
    name: entry.name, status: "unknown" as const, summary: "Failed to fetch",
    updatedAt: new Date().toISOString(), source: entry.statusUrl,
    components: [], incidents: [], thirdPartyReports: {},
  };

  if (dd.status === "fulfilled" && dd.value) {
    result.thirdPartyReports.downdetector = {
      reportCount: dd.value.reportCount,
      trend: dd.value.trend,
    };
  }

  if (sg.status === "fulfilled" && sg.value) {
    result.thirdPartyReports.statusgator = {
      status: sg.value.status,
      summary: sg.value.summary,
    };
  }

  if (cache) cache.set(cacheKey, result, OFFICIAL_TTL);
  return result;
}

async function fallbackToDowndetector(
  service: string,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const slug = service.toLowerCase().replace(/\s+/g, "-");
  const cacheKey = `dd--${slug}`;

  if (cache) {
    const cached = cache.get<any>(cacheKey);
    if (cached) return { content: [{ type: "text", text: cached }] };
  }

  const dd = await fetchDowndetectorReports(slug);
  if (dd) {
    const text = `"${service}" is not in the known service list, but here's what downdetector.com shows:\n\nReports: ${dd.reportCount}\nTrend: ${dd.trend}\nSource: ${dd.url}`;
    if (cache) cache.set(cacheKey, text, DD_TTL);
    return { content: [{ type: "text", text }] };
  }

  return { content: [{ type: "text", text: `"${service}" is not in the known service list and no Downdetector page was found for it.` }] };
}

function formatDetail(d: ServiceDetail): string {
  const lines: string[] = [];
  lines.push(`${STATUS_EMOJI[d.status]} **${d.name}**: ${d.summary}`);
  lines.push(`Source: ${d.source}`);

  if (d.components.length > 0) {
    lines.push("\nComponents:");
    for (const c of d.components) {
      lines.push(`  ${STATUS_EMOJI[c.status]} ${c.name}: ${c.summary}`);
    }
  }

  if (d.incidents.length > 0) {
    lines.push("\nActive Incidents:");
    for (const i of d.incidents) {
      lines.push(`  - ${i.title} (${i.status}) — updated ${i.updatedAt}`);
      if (i.components.length > 0) {
        lines.push(`    Affecting: ${i.components.join(", ")}`);
      }
    }
  }

  if (d.thirdPartyReports.downdetector) {
    const dd = d.thirdPartyReports.downdetector;
    lines.push(`\nDowndetector: ${dd.reportCount} reports (${dd.trend})`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/tools/whats-going-on-with.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/whats-going-on-with.ts test/tools/whats-going-on-with.test.ts
git commit -m "feat: add whats_going_on_with tool with Downdetector fallback"
```

---

### Task 14: `how_am_i_feeling` Tool

**Files:**
- Create: `src/tools/how-am-i-feeling.ts`
- Create: `src/client-inference.ts`
- Create: `test/tools/how-am-i-feeling.test.ts`
- Create: `test/client-inference.test.ts`

- [ ] **Step 1: Write the failing test for client inference**

```typescript
// test/client-inference.test.ts
import { describe, it, expect } from "vitest";
import { inferModel, CLIENT_MODEL_MAP } from "../src/client-inference.js";

describe("client inference", () => {
  it("infers claude from claude-code client", () => {
    expect(inferModel("claude-code")).toBe("claude");
  });

  it("infers claude from claude-desktop client", () => {
    expect(inferModel("claude-desktop")).toBe("claude");
  });

  it("infers gpt from copilot client", () => {
    expect(inferModel("copilot")).toBe("gpt");
  });

  it("returns null for unknown client", () => {
    expect(inferModel("cursor")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(inferModel(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/client-inference.test.ts
```

- [ ] **Step 3: Implement client-inference.ts**

```typescript
// src/client-inference.ts
import { createLogger } from "./logger.js";

const log = createLogger("client");

export const CLIENT_MODEL_MAP: Record<string, string> = {
  "claude-code": "claude",
  "claude-desktop": "claude",
  "copilot": "gpt",
  "github-copilot": "gpt",
};

export function inferModel(clientName: string | undefined): string | null {
  if (!clientName) return null;
  const model = CLIENT_MODEL_MAP[clientName.toLowerCase()] ?? null;
  log.debug("infer", { clientName, inferred: model });
  return model;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/client-inference.test.ts
```

- [ ] **Step 5: Write the failing test for how_am_i_feeling tool**

```typescript
// test/tools/how-am-i-feeling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/fetchers/official/index.js", () => ({
  fetchOfficialStatus: vi.fn(),
}));

vi.mock("../../src/fetchers/ai-vibes/index.js", () => ({
  fetchAiDailyCheck: vi.fn(),
  fetchIsClaudeCodeDumb: vi.fn(),
  fetchAiStupidLevel: vi.fn(),
  fetchLmArena: vi.fn(),
}));

import { handleHowAmIFeeling } from "../../src/tools/how-am-i-feeling.js";
import { fetchOfficialStatus } from "../../src/fetchers/official/index.js";
import * as vibes from "../../src/fetchers/ai-vibes/index.js";

const mockOfficial = vi.mocked(fetchOfficialStatus);
const mockAiDaily = vi.mocked(vibes.fetchAiDailyCheck);
const mockClaudeDumb = vi.mocked(vibes.fetchIsClaudeCodeDumb);
const mockStupidLevel = vi.mocked(vibes.fetchAiStupidLevel);
const mockLmArena = vi.mocked(vibes.fetchLmArena);

describe("how_am_i_feeling", () => {
  beforeEach(() => {
    mockOfficial.mockReset();
    mockAiDaily.mockReset();
    mockClaudeDumb.mockReset();
    mockStupidLevel.mockReset();
    mockLmArena.mockReset();
  });

  it("returns combined status for claude", async () => {
    mockOfficial.mockResolvedValueOnce({
      name: "Anthropic", status: "operational", summary: "All systems operational",
      updatedAt: "2026-03-23T10:00:00Z", source: "https://status.anthropic.com",
    });
    mockAiDaily.mockResolvedValueOnce({ source: "aidailycheck.com", sentiment: "Genius 90%", url: "https://aidailycheck.com" });
    mockClaudeDumb.mockResolvedValueOnce({ source: "isclaudecodedumb.today", sentiment: "Not dumb today", url: "https://www.isclaudecodedumb.today/" });
    mockStupidLevel.mockResolvedValueOnce({ source: "aistupidlevel.info", sentiment: "Score: 92/100", url: "https://aistupidlevel.info" });
    mockLmArena.mockResolvedValueOnce({ source: "lmarena.ai", sentiment: "Elo: 1250", url: "https://lmarena.ai" });

    const result = await handleHowAmIFeeling({ model: "claude" }, null);
    const text = result.content[0].text;
    expect(text).toContain("Anthropic");
    expect(text).toContain("aidailycheck");
  });

  it("returns friendly error when model is unknown and no clientInfo", async () => {
    const result = await handleHowAmIFeeling({}, null);
    const text = result.content[0].text;
    expect(text.toLowerCase()).toContain("who");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run test/tools/how-am-i-feeling.test.ts
```

- [ ] **Step 7: Implement how-am-i-feeling.ts**

```typescript
// src/tools/how-am-i-feeling.ts
import { fetchOfficialStatus } from "../fetchers/official/index.js";
import { fetchAiDailyCheck, fetchIsClaudeCodeDumb, fetchAiStupidLevel, fetchLmArena, type VibeResult } from "../fetchers/ai-vibes/index.js";
import { inferModel } from "../client-inference.js";
import { STATUS_EMOJI } from "../types.js";
import type { ServiceStatus } from "../types.js";
import type { FileCache } from "../cache.js";
import { createLogger } from "../logger.js";

const log = createLogger("tool:how-am-i-feeling");

const MODEL_TO_PROVIDER: Record<string, string> = {
  claude: "anthropic",
  gpt: "openai",
  gemini: "google-ai",
  chatgpt: "openai",
};

const OFFICIAL_TTL = 3 * 60 * 1000;
const VIBES_TTL = 5 * 60 * 1000;

interface Params {
  model?: string;
}

export async function handleHowAmIFeeling(
  params: Params,
  clientName: string | null,
  cache?: FileCache,
): Promise<{ content: { type: "text"; text: string }[] }> {
  const model = params.model?.toLowerCase() || inferModel(clientName ?? undefined);

  if (!model) {
    return {
      content: [{
        type: "text",
        text: "I'd love to check on that, but I'm not sure who's asking! Could you tell me which model you are? Pass a `model` parameter like \"claude\", \"gpt\", or \"gemini\".",
      }],
    };
  }

  log.debug("checking", { model, clientName });

  const providerSlug = MODEL_TO_PROVIDER[model] ?? model;

  // Fetch official status + all vibes in parallel
  const [officialResult, ...vibeResults] = await Promise.allSettled([
    fetchWithCache(cache, `official--${providerSlug}`, OFFICIAL_TTL, () => fetchOfficialStatus(providerSlug)),
    fetchWithCache(cache, `vibes--aidailycheck--${model}`, VIBES_TTL, () => fetchAiDailyCheck(model)),
    fetchWithCache(cache, `vibes--isclaudecodedumb--${model}`, VIBES_TTL, () => fetchIsClaudeCodeDumb(model)),
    fetchWithCache(cache, `vibes--aistupidlevel--${model}`, VIBES_TTL, () => fetchAiStupidLevel(model)),
    fetchWithCache(cache, `vibes--lmarena--${model}`, VIBES_TTL, () => fetchLmArena(model)),
  ]);

  const official: ServiceStatus = officialResult.status === "fulfilled" && officialResult.value
    ? officialResult.value
    : { name: providerSlug, status: "unknown", summary: "Could not fetch official status", updatedAt: new Date().toISOString(), source: "" };

  const vibes: VibeResult[] = vibeResults
    .filter((r): r is PromiseFulfilledResult<VibeResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is VibeResult => v !== null);

  return { content: [{ type: "text", text: formatVibeCheck(model, official, vibes) }] };
}

function formatVibeCheck(model: string, official: ServiceStatus, vibes: VibeResult[]): string {
  const lines: string[] = [];

  lines.push(`## Vibe Check: ${model}`);
  lines.push("");
  lines.push(`**Official Status (${official.name}):** ${STATUS_EMOJI[official.status]} ${official.summary}`);
  lines.push(`Source: ${official.source}`);

  if (vibes.length > 0) {
    lines.push("");
    lines.push("**Community Vibes:**");
    for (const v of vibes) {
      lines.push(`- ${v.source}: ${v.sentiment} (${v.url})`);
    }
  } else {
    lines.push("");
    lines.push("*No community vibe data available (headless browser may be unavailable)*");
  }

  return lines.join("\n");
}

async function fetchWithCache<T>(
  cache: FileCache | undefined,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (cache) {
    const cached = cache.get<T>(key);
    if (cached) return cached;
  }
  const result = await fetcher();
  if (cache && result) cache.set(key, result, ttl);
  return result;
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx vitest run test/tools/how-am-i-feeling.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/tools/how-am-i-feeling.ts src/client-inference.ts test/tools/how-am-i-feeling.test.ts test/client-inference.test.ts
git commit -m "feat: add how_am_i_feeling tool with client inference"
```

---

### Task 15: MCP Server Entry Point

**Files:**
- Modify: `src/index.ts`

Wire everything together: create McpServer, register three tools with zod schemas and LLM-facing descriptions, capture clientInfo from initialize, connect via stdio.

- [ ] **Step 1: Write the failing test**

```typescript
// test/index.test.ts
import { describe, it, expect } from "vitest";

describe("server module", () => {
  it("exports without errors", async () => {
    // Verify the module can be imported without crashing
    // (actual MCP server won't start because we don't connect transport)
    const mod = await import("../src/server.js");
    expect(mod.createServer).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/index.test.ts
```

- [ ] **Step 3: Create src/server.ts (server factory, separate from entry point)**

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleIsTheInternetOnFire } from "./tools/is-the-internet-on-fire.js";
import { handleWhatsGoingOnWith } from "./tools/whats-going-on-with.js";
import { handleHowAmIFeeling } from "./tools/how-am-i-feeling.js";
import { createDefaultCache, FileCache } from "./cache.js";
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
      const serverAny = server as any;
      const clientInfo = serverAny.server?._clientInfo;
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
```

- [ ] **Step 4: Update src/index.ts as thin entry point**

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run test/index.test.ts
```

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Expected: clean compile

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/server.ts test/index.test.ts
git commit -m "feat: wire up MCP server with three tools and stdio transport"
```

---

### Task 16: Build, Manual Test, and Polish

**Files:**
- Modify: `package.json` (add bin field if not present)
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
dist/
.env*
*.tgz
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 4: Manual smoke test with debug logging**

```bash
VIBECHECK_DEBUG=1 echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"claude-code","version":"1.0.0"}}}' | node dist/index.js 2>debug.log
```

Check `debug.log` for structured JSON output showing the initialize event with clientInfo.

- [ ] **Step 5: Test with Claude Code (if available)**

Add to Claude Code MCP config:
```json
{
  "mcpServers": {
    "vibecheck": {
      "command": "node",
      "args": ["/Volumes/CaseSensitive/repos/vibecheck-mcp/dist/index.js"]
    }
  }
}
```

Then ask Claude Code: "Is the internet on fire?" or "How am I feeling?"

- [ ] **Step 6: Commit final state**

```bash
git add .gitignore
git commit -m "chore: add gitignore and finalize v0.1.0"
```

---

## File Map Summary

| File | Responsibility |
|------|---------------|
| `src/index.ts` | Entry point — creates server, connects stdio, handles shutdown |
| `src/server.ts` | Server factory — registers tools, manages cache and client state |
| `src/types.ts` | Shared type definitions |
| `src/logger.ts` | Debug logging to stderr |
| `src/cache.ts` | File-based TTL cache |
| `src/browser.ts` | Lazy puppeteer-core browser manager |
| `src/registry.ts` | Service registry with names, categories, aliases |
| `src/client-inference.ts` | Client name → model mapping |
| `src/fetchers/statuspage.ts` | Generic Atlassian Statuspage parser |
| `src/fetchers/official/index.ts` | Official status fetcher dispatch |
| `src/fetchers/official/aws.ts` | AWS custom fetcher |
| `src/fetchers/official/gcp.ts` | GCP custom fetcher |
| `src/fetchers/official/azure.ts` | Azure custom fetcher |
| `src/fetchers/official/akamai.ts` | Akamai custom fetcher |
| `src/fetchers/aggregators/downdetector.ts` | Downdetector scraper |
| `src/fetchers/aggregators/statusgator.ts` | StatusGator scraper |
| `src/fetchers/ai-vibes/aidailycheck.ts` | AI Daily Check scraper |
| `src/fetchers/ai-vibes/isclaudecodedumb.ts` | IsClaudeCodeDumb scraper |
| `src/fetchers/ai-vibes/aistupidlevel.ts` | AI Stupid Level scraper |
| `src/fetchers/ai-vibes/lmarena.ts` | LM Arena scraper |
| `src/fetchers/ai-vibes/index.ts` | Barrel export for AI vibes |
| `src/tools/is-the-internet-on-fire.ts` | Rollup tool handler |
| `src/tools/whats-going-on-with.ts` | Detail investigation tool handler |
| `src/tools/how-am-i-feeling.ts` | AI vibes tool handler |
