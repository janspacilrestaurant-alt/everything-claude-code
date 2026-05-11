# Database schema

PostgreSQL 15. Three core tables backed by SQLAlchemy ORM models in `backend/app/models.py` and migrated via Alembic.

## `listings`

A unified table holding both supply (sellers) and demand (buyers). A single table keeps matching cheap and keeps the scraper interface symmetric.

| Column          | Type            | Notes                                                                 |
|-----------------|-----------------|-----------------------------------------------------------------------|
| `id`            | `uuid` PK       | `gen_random_uuid()`                                                   |
| `type`          | `listing_type`  | Enum: `supply` \| `demand`                                            |
| `title`         | `text`          | e.g. "Used Haas VF-2 CNC Mill, 2019"                                  |
| `description`   | `text`          | Free-form, fed to the LLM                                             |
| `brand`         | `text`          | Nullable                                                              |
| `year`          | `integer`       | Manufacture year, nullable                                            |
| `price`         | `numeric(14,2)` | EUR by convention, nullable for demand                                |
| `currency`      | `char(3)`       | ISO-4217, default `EUR`                                               |
| `location`      | `text`          | "Stuttgart, DE" — country code drives language inference              |
| `contact_email` | `citext`        | Indexed                                                               |
| `source_url`    | `text`          | Scraper URL; **never** revealed to the buyer side                     |
| `status`        | `listing_status`| Enum: `active` \| `paused` \| `closed`. Default `active`              |
| `embedding`     | `vector(1536)`  | Optional pgvector column for semantic matching (nullable)             |
| `created_at`    | `timestamptz`   | Default `now()`                                                       |
| `updated_at`    | `timestamptz`   | Default `now()`                                                       |

Indexes: `(type, status)`, `(contact_email)`, optional ivfflat on `embedding`.

## `matches`

| Column             | Type             | Notes                                              |
|--------------------|------------------|----------------------------------------------------|
| `id`               | `uuid` PK        |                                                    |
| `supply_id`        | `uuid` FK        | → `listings(id)` ON DELETE CASCADE                 |
| `demand_id`        | `uuid` FK        | → `listings(id)` ON DELETE CASCADE                 |
| `match_percentage` | `numeric(5,2)`   | 0.00 – 100.00                                      |
| `ai_reasoning`     | `text`           | Short LLM justification                            |
| `status`           | `match_status`   | Enum: `pending` \| `emailed` \| `successful` \| `rejected`. Default `pending` |
| `created_at`       | `timestamptz`    | Default `now()`                                    |

Constraints: `UNIQUE(supply_id, demand_id)` so re-running matching is idempotent.

## `communications`

| Column          | Type                | Notes                                            |
|-----------------|---------------------|--------------------------------------------------|
| `id`            | `uuid` PK           |                                                  |
| `match_id`      | `uuid` FK           | → `matches(id)` ON DELETE CASCADE                |
| `target_party`  | `target_party`      | Enum: `buyer` \| `seller`                        |
| `subject`       | `text`              | LLM-generated                                    |
| `email_content` | `text`              | LLM-generated, editable by broker before send    |
| `language`      | `char(5)`           | BCP-47 (`en`, `de`, `it`, `pt-BR`, …)            |
| `sent_status`   | `sent_status`       | Enum: `draft` \| `queued` \| `sent` \| `failed`. Default `draft` |
| `sent_at`       | `timestamptz`       | Nullable                                         |
| `error_message` | `text`              | Nullable, populated on `failed`                  |
| `created_at`    | `timestamptz`       | Default `now()`                                  |
| `updated_at`    | `timestamptz`       | Default `now()`                                  |

Constraints: `UNIQUE(match_id, target_party)` — exactly one draft per side per match.

## Enums

```sql
CREATE TYPE listing_type   AS ENUM ('supply', 'demand');
CREATE TYPE listing_status AS ENUM ('active', 'paused', 'closed');
CREATE TYPE match_status   AS ENUM ('pending', 'emailed', 'successful', 'rejected');
CREATE TYPE target_party   AS ENUM ('buyer', 'seller');
CREATE TYPE sent_status    AS ENUM ('draft', 'queued', 'sent', 'failed');
```
