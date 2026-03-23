import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

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

  it("should not log when VIBECHECK_DEBUG is unset", () => {
    delete process.env.VIBECHECK_DEBUG;
    const log = createLogger("test");
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.debug("hello", { foo: "bar" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log JSON to stderr when VIBECHECK_DEBUG=1", () => {
    process.env.VIBECHECK_DEBUG = "1";
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
