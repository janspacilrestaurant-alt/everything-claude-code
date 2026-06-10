import { newContext, sleep } from "../lib/browser.js";
import { SOURCE_DELAYS_MS } from "../config.js";
import { withRetry, getThrottleDelay } from "../lib/retry.js";

export async function scrape({ query, segment, maxResults = 15 }) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const url = "https://www.surplex.com/en/search/?q=" + encodeURIComponent(query);
  await sleep(getThrottleDelay(url));
  try {
    await withRetry(
      () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
      { url, attempts: 3, baseMs: 2000, isRetryable: (e) => /timeout|net::|HTTP (403|429|5)/i.test(e?.message || "") }
    );
    await sleep(1500);
    const items = await page.$$eval(
      "a[href*='/en/m/']",
      (els, max) => {
        const seen = new Set();
        const out = [];
        for (const a of els) {
          const href = a.href;
          if (seen.has(href)) continue;
          seen.add(href);
          const card = a.closest(".product, article, .machine-card") || a.parentElement;
          const title = (card?.querySelector("h2, h3, .title")?.textContent || a.textContent || "")
            .trim().replace(/\s+/g, " ");
          const price = (card?.querySelector(".price, [class*='price']")?.textContent || "").trim();
          if (title && title.length > 8) out.push({ href, title, price });
          if (out.length >= max) break;
        }
        return out;
      },
      maxResults
    );
    await sleep(SOURCE_DELAYS_MS.surplex);
    return items.map((it) => ({
      source: "surplex",
      segment,
      title: it.title,
      url: it.href,
      priceK: parsePriceK(it.price),
      country: "DE",
      specs: "",
      org: "Surplex auction",
      searchQuery: query,
      linkKind: "real_listing",
    }));
  } finally {
    await ctx.close().catch(() => {});
  }
}

function parsePriceK(s) {
  if (!s) return 0;
  const m = s.replace(/[ \s]/g, "").match(/(\d[\d.,]*)\s*€?/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n / 1000);
}
