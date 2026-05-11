import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ListingType(str, enum.Enum):
    supply = "supply"
    demand = "demand"


class ListingStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    closed = "closed"


class MatchStatus(str, enum.Enum):
    pending = "pending"
    emailed = "emailed"
    successful = "successful"
    rejected = "rejected"


class TargetParty(str, enum.Enum):
    buyer = "buyer"
    seller = "seller"


class SentStatus(str, enum.Enum):
    draft = "draft"
    queued = "queued"
    sent = "sent"
    failed = "failed"


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[ListingType] = mapped_column(Enum(ListingType, name="listing_type"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)
    price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    location: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    source_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus, name="listing_status"), default=ListingStatus.active, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_listings_type_status", "type", "status"),
        CheckConstraint("year IS NULL OR year BETWEEN 1900 AND 2100", name="ck_listings_year"),
    )


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supply_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    demand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    match_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    ai_reasoning: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="match_status"), default=MatchStatus.pending, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    supply: Mapped[Listing] = relationship("Listing", foreign_keys=[supply_id])
    demand: Mapped[Listing] = relationship("Listing", foreign_keys=[demand_id])
    communications: Mapped[list["Communication"]] = relationship(
        "Communication", back_populates="match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("supply_id", "demand_id", name="uq_matches_supply_demand"),
        CheckConstraint(
            "match_percentage >= 0 AND match_percentage <= 100",
            name="ck_matches_percentage_range",
        ),
        Index("ix_matches_status_pct", "status", "match_percentage"),
    )


class Communication(Base):
    __tablename__ = "communications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    target_party: Mapped[TargetParty] = mapped_column(
        Enum(TargetParty, name="target_party"), nullable=False
    )
    subject: Mapped[str] = mapped_column(Text, nullable=False, default="")
    email_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="en")
    sent_status: Mapped[SentStatus] = mapped_column(
        Enum(SentStatus, name="sent_status"), default=SentStatus.draft, nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    match: Mapped[Match] = relationship("Match", back_populates="communications")

    __table_args__ = (
        UniqueConstraint("match_id", "target_party", name="uq_comms_match_party"),
    )
