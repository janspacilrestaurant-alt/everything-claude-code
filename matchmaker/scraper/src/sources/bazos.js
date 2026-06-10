import { BAZOS_MOBILE } from "../lib/ua.js";
import { withRetry, isRetryableHttpStatus, getThrottleDelay } from "../lib/retry.js";

// Bazoš.cz mobile API — public listings, but the endpoint enforces a mobile
// User-Agent + x-deviceid header and rejects anything else with 403.
//
// IMPORTANT: section codes vary by category. Per the broker's CLAUDE.md,
// machines / tooling / MRO map to Bazoš's "Stroje a Nářadí" section. The
// section code is reported by Bazoš's category endpoint and is best
// discovered with a one-shot probe in HEADLESS=0 mode; the wire format is
// a 2-char alpha code (e.g. "AU", "DU", "PC"). Set BAZOS_SECTION in .env to
// override the default; default is left empty so the source no-ops until
// the operator confirms which category to scrape.
const SECTION = process.env.BAZOS_SECTION || "";

// Offset paging: 0, 20, 40 … (Bazoš enforces a multiple of 20; hard 200 cap).
const PAGE_SIZE = 20;
const MAX_OFFSET = 200;

const ENDPOINT = "https://www.bazos.cz/api/v1/ads.php";

export async function scrape({ query, segment, maxResults = 15 }) {
  if (!SECTION) {
    console.log("[bazos] BAZOS_SECTION not set — skipping. See src/sources/bazos.js");
    return [];
  }

  const headers = {
    "User-Agent": BAZOS_MOBILE.ua,
    "x-deviceid": BAZOS_MOBILE.deviceId(),
    "Accept": "application/json",
    "Accept-Language": "cs-CZ,cs;q=0.9",
  };

  const results = [];
  for (let offset = 0; offset < MAX_OFFSET && results.length < maxResults; offset += PAGE_SIZE) {
    const url = `${ENDPOINT}?hledat=${encodeURIComponent(query)}&sekce=${SECTION}&offset=${offset}`;
    const throttle = getThrottleDelay(url);
    if (throttle > 0) await new Promise((r) => setTimeout(r, throttle));

    try {
      const data = await withRetry(
        async () => {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            const err = new Error(`bazos HTTP ${res.status}`);
            err.status = res.status;
            throw err;
          }
          return res.json();
        },
        { url, attempts: 3, baseMs: 2000, isRetryable: (e) => isRetryableHttpStatus(e.status) }
      );

      const ads = Array.isArray(data?.ads) ? data.ads : data?.data || [];
      if (ads.length === 0) break;
      for (const ad of ads) {
        if (results.length >= maxResults) break;
        const detailUrl = ad.url || (ad.id ? `https://www.bazos.cz/inzerat/${ad.id}/` : null);
        if (!detailUrl) continue;
        results.push({
          source: "bazos",
          segment,
          title: (ad.nadpis || ad.title || "").trim(),
          url: detailUrl,
          priceK: parseBazosPrice(ad.cena || ad.price),
          country: "CZ",
          specs: (ad.popis || ad.description || "").slice(0, 240),
          org: ad.lokalita || "Bazoš seller",
          searchQuery: query,
          linkKind: "real_listing",
        });
      }
    } catch (err) {
      console.log(`[bazos] ${err.message} — stopping pagination`);
      break;
    }
  }

  return results;
}

function parseBazosPrice(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[  \s]/g, "");
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  // Bazoš quotes CZK; convert to k€ (rough ECB rate 25 CZK/EUR).
  return Math.round(n / 25 / 1000);
}
