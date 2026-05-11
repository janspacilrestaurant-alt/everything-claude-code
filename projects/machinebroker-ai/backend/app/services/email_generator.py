"""LLM-driven multilingual B2B email drafting.

Produces an editable draft per side (buyer / seller) for a given match. The
buyer-side draft is sanitized: it never includes the seller's `source_url` or
`contact_email` -- the broker is the middleman.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import Settings, get_settings
from app.models import Listing, Match, TargetParty
from app.services.localization import detect_language

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class EmailDraft:
    target_party: TargetParty
    subject: str
    body: str
    language: str


_SYSTEM_PROMPT = (
    "You are an expert B2B industrial machinery broker drafting professional emails. "
    "Write in the requested BCP-47 language. Tone: concise, courteous, businesslike. "
    "Output STRICT JSON: {\"subject\": \"...\", \"body\": \"...\"}. "
    "Body should be 120-220 words, addressed to the recipient by company/contact context, "
    "signed 'MachineBroker AI'. Never include URLs unless they are explicitly provided in the prompt."
)


def _buyer_prompt(*, supply: Listing, demand: Listing, language: str) -> str:
    # Buyer-side: pitch the machine WITHOUT revealing the seller's URL or contact.
    return (
        f"Write a B2B sales outreach email in language '{language}' to a buyer who is looking for: \n"
        f"BUYER REQUIREMENT:\n"
        f"  Title: {demand.title}\n"
        f"  Description: {demand.description}\n"
        f"  Location: {demand.location or 'unspecified'}\n\n"
        f"We have located a matching listing from a vetted seller. Pitch it without naming the seller "
        f"or any URLs. Mention only:\n"
        f"  Machine: {supply.title}\n"
        f"  Brand: {supply.brand or 'n/a'}\n"
        f"  Year: {supply.year or 'n/a'}\n"
        f"  Asking price: {supply.price or 'on request'} {supply.currency}\n"
        f"  Location: {supply.location or 'EU'}\n"
        f"  Highlights: {supply.description}\n\n"
        "Invite the buyer to reply to arrange an inspection. Do NOT include any URL."
    )


def _seller_prompt(*, supply: Listing, demand: Listing, language: str) -> str:
    return (
        f"Write a B2B email in language '{language}' to a seller, informing them that we have a "
        f"qualified buyer for one of their listings.\n\n"
        f"SELLER LISTING:\n"
        f"  Title: {supply.title}\n"
        f"  Brand: {supply.brand or 'n/a'}\n"
        f"  Year: {supply.year or 'n/a'}\n"
        f"  Asking price: {supply.price or 'on request'} {supply.currency}\n\n"
        f"BUYER INTEREST (anonymized):\n"
        f"  Target machine: {demand.title}\n"
        f"  Use case: {demand.description}\n"
        f"  Buyer region: {demand.location or 'EU'}\n\n"
        "Confirm the listing is still available, ask for current condition and earliest inspection "
        "date, and let them know MachineBroker AI will handle the buyer relationship."
    )


# --- Provider call ------------------------------------------------------------


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _call_openai(*, settings: Settings, system: str, user: str) -> tuple[str, str]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        temperature=0.4,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = resp.choices[0].message.content or "{}"
    data = json.loads(content)
    return str(data.get("subject", "")).strip(), str(data.get("body", "")).strip()


# --- Public entrypoint --------------------------------------------------------


def draft_for_match(
    *,
    match: Match,
    supply: Listing,
    demand: Listing,
    settings: Settings | None = None,
) -> list[EmailDraft]:
    """Return one draft per target party (buyer, seller)."""

    settings = settings or get_settings()
    drafts: list[EmailDraft] = []

    for party, listing, prompt_fn in (
        (TargetParty.buyer, demand, _buyer_prompt),
        (TargetParty.seller, supply, _seller_prompt),
    ):
        language = detect_language(contact_email=listing.contact_email, location=listing.location)
        user_prompt = prompt_fn(supply=supply, demand=demand, language=language)
        try:
            subject, body = _call_openai(settings=settings, system=_SYSTEM_PROMPT, user=user_prompt)
        except Exception as exc:  # pragma: no cover
            logger.exception("Email drafting failed for match %s / %s", match.id, party.value)
            subject = f"[DRAFT FAILED] {supply.title}"
            body = (
                f"Automatic draft failed: {exc}. Please write this email manually. "
                f"Match ID: {match.id}, target: {party.value}, language: {language}."
            )
        drafts.append(
            EmailDraft(target_party=party, subject=subject, body=body, language=language)
        )

    return drafts
