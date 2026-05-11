import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ListingStatus, ListingType, MatchStatus, SentStatus, TargetParty


# --- Listings -----------------------------------------------------------------


class ListingBase(BaseModel):
    type: ListingType
    title: str
    description: str
    brand: str | None = None
    year: int | None = Field(default=None, ge=1900, le=2100)
    price: Decimal | None = None
    currency: str = "EUR"
    location: str | None = None
    contact_email: EmailStr
    source_url: str | None = None
    status: ListingStatus = ListingStatus.active


class ListingCreate(ListingBase):
    pass


class ListingOut(ListingBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Matches ------------------------------------------------------------------


class MatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    supply_id: uuid.UUID
    demand_id: uuid.UUID
    match_percentage: Decimal
    ai_reasoning: str
    status: MatchStatus
    created_at: datetime


class MatchWithListings(MatchOut):
    supply: ListingOut
    demand: ListingOut


class RunMatchResponse(BaseModel):
    demand_id: uuid.UUID
    matches_created: int
    drafts_created: int
    threshold: int


# --- Communications -----------------------------------------------------------


class CommunicationBase(BaseModel):
    target_party: TargetParty
    subject: str
    email_content: str
    language: str = "en"


class CommunicationUpdate(BaseModel):
    subject: str | None = None
    email_content: str | None = None
    language: str | None = None


class CommunicationOut(CommunicationBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    match_id: uuid.UUID
    sent_status: SentStatus
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class SendResult(BaseModel):
    id: uuid.UUID
    sent_status: SentStatus
    error_message: str | None = None


# --- Stats --------------------------------------------------------------------


class StatsResponse(BaseModel):
    active_supplies: int
    active_demands: int
    total_matches: int
    matches_emailed: int
    matches_successful: int
    success_rate: float  # successful / emailed, 0..1
