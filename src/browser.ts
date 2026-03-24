import { createLogger } from "./logger.js";

const log = createLogger("browser");

let browserInstance: import("puppeteer-core").Browser | null = null;
let launchPromise: Promise<import("puppeteer-core").Browser | null> | null = null;

async function findChromePath(): Promise<string | null> {
  const envPath = process.env.SANITYCHECK_CHROME_PATH;
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
