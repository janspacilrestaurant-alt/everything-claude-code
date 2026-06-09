import { newContext, sleep } from "../lib/browser.js";
import { SOURCE_DELAYS_MS } from "../config.js";
import { withRetry, getThrottleDelay } from "../lib/retry.js";

// Public Exapro search results. Listings expire when sold so we re-run daily.
export async function scrape({ query, segment, maxResults = 15 }) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const url = "https://www.exapro.com/search/?q=" + encodeURIComponent(query);
  await sleep(getThrottleDelay(url));
  try {
    await withRetry(
      () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
      { url, attempts: 3, baseMs: 2000, isRetryable: (e) => /timeout|net::|HTTP (403|429|5)/i.test(e?.message || "") }
    );
    // Exapro listing URLs follow /<slug>-p<id>/ — we filter to those.
    await sleep(1500);
    const items = await page.$$eval(
      "a[href*='-p'][href$='/']",
      (els, max) => {
        const seen = new Set();
        const out = [];
        for (const a of els) {
          const href = a.href;
          if (!/-p\d+\/$/.test(href) || seen.has(href)) continue;
          seen.add(href);
          const card =
            a.closest(".product, article, .result-card") || a.parentElement;
          const title =
            (card?.querySelector("h2, h3, .product-title")?.textContent ||
              a.textContent ||
              "")
              .trim()
              .replace(/\s+/g, " ");
          const price =
            (card?.querySelector(".price, [class*='price']")?.textContent || "")
              .trim();
          const country =
            (card?.querySelector(".country, [class*='country']")?.textContent || "")
              .trim();
          if (title) out.push({ href, title, price, country });
          if (out.length >= max) break;
        }
        return out;
      },
      maxResults
    );
    await sleep(SOURCE_DELAYS_MS.exapro);
    return items.map((it) => ({
      source: "exapro",
      segment,
      title: it.title,
      url: it.href,
      priceK: parsePriceK(it.price),
      country: countryCode(it.country),
      specs: "",
      org: "Exapro dealer",
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

const CC = {
  germany: "DE", france: "FR", italy: "IT", spain: "ES", poland: "PL",
  switzerland: "CH", netherlands: "NL", belgium: "BE", austria: "AT",
  "czech republic": "CZ", slovakia: "SK", hungary: "HU", romania: "RO",
  "united kingdom": "UK", sweden: "SE",
};
function countryCode(name) {
  if (!name) return "EU";
  const k = name.toLowerCase();
  return CC[k] || (name.match(/\b([A-Z]{2})\b/)?.[1] ?? "EU");
}
