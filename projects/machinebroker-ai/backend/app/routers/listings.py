import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import DbSession
from app.models import Listing, ListingStatus, ListingType
from app.schemas import ListingCreate, ListingOut

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("", response_model=list[ListingOut])
def list_listings(
    db: DbSession,
    type: ListingType | None = Query(default=None),
    status_: ListingStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[Listing]:
    stmt = select(Listing).order_by(Listing.created_at.desc()).limit(limit).offset(offset)
    if type is not None:
        stmt = stmt.where(Listing.type == type)
    if status_ is not None:
        stmt = stmt.where(Listing.status == status_)
    return list(db.execute(stmt).scalars())


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(payload: ListingCreate, db: DbSession) -> Listing:
    listing = Listing(**payload.model_dump())
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: uuid.UUID, db: DbSession) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: uuid.UUID, db: DbSession) -> None:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.delete(listing)
    db.commit()
