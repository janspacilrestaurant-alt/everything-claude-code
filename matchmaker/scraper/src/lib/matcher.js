import crypto from "node:crypto";

const STOP = new Set([
  "and","or","the","a","of","for","with","to","in","on","at","by","from",
  "is","are","be","new","used","cnc","machine","center","centre","de","en",
]);

function tokens(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens), b = new Set(bTokens);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function pairDemandsAndOffers(demands, offers, { perSegmentLimit = 5 } = {}) {
  const pairs = [];
  // Group by segment, then take top scoring pairs per segment.
  const segments = new Set([...demands, ...offers].map((x) => x.segment));
  for (const segment of segments) {
    const segDemands = demands.filter((d) => d.segment === segment);
    const segOffers = offers.filter((o) => o.segment === segment);
    const scored = [];
    for (const d of segDemands) {
      const dTok = tokens(`${d.title} ${d.searchQuery} ${d.details || ""}`);
      for (const o of segOffers) {
        const oTok = tokens(`${o.title} ${o.searchQuery} ${o.specs || ""}`);
        const score = jaccard(dTok, oTok);
        if (score >= 0.08) scored.push({ d, o, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const usedD = new Set(), usedO = new Set();
    for (const { d, o, score } of scored) {
      if (usedD.has(d.url) || usedO.has(o.url)) continue;
      if (pairs.filter((p) => p.deal.segment === segment).length >= perSegmentLimit) break;
      usedD.add(d.url); usedO.add(o.url);
      pairs.push({ deal: buildDeal(d, o, score), demand: d, offer: o });
    }
  }
  return pairs;
}

function buildDeal(demand, offer, score) {
  // Deterministic ID = stable on re-runs, lets Supabase upsert merge cleanly.
  const idHash = crypto
    .createHash("sha1")
    .update(`${demand.url}|${offer.url}`)
    .digest("hex")
    .slice(0, 10);
  const now = new Date().toISOString();
  const linkKind = (kind) => (kind === "real_listing" ? "real_listing" : "search");
  return {
    id: `scr_${idHash}`,
    status: "new",
    segment: demand.segment,
    weightTier: guessWeightTier(offer),
    matchCriteria: {
      brand: hasBrandOverlap(demand, offer),
      specs: score >= 0.2,
      year: "ok",
      budget: "ok",
      extras: false,
    },
    demand: {
      title: demand.title,
      buyer: demand.org || demand.title,
      buyerEmail: demand.email || "",
      buyerPhone: demand.phone || "",
      country: demand.country || "EU",
      budget: demand.budget || "",
      budgetMidK: offer.priceK || 0,
      link: demand.url,
      postedDate: demand.postedDate || now.slice(0, 10),
      details: demand.details || "",
      searchQuery: demand.searchQuery,
    },
    offer: {
      title: offer.title,
      seller: offer.org || "—",
      sellerEmail: "",
      sellerPhone: "",
      sellerCountry: offer.country || "EU",
      price: offer.priceK || 0,
      specs: offer.specs || "",
      link: offer.url,
      postedDate: offer.postedDate || now.slice(0, 10),
      searchQuery: offer.searchQuery,
    },
    profit: { val: "", base: offer.priceK ? `~${offer.priceK} k€` : "" },
    flags: [`scraper score ${(score * 100).toFixed(0)} %`],
    warnings: [],
    notes: "",
    emails: { buyer: null, seller: null },
    createdAt: now,
    linkKind: {
      demand: linkKind(demand.linkKind),
      offer: linkKind(offer.linkKind),
    },
  };
}

const KNOWN_BRANDS = [
  "dmg mori","hermle","haas","mazak","okuma","brother","doosan","makino",
  "siemens","fanuc","heidenhain","rexroth","sandvik","hiwin","thk","kuka",
];
function hasBrandOverlap(demand, offer) {
  const text = `${demand.title} ${demand.searchQuery} ${offer.title}`.toLowerCase();
  return KNOWN_BRANDS.some((b) => text.includes(b));
}

function guessWeightTier(offer) {
  const t = `${offer.title} ${offer.specs || ""}`.toLowerCase();
  if (/(5-axis|machining center|hermle|dmg mori|c\s?42|c\s?30)/.test(t)) return 3;
  if (/(lathe|turning|press brake)/.test(t)) return 2;
  return 1;
}
