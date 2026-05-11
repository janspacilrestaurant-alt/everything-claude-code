import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.deps import DbSession, SettingsDep
from app.models import (
    Communication,
    Listing,
    ListingStatus,
    ListingType,
    Match,
    MatchStatus,
)
from app.schemas import MatchWithListings, RunMatchResponse
from app.services.ai_matching import score_demand_against_supplies
from app.services.email_generator import draft_for_match

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchWithListings])
def list_matches(
    db: DbSession,
    min_pct: float = Query(default=0, ge=0, le=100),
    status_: MatchStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, le=500),
) -> list[Match]:
    stmt = (
        select(Match)
        .options(selectinload(Match.supply), selectinload(Match.demand))
        .where(Match.match_percentage >= Decimal(str(min_pct)))
        .order_by(Match.match_percentage.desc(), Match.created_at.desc())
        .limit(limit)
    )
    if status_ is not None:
        stmt = stmt.where(Match.status == status_)
    return list(db.execute(stmt).scalars())


@router.get("/{match_id}", response_model=MatchWithListings)
def get_match(match_id: uuid.UUID, db: DbSession) -> Match:
    match = db.execute(
        select(Match)
        .options(selectinload(Match.supply), selectinload(Match.demand))
        .where(Match.id == match_id)
    ).scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.post(
    "/run/{demand_id}",
    response_model=RunMatchResponse,
    status_code=status.HTTP_201_CREATED,
)
def run_matching(demand_id: uuid.UUID, db: DbSession, settings: SettingsDep) -> RunMatchResponse:
    """Score `demand_id` against all active supplies, persist matches, and
    auto-draft communications for any match >= `match_auto_draft_threshold`.
    Idempotent: re-running upserts on `(supply_id, demand_id)`.
    """

    demand = db.get(Listing, demand_id)
    if demand is None or demand.type != ListingType.demand:
        raise HTTPException(status_code=404, detail="Demand listing not found")

    supplies = list(
        db.execute(
            select(Listing).where(
                Listing.type == ListingType.supply,
                Listing.status == ListingStatus.active,
            )
        ).scalars()
    )

    candidates = score_demand_against_supplies(
        demand=demand, supplies=supplies, settings=settings
    )

    matches_created = 0
    drafts_created = 0
    threshold = settings.match_auto_draft_threshold

    supplies_by_id = {str(s.id): s for s in supplies}

    for c in candidates:
        stmt = (
            pg_insert(Match)
            .values(
                supply_id=uuid.UUID(c.supply_id),
                demand_id=demand.id,
                match_percentage=Decimal(str(c.match_percentage)),
                ai_reasoning=c.ai_reasoning,
                status=MatchStatus.pending,
            )
            .on_conflict_do_update(
                index_elements=["supply_id", "demand_id"],
                set_={
                    "match_percentage": Decimal(str(c.match_percentage)),
                    "ai_reasoning": c.ai_reasoning,
                },
            )
            .returning(Match.id)
        )
        match_id = db.execute(stmt).scalar_one()
        matches_created += 1

        if c.match_percentage >= threshold:
            match_obj = db.get(Match, match_id)
            existing_parties = {c_.target_party for c_ in match_obj.communications}
            if existing_parties:
                continue  # already drafted; skip
            supply = supplies_by_id[c.supply_id]
            drafts = draft_for_match(match=match_obj, supply=supply, demand=demand, settings=settings)
            for d in drafts:
                db.add(
                    Communication(
                        match_id=match_obj.id,
                        target_party=d.target_party,
                        subject=d.subject,
                        email_content=d.body,
                        language=d.language,
                    )
                )
                drafts_created += 1

    db.commit()

    return RunMatchResponse(
        demand_id=demand.id,
        matches_created=matches_created,
        drafts_created=drafts_created,
        threshold=threshold,
    )


@router.post("/{match_id}/draft", response_model=MatchWithListings)
def force_draft(match_id: uuid.UUID, db: DbSession, settings: SettingsDep) -> Match:
    """Manually generate (or regenerate) buyer/seller drafts for a match,
    regardless of percentage."""

    match = db.execute(
        select(Match)
        .options(selectinload(Match.supply), selectinload(Match.demand), selectinload(Match.communications))
        .where(Match.id == match_id)
    ).scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    drafts = draft_for_match(
        match=match, supply=match.supply, demand=match.demand, settings=settings
    )
    existing = {c.target_party: c for c in match.communications}
    for d in drafts:
        if d.target_party in existing:
            comm = existing[d.target_party]
            comm.subject = d.subject
            comm.email_content = d.body
            comm.language = d.language
        else:
            db.add(
                Communication(
                    match_id=match.id,
                    target_party=d.target_party,
                    subject=d.subject,
                    email_content=d.body,
                    language=d.language,
                )
            )
    db.commit()
    db.refresh(match)
    return match
