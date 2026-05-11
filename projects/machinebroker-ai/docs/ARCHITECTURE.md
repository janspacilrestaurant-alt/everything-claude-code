# Architecture

```
┌──────────────┐    JSON    ┌────────────────────────────┐    SQL    ┌────────────┐
│  Scrapers    │ ─────────► │  FastAPI  /scraping/*      │ ────────► │ PostgreSQL │
└──────────────┘            │                            │           │            │
                            │  /matches/run/{demand_id}  │           │  listings  │
┌──────────────┐    REST    │     │                      │           │  matches   │
│ Next.js UI   │ ◄────────► │     ▼                      │           │  comms     │
│  - Dashboard │            │  ai_matching.score(...)    │           └─────┬──────┘
│  - Listings  │            │     │                      │                 │
│  - Match     │            │     ▼ (≥80% threshold)     │                 │
│    Center    │            │  email_generator.draft(...)│                 │
│  - Email     │            │     │                      │                 │
│    review    │            │     ▼                      │                 │
│    modal     │            │  email_sender.send(...)    │ ──── SMTP ────► │
└──────────────┘            └────────────────────────────┘                 ▼
                                                                 SendGrid / SMTP
```

## Services

### `services/ai_matching.py`

Two implementations behind one interface (`Matcher.score`):

1. **Embedding matcher** — pgvector cosine similarity between demand and each supply. Cheap, used as a pre-filter (top-N candidates).
2. **Prompt matcher** — for each candidate runs `gpt-4o` with a structured JSON-mode prompt that returns `{ "match_percentage": int, "reasoning": str }`. Used to assign the final score and reasoning written into `matches`.

Switch via `MATCH_STRATEGY=embedding|prompt|hybrid` env var. Default is `hybrid`.

### `services/email_generator.py`

Single prompt template parameterized by `target_party`. Inputs: the buyer description, the supply description (sanitized — never the seller's `source_url` or `contact_email` when drafting the buyer email), the detected language. Output: `{ "subject": str, "body": str, "language": str }` validated against a Pydantic model.

Language detection happens in `services/localization.py` from (in order): explicit `Listing.contact_email` TLD, `Listing.location` country, fallback `en`.

### `services/email_sender.py`

Abstract `EmailTransport` with two implementations:
- `SmtpTransport` (stdlib `smtplib`, STARTTLS) for self-host
- `SendGridTransport` for hosted

Selected via `EMAIL_TRANSPORT=smtp|sendgrid`.

## Frontend

Next.js App Router. Three pages:

- `/` — KPI cards (active listings, total matches, success rate) + recent matches table
- `/listings` — filterable Shadcn `<DataTable>` of supplies & demands
- `/matches` — the Match Center. Each row: `% score`, brand/title pair, AI reasoning, **Review & Send** button → opens `EmailReviewDialog` with two `<Textarea>`s (buyer / seller), editable, with a per-side **Send** button

All API access goes through `lib/api.ts` which is a thin typed `fetch` wrapper pointing at `NEXT_PUBLIC_API_URL`.

## Threshold + automation

`MATCH_AUTO_DRAFT_THRESHOLD` (default 80) controls when the matching endpoint auto-creates `Communication` drafts. Below the threshold the match is stored with `status=pending` but no drafts are created — the broker can still trigger drafting manually from the Match Center.
