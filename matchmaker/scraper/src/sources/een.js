import { newContext, sleep } from "../lib/browser.js";
import { SOURCE_DELAYS_MS } from "../config.js";

// Enterprise Europe Network — partnering opportunities. The /partnering-opportunities
// listing path with ?keyword= returns real deep-linkable slugs.
export async function scrape({ query, segment, maxResults = 15 }) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const url =
    "https://een.ec.europa.eu/partnering-opportunities?keyword=" +
    encodeURIComponent(query);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page
      .waitForSelector("a[href*='/partnering-opportunities/']", { timeout: 15000 })
      .catch(() => {});
    const items = await page.$$eval(
      "a[href*='/partnering-opportunities/']",
      (els, max) => {
        const seen = new Set();
        const out = [];
        for (const a of els) {
          const href = a.href;
          if (!/\/partnering-opportunities\/[a-z][\w-]+/i.test(href)) continue;
          if (seen.has(href)) continue;
          seen.add(href);
          const card = a.closest("article, .opportunity-card, li") || a.parentElement;
          const title = (a.textContent || card?.querySelector("h2,h3")?.textContent || "")
            .trim().replace(/\s+/g, " ");
          const country = (card?.querySelector(".country, [class*='country']")?.textContent || "").trim();
          const summary = (card?.querySelector(".summary, p")?.textContent || "").trim().slice(0, 220);
          if (title) out.push({ href, title, country, summary });
          if (out.length >= max) break;
        }
        return out;
      },
      maxResults
    );
    await sleep(SOURCE_DELAYS_MS.een);
    return items.map((it) => ({
      source: "een",
      segment,
      title: it.title,
      url: it.href,
      country: it.country?.match(/\b([A-Z]{2})\b/)?.[1] || "EU",
      details: it.summary,
      org: "EEN listing",
      searchQuery: query,
      linkKind: "real_listing",
    }));
  } finally {
    await ctx.close().catch(() => {});
  }
}
