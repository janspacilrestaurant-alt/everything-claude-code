"""initial schema: listings, matches, communications

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    listing_type = sa.Enum("supply", "demand", name="listing_type")
    listing_status = sa.Enum("active", "paused", "closed", name="listing_status")
    match_status = sa.Enum("pending", "emailed", "successful", "rejected", name="match_status")
    target_party = sa.Enum("buyer", "seller", name="target_party")
    sent_status = sa.Enum("draft", "queued", "sent", "failed", name="sent_status")

    op.create_table(
        "listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", listing_type, nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("brand", sa.Text()),
        sa.Column("year", sa.Integer()),
        sa.Column("price", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("location", sa.Text()),
        sa.Column("contact_email", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text()),
        sa.Column("status", listing_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("year IS NULL OR year BETWEEN 1900 AND 2100", name="ck_listings_year"),
    )
    op.create_index("ix_listings_contact_email", "listings", ["contact_email"])
    op.create_index("ix_listings_type_status", "listings", ["type", "status"])

    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "supply_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "demand_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("match_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("ai_reasoning", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", match_status, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("supply_id", "demand_id", name="uq_matches_supply_demand"),
        sa.CheckConstraint(
            "match_percentage >= 0 AND match_percentage <= 100",
            name="ck_matches_percentage_range",
        ),
    )
    op.create_index("ix_matches_status_pct", "matches", ["status", "match_percentage"])

    op.create_table(
        "communications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_party", target_party, nullable=False),
        sa.Column("subject", sa.Text(), nullable=False, server_default=""),
        sa.Column("email_content", sa.Text(), nullable=False, server_default=""),
        sa.Column("language", sa.String(5), nullable=False, server_default="en"),
        sa.Column("sent_status", sent_status, nullable=False, server_default="draft"),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("match_id", "target_party", name="uq_comms_match_party"),
    )


def downgrade() -> None:
    op.drop_table("communications")
    op.drop_index("ix_matches_status_pct", table_name="matches")
    op.drop_table("matches")
    op.drop_index("ix_listings_type_status", table_name="listings")
    op.drop_index("ix_listings_contact_email", table_name="listings")
    op.drop_table("listings")
    for enum_name in ("sent_status", "target_party", "match_status", "listing_status", "listing_type"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
