# Machinery Deals Scraper

Daily scraper for the Machinery Deals CRM. Pulls fresh offers (Machineseeker,
Exapro, Surplex) and demands (EEN partnering opportunities, TED tenders) for
each of the 6 segments defined in `matchmaker/CLAUDE.md`, matches demand to
offer by keyword overlap, and upserts the resulting `deals_eu` rows into
Supabase. The CRM reads from Supabase, so a single scraper run shows up in
every connected browser/device.

## What it does on each run

1. For every segment × query × source listed in `src/config.js`, launch a
   real Chromium (Playwright) and scrape the public search page.
2. Normalize each result to `{title, url, country, priceK, …}`.
3. Pair demands and offers by token-overlap (Jaccard ≥ 0.08) per segment, cap
   8 deals per segment.
4. Upsert into `deals_eu` keyed on a deterministic SHA-1 of `(demand_url,
   offer_url)` so re-runs merge rather than duplicate.

Public scraping only — no marketplace logins. Polite delays (1–2 s) between
requests per source.

## Anti-bot hardening

- **UA rotation** (`src/lib/ua.js`) — each new browser context picks a fresh
  realistic desktop UA from a pinned pool of Chrome/Firefox/Safari strings.
- **Exponential backoff + auto-throttle** (`src/lib/retry.js`) — every source
  wraps its initial `page.goto` (or `fetch` for Bazoš) in `withRetry`, which
  retries on 429/403/5xx/timeouts with `base × factor^attempt + jitter` delay.
  A per-host error window inflates the base delay when a target starts
  pushing back, so the scraper auto-slows instead of getting banned.
- **Residential proxy support** — set `HTTPS_PROXY` in `.env`. Playwright
  reads it natively; no code change needed. Worth paying for (~€50/mo) only
  if EEN/Surplex start consistently returning 403 — for our ~150 req/day
  volume that's unlikely.
- **Bazoš.cz mobile API** (`src/sources/bazos.js`) — Bazoš rejects everything
  that doesn't look like the real Android/iOS app, so the source sends
  `User-Agent: bazos/2.12.1` + a fake-but-stable `x-deviceid` per request,
  pages by `offset` in increments of 20 (Bazoš enforces multiples), and stops
  at the platform's hard 200-result cap. Set `BAZOS_SECTION` in `.env` to
  the right 2-char code once you've probed (see comment in the source).

What we deliberately don't do at this scale: TLS fingerprint spoofing
(Playwright's real Chromium passes), CAPTCHA solving, distributed crawling
across nodes. Re-evaluate above ~10k requests/day.

## Local quickstart

```bash
cd matchmaker/scraper
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npx playwright install --with-deps chromium
npm run scrape:dry    # prints matched deals, doesn't touch Supabase
npm run scrape        # production: writes to deals_eu
```

Useful flags (set in `.env` or inline):

| Env var | Meaning |
|---------|---------|
| `HEADLESS=0` | Show the browser (debug only) |
| `DRY_RUN=1` | Print pairs as JSON, skip Supabase |
| `DEBUG=1` | Verbose per-source logs |
| `CONCURRENCY=2` | Parallel scraping jobs |
| `MAX_RESULTS_PER_SOURCE=20` | Cap per query per source |

## Cloud deploy (recommended)

The Dockerfile bases off Microsoft's `playwright:v1.48.0-jammy` image, so
all Chromium OS dependencies are baked in.

```bash
# on the server
git clone <repo>
cd everything-claude-code/matchmaker/scraper
cp .env.example .env       # fill in real values; chmod 600 .env
docker compose build

# one-shot test
docker compose run --rm scraper

# daily cron
sudo cp crontab.example /etc/cron.d/machinery-deals-scraper
sudo chmod 644 /etc/cron.d/machinery-deals-scraper
```

Cheapest cloud options that fit:

- **Hetzner Cloud CX22** (€3.79/month, 2 vCPU, 4 GB) — plenty for daily runs
- **DigitalOcean Basic Droplet** (\$6/month, 1 GB)
- **Oracle Cloud Always Free** (4 ARM vCPU, 24 GB RAM — free) — needs an
  ARM-compatible Playwright image; use `mcr.microsoft.com/playwright:v1.48.0-noble-arm64`
- **GitHub Actions** (free public-repo budget) — schedule a workflow on
  `cron: '17 4 * * *'`. Beware: GitHub IPs sometimes get rate-limited by EEN
  and Surplex; expect ~30 % fewer results than from a residential cloud IP.

## Supabase schema

The CRM expects rows in a `deals_eu` table whose columns mirror the deal
JSON object. Create it once:

```sql
create table public.deals_eu (
  id text primary key,
  status text not null default 'new',
  segment text not null,
  weight_tier int default 1,
  match_criteria jsonb,
  demand jsonb,
  offer jsonb,
  profit jsonb,
  flags jsonb,
  warnings jsonb,
  notes text default '',
  emails jsonb default '{"buyer":null,"seller":null}'::jsonb,
  created_at timestamptz default now(),
  link_kind jsonb,
  updated_at timestamptz default now()
);
-- service_role bypasses RLS; for the in-browser CRM enable RLS + a read policy
-- for the anon role.
alter table public.deals_eu enable row level security;
create policy "anon read" on public.deals_eu for select to anon using (true);
```

If you'd rather upsert the camelCase shape the CRM already uses (no SQL column
renaming), keep the single column `data jsonb` model and rewrite
`lib/supabase.js` accordingly — see code comments there.

## Extending it

- New source → drop a file in `src/sources/<name>.js` that exports
  `scrape({query, segment, maxResults}) → Array<Item>`. Wire it into
  `SOURCES` in `src/index.js` and the segment config.
- New segment / queries → edit `src/config.js`.
- Smarter matching → tweak `src/lib/matcher.js` (e.g. weight brand matches
  heavier, parse year/price from titles).

## When the scraper breaks

Marketplace HTML changes a few times a year. Each source's `$$eval` selector
is the most fragile part. Bump `MAX_RESULTS_PER_SOURCE` and re-run with
`DEBUG=1 HEADLESS=0` to watch what the selector matches. The scraper is
designed to fail loudly per source — one broken source doesn't kill the run.
