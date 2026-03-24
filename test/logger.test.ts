import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.SANITYCHECK_DEBUG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SANITYCHECK_DEBUG;
    } else {
      process.env.SANITYCHECK_DEBUG = originalEnv;
    }
  });

  it("should not log when SANITYCHECK_DEBUG is unset", () => {
    delete process.env.SANITYCHECK_DEBUG;
    const log = createLogger("test");
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.debug("hello", { foo: "bar" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log JSON to stderr when SANITYCHECK_DEBUG=1", () => {
    process.env.SANITYCHECK_DEBUG = "1";
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
