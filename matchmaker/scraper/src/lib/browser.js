import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let _browser = null;

export async function getBrowser() {
  if (_browser) return _browser;
  const headless = process.env.HEADLESS !== "0";
  _browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  return _browser;
}

export async function newContext() {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: UA,
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
