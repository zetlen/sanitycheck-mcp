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
      if (Date.now() >= entry.expiresAt) {
        log.debug("expired", { key, ttlRemaining: 0 });
        try {
          unlinkSync(file);
        } catch {}
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
      try {
        unlinkSync(tmp);
      } catch {}
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
  return new FileCache(join(base, "sanitycheck-mcp"));
}
