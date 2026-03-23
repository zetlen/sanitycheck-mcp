import { describe, it, expect } from "vitest";

describe("BrowserManager", () => {
  it("exports a getBrowser function", async () => {
    const { getBrowser } = await import("../src/browser.js");
    expect(typeof getBrowser).toBe("function");
  });

  it("exports a closeBrowser function", async () => {
    const { closeBrowser } = await import("../src/browser.js");
    expect(typeof closeBrowser).toBe("function");
  });

  it("exports a fetchWithBrowser function", async () => {
    const { fetchWithBrowser } = await import("../src/browser.js");
    expect(typeof fetchWithBrowser).toBe("function");
  });
});
