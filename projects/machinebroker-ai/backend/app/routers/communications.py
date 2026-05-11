import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, SettingsDep
from app.models import Communication, Match, MatchStatus, SentStatus, TargetParty
from app.schemas import CommunicationOut, CommunicationUpdate, SendResult
from app.services.email_sender import OutboundEmail, get_transport

router = APIRouter(prefix="/communications", tags=["communications"])


@router.get("/by-match/{match_id}", response_model=list[CommunicationOut])
def list_for_match(match_id: uuid.UUID, db: DbSession) -> list[Communication]:
    return list(
        db.execute(
            select(Communication)
            .where(Communication.match_id == match_id)
            .order_by(Communication.target_party)
        ).scalars()
    )


@router.patch("/{communication_id}", response_model=CommunicationOut)
def update_communication(
    communication_id: uuid.UUID, payload: CommunicationUpdate, db: DbSession
) -> Communication:
    comm = db.get(Communication, communication_id)
    if comm is None:
        raise HTTPException(status_code=404, detail="Communication not found")
    if comm.sent_status == SentStatus.sent:
        raise HTTPException(status_code=409, detail="Cannot edit an already-sent email")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(comm, field, value)
    db.commit()
    db.refresh(comm)
    return comm


@router.post("/{communication_id}/send", response_model=SendResult, status_code=status.HTTP_200_OK)
def send_communication(
    communication_id: uuid.UUID, db: DbSession, settings: SettingsDep
) -> SendResult:
    comm = db.execute(
        select(Communication)
        .options(selectinload(Communication.match).selectinload(Match.supply))
        .options(selectinload(Communication.match).selectinload(Match.demand))
        .where(Communication.id == communication_id)
    ).scalar_one_or_none()
    if comm is None:
        raise HTTPException(status_code=404, detail="Communication not found")
    if comm.sent_status == SentStatus.sent:
        raise HTTPException(status_code=409, detail="Email already sent")

    listing = (
        comm.match.demand if comm.target_party == TargetParty.buyer else comm.match.supply
    )
    if not listing.contact_email:
        raise HTTPException(status_code=400, detail="Recipient has no contact_email")

    transport = get_transport(settings)
    try:
        transport.send(
            OutboundEmail(
                to=listing.contact_email,
                subject=comm.subject,
                body=comm.email_content,
                language=comm.language,
            )
        )
    except Exception as exc:
        comm.sent_status = SentStatus.failed
        comm.error_message = str(exc)
        db.commit()
        return SendResult(id=comm.id, sent_status=comm.sent_status, error_message=str(exc))

    comm.sent_status = SentStatus.sent
    comm.sent_at = datetime.now(timezone.utc)
    comm.error_message = None

    # Promote the parent match to `emailed` once at least one side has gone out.
    if comm.match.status == MatchStatus.pending:
        comm.match.status = MatchStatus.emailed

    db.commit()
    return SendResult(id=comm.id, sent_status=comm.sent_status)
