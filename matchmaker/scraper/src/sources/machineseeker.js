import { newContext, sleep } from "../lib/browser.js";
import { SOURCE_DELAYS_MS } from "../config.js";
import { withRetry, isRetryableHttpStatus, getThrottleDelay } from "../lib/retry.js";

// Public Machineseeker search → listing URLs. Single-token /mss/ is recommended;
// for multi-word queries we use ?query=... which is also public.
export async function scrape({ query, segment, maxResults = 15 }) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const url =
    "https://www.machineseeker.com/search?query=" + encodeURIComponent(query);
  await sleep(getThrottleDelay(url));
  try {
    await withRetry(
      () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
      { url, attempts: 3, baseMs: 2000, isRetryable: (e) => isRetryableHttpStatus(e?.response?.status?.() ?? 0) || /timeout|net::/i.test(e?.message || "") }
    );
    await page.waitForSelector("article, .listing-link, a[href*='/M/']", {
      timeout: 15000,
    }).catch(() => {});
    const items = await page.$$eval(
      "article a[href*='-i'], a[href*='/M/'][href*='-i']",
      (els, max) => {
        const seen = new Set();
        const out = [];
        for (const a of els) {
          const href = a.href;
          if (!href || seen.has(href)) continue;
          seen.add(href);
          const card = a.closest("article") || a.parentElement;
          const title =
            (card?.querySelector("h2, h3")?.textContent || a.textContent || "")
              .trim()
              .replace(/\s+/g, " ");
          const price =
            (card?.querySelector(".price, [class*='price']")?.textContent || "")
              .trim();
          const loc =
            (card?.querySelector(".location, [class*='location']")?.textContent || "")
              .trim();
          if (title) out.push({ href, title, price, loc });
          if (out.length >= max) break;
        }
        return out;
      },
      maxResults
    );
    await sleep(SOURCE_DELAYS_MS.machineseeker);
    return items.map((it) => ({
      source: "machineseeker",
      segment,
      title: it.title,
      url: it.href,
      priceK: parsePriceK(it.price),
      country: it.loc?.match(/\b([A-Z]{2})\b/)?.[1] || "DE",
      specs: "",
      org: "Machineseeker seller",
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
