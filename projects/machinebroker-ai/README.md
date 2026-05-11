# MachineBroker AI

AI-driven B2B middleman for industrial machinery. Scrapes supply & demand, matches them with an LLM, and auto-drafts localized B2B emails for the broker to review and send.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + Shadcn UI
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2 + Alembic
- **Database:** PostgreSQL 15 (works against Supabase out of the box)
- **AI:** OpenAI `gpt-4o` (matching + multilingual email generation) with a pluggable provider interface so Anthropic `claude-opus-4-7` can be swapped in
- **Email:** SMTP / SendGrid via the same provider interface

## Repository layout

```
projects/machinebroker-ai/
├── backend/                  Python FastAPI service
│   ├── app/
│   │   ├── main.py           FastAPI entrypoint + CORS + router wiring
│   │   ├── config.py         Pydantic settings (env-driven)
│   │   ├── db.py             SQLAlchemy engine + session
│   │   ├── models.py         ORM models: Listing, Match, Communication
│   │   ├── schemas.py        Pydantic request/response schemas
│   │   ├── deps.py           FastAPI dependencies (DB session, settings)
│   │   ├── routers/
│   │   │   ├── listings.py        CRUD for supply/demand
│   │   │   ├── matches.py         List matches, trigger matching on a demand
│   │   │   ├── communications.py  Generate + edit + send emails
│   │   │   ├── scraping.py        Ingest scraped JSON payloads (dummy endpoints)
│   │   │   └── stats.py           Aggregate counts + success rate
│   │   └── services/
│   │       ├── ai_matching.py     LLM-based matching (embeddings or prompt)
│   │       ├── email_generator.py LLM email drafting with language detection
│   │       ├── email_sender.py    SMTP / SendGrid abstraction
│   │       └── localization.py    Language inference from location/email
│   ├── alembic/              DB migrations
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
└── frontend/                 Next.js dashboard
    ├── app/
    │   ├── page.tsx          Overview + stats cards
    │   ├── listings/page.tsx Listings table
    │   └── matches/page.tsx  Match Center + email review modal
    ├── components/           Shadcn primitives + composed UI
    ├── lib/api.ts            Typed fetch client for the FastAPI backend
    └── package.json
```

## Quickstart

### Backend

```bash
cd projects/machinebroker-ai/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill DATABASE_URL + OPENAI_API_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

### Frontend

```bash
cd projects/machinebroker-ai/frontend
pnpm install        # or npm / yarn
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm dev
```

Dashboard: http://localhost:3000

## Core flows

1. **Ingest** — scrapers POST normalized JSON to `/scraping/supply` or `/scraping/demand`.
2. **Match** — POST `/matches/run/{demand_id}` triggers `ai_matching.score_demand_against_supplies`, which writes one `Match` row per supply with `match_percentage` and `ai_reasoning`.
3. **Generate emails** — Any match `>= 80%` auto-queues `Communication` rows for buyer + seller. `email_generator.draft_for_match` detects the language from the contact and produces a B2B email (the buyer-side email omits the seller's source URL).
4. **Broker review** — In the Match Center the broker opens a modal, edits both drafts, then hits **Send**, which fans out via `email_sender`.

See `docs/ARCHITECTURE.md` and `docs/SCHEMA.md` for details.
