import { newContext, sleep } from "../lib/browser.js";
import { SOURCE_DELAYS_MS } from "../config.js";

// TED — EU public tenders. Notice URLs look like /en/notice/<id>/...
export async function scrape({ query, segment, maxResults = 15 }) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const url =
    "https://ted.europa.eu/en/search/result?q=" + encodeURIComponent(query);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page
      .waitForSelector("a[href*='/en/notice/']", { timeout: 15000 })
      .catch(() => {});
    const items = await page.$$eval(
      "a[href*='/en/notice/']",
      (els, max) => {
        const seen = new Set();
        const out = [];
        for (const a of els) {
          const href = a.href;
          if (seen.has(href)) continue;
          seen.add(href);
          const card = a.closest("article, .result, li") || a.parentElement;
          const title = (a.textContent || "").trim().replace(/\s+/g, " ");
          const country = (card?.querySelector(".country, [class*='country']")?.textContent || "").trim();
          const summary = (card?.querySelector(".summary, p")?.textContent || "").trim().slice(0, 220);
          if (title && title.length > 8) out.push({ href, title, country, summary });
          if (out.length >= max) break;
        }
        return out;
      },
      maxResults
    );
    await sleep(SOURCE_DELAYS_MS.ted);
    return items.map((it) => ({
      source: "ted",
      segment,
      title: it.title,
      url: it.href,
      country: it.country?.match(/\b([A-Z]{2})\b/)?.[1] || "EU",
      details: it.summary,
      org: "EU public tender",
      searchQuery: query,
      budget: "Public tender",
      linkKind: "real_listing",
    }));
  } finally {
    await ctx.close().catch(() => {});
  }
}
