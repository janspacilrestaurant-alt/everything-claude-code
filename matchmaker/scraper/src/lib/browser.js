import { chromium } from "playwright";
import { pickUA } from "./ua.js";

let _browser = null;

export async function getBrowser() {
  if (_browser) return _browser;
  const headless = process.env.HEADLESS !== "0";
  // Playwright reads HTTPS_PROXY / HTTP_PROXY / NO_PROXY env vars natively.
  // To route through a residential proxy plan, set HTTPS_PROXY in .env.
  _browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  return _browser;
}

export async function newContext() {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: pickUA(),
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    timezoneId: "Europe/Prague",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9,de;q=0.7,cs;q=0.5",
    },
  });
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
