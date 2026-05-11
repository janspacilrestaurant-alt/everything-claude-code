"""Ingestion endpoints for scrapers.

Scrapers POST already-normalized JSON. These endpoints are intentionally thin:
deduplicate on `source_url`, upsert into `listings`, return the stored row.
"""

from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import DbSession
from app.models import Listing, ListingType
from app.schemas import ListingCreate, ListingOut

router = APIRouter(prefix="/scraping", tags=["scraping"])


def _upsert(db, payload: ListingCreate, forced_type: ListingType) -> Listing:
    data = payload.model_dump()
    data["type"] = forced_type
    existing: Listing | None = None
    if data.get("source_url"):
        existing = db.execute(
            select(Listing).where(Listing.source_url == data["source_url"])
        ).scalar_one_or_none()
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    listing = Listing(**data)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


@router.post("/supply", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def ingest_supply(payload: ListingCreate, db: DbSession) -> Listing:
    return _upsert(db, payload, ListingType.supply)


@router.post("/demand", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def ingest_demand(payload: ListingCreate, db: DbSession) -> Listing:
    return _upsert(db, payload, ListingType.demand)


@router.post("/supply/bulk", response_model=list[ListingOut], status_code=status.HTTP_201_CREATED)
def ingest_supply_bulk(payloads: list[ListingCreate], db: DbSession) -> list[Listing]:
    return [_upsert(db, p, ListingType.supply) for p in payloads]


@router.post("/demand/bulk", response_model=list[ListingOut], status_code=status.HTTP_201_CREATED)
def ingest_demand_bulk(payloads: list[ListingCreate], db: DbSession) -> list[Listing]:
    return [_upsert(db, p, ListingType.demand) for p in payloads]
