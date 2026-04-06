import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileCache, createConfiguredCache } from "../src/cache.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("FileCache", () => {
  let cacheDir: string;
  let cache: FileCache;
  const originalDisableCache = process.env.SANITYCHECK_DISABLE_CACHE;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "sanitycheck-test-"));
    cache = new FileCache(cacheDir);
    delete process.env.SANITYCHECK_DISABLE_CACHE;
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    if (originalDisableCache === undefined) {
      delete process.env.SANITYCHECK_DISABLE_CACHE;
    } else {
      process.env.SANITYCHECK_DISABLE_CACHE = originalDisableCache;
    }
  });

  it("returns null for missing key", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    cache.set("test-key", { hello: "world" }, 60_000);
    expect(cache.get("test-key")).toEqual({ hello: "world" });
  });

  it("returns null for expired entry", () => {
    cache.set("expired", { old: true }, 0);
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

  it("returns undefined when SANITYCHECK_DISABLE_CACHE disables caching", () => {
    process.env.SANITYCHECK_DISABLE_CACHE = "1";
    expect(createConfiguredCache()).toBeUndefined();
  });
});
