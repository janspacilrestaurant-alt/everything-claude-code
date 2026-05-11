from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DbSession
from app.models import Listing, ListingStatus, ListingType, Match, MatchStatus
from app.schemas import StatsResponse

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def overview(db: DbSession) -> StatsResponse:
    active_supplies = db.execute(
        select(func.count(Listing.id)).where(
            Listing.type == ListingType.supply, Listing.status == ListingStatus.active
        )
    ).scalar_one()
    active_demands = db.execute(
        select(func.count(Listing.id)).where(
            Listing.type == ListingType.demand, Listing.status == ListingStatus.active
        )
    ).scalar_one()
    total_matches = db.execute(select(func.count(Match.id))).scalar_one()
    matches_emailed = db.execute(
        select(func.count(Match.id)).where(
            Match.status.in_([MatchStatus.emailed, MatchStatus.successful])
        )
    ).scalar_one()
    matches_successful = db.execute(
        select(func.count(Match.id)).where(Match.status == MatchStatus.successful)
    ).scalar_one()

    success_rate = (matches_successful / matches_emailed) if matches_emailed else 0.0

    return StatsResponse(
        active_supplies=active_supplies,
        active_demands=active_demands,
        total_matches=total_matches,
        matches_emailed=matches_emailed,
        matches_successful=matches_successful,
        success_rate=round(success_rate, 4),
    )
