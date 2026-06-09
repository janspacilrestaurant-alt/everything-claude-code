import "dotenv/config";
import pLimit from "p-limit";
import { SEGMENTS } from "./config.js";
import { closeBrowser } from "./lib/browser.js";
import { upsertDeals } from "./lib/supabase.js";
import { pairDemandsAndOffers } from "./lib/matcher.js";
import * as machineseeker from "./sources/machineseeker.js";
import * as exapro from "./sources/exapro.js";
import * as surplex from "./sources/surplex.js";
import * as een from "./sources/een.js";
import * as ted from "./sources/ted.js";
import * as bazos from "./sources/bazos.js";

const SOURCES = { machineseeker, exapro, surplex, een, ted, bazos };
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "2", 10);
const MAX_PER_SOURCE = parseInt(process.env.MAX_RESULTS_PER_SOURCE || "20", 10);
const DRY_RUN = process.env.DRY_RUN === "1";
const DEBUG = process.env.DEBUG === "1";

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dbg = (...a) => { if (DEBUG) log("[debug]", ...a); };

async function runSource(name, query, segment) {
  const src = SOURCES[name];
  if (!src) throw new Error(`Unknown source: ${name}`);
  try {
    const items = await src.scrape({ query, segment, maxResults: MAX_PER_SOURCE });
    dbg(`${name}/${segment}/"${query}" → ${items.length} items`);
    return items;
  } catch (err) {
    log(`! ${name} failed on "${query}":`, err.message);
    return [];
  }
}

async function main() {
  const limit = pLimit(CONCURRENCY);
  const offerJobs = [];
  const demandJobs = [];

  for (const [segment, cfg] of Object.entries(SEGMENTS)) {
    for (const query of cfg.queries) {
      for (const src of cfg.offerSources) {
        offerJobs.push(limit(() => runSource(src, query, segment)));
      }
      for (const src of cfg.demandSources) {
        demandJobs.push(limit(() => runSource(src, query, segment)));
      }
    }
  }

  log(`Scheduling ${offerJobs.length} offer + ${demandJobs.length} demand jobs ` +
      `(concurrency ${CONCURRENCY})...`);

  const [offerResults, demandResults] = await Promise.all([
    Promise.all(offerJobs),
    Promise.all(demandJobs),
  ]);

  const offers = offerResults.flat();
  const demands = demandResults.flat();
  log(`Scraped: ${demands.length} demands, ${offers.length} offers.`);

  const pairs = pairDemandsAndOffers(demands, offers, { perSegmentLimit: 8 });
  log(`Matched ${pairs.length} deals.`);

  if (DRY_RUN) {
    console.log(JSON.stringify(pairs.map((p) => p.deal), null, 2));
    log("DRY_RUN: skipping Supabase upsert.");
  } else if (pairs.length > 0) {
    const res = await upsertDeals(pairs.map((p) => p.deal));
    log(`Supabase upsert: ${res.upserted} rows.`);
  }
}

main()
  .catch((err) => {
    log("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
