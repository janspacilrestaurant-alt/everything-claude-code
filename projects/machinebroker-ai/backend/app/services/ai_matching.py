"""AI-driven matching between a demand and the pool of active supplies.

The public entrypoint is :func:`score_demand_against_supplies`. It returns a
list of `MatchCandidate` objects ordered by descending percentage. The router
layer is responsible for persisting them as `Match` rows.

Strategy is chosen via `Settings.match_strategy`:

* ``embedding`` — pgvector / in-memory cosine similarity on text embeddings.
  Cheap and fast; quality depends on the embedding model.
* ``prompt``    — `gpt-4o` is asked, per supply, to produce a numeric score
  and a one-sentence reasoning string. High quality but O(N) LLM calls.
* ``hybrid``    — embedding pass narrows to the top `match_candidate_limit`
  supplies, then prompt-scores those. This is the default.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from typing import Iterable

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import Settings, get_settings
from app.models import Listing, ListingStatus, ListingType

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MatchCandidate:
    supply_id: str
    match_percentage: float
    ai_reasoning: str


# --- Provider abstraction -----------------------------------------------------


class _OpenAIProvider:
    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        self._client = OpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model
        self._embedding_model = settings.openai_embedding_model

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def embed(self, texts: list[str]) -> list[list[float]]:
        resp = self._client.embeddings.create(model=self._embedding_model, input=texts)
        return [d.embedding for d in resp.data]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def score(self, *, demand_text: str, supply_text: str) -> tuple[float, str]:
        """Return (percentage, reasoning)."""

        system = (
            "You are an expert B2B industrial machinery broker. "
            "Compare a buyer's requirement with a seller's listing and return a strict JSON "
            'object: {"match_percentage": <integer 0-100>, "reasoning": "<one sentence>"}. '
            "Account for machine type, brand compatibility, year, condition, price fit, and location. "
            "Be conservative: only score >=80 when the listing genuinely satisfies the requirement."
        )
        user = f"BUYER REQUIREMENT:\n{demand_text}\n\nSELLER LISTING:\n{supply_text}"
        resp = self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            temperature=0.1,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        pct = float(data.get("match_percentage", 0))
        pct = max(0.0, min(100.0, pct))
        reasoning = str(data.get("reasoning", "")).strip()
        return pct, reasoning


def _provider(settings: Settings) -> _OpenAIProvider:
    # Anthropic provider could be added here behind the same interface.
    if settings.ai_provider != "openai":
        raise NotImplementedError(
            f"AI provider '{settings.ai_provider}' is not wired up yet; only 'openai' is."
        )
    return _OpenAIProvider(settings)


# --- Text serialization -------------------------------------------------------


def _listing_to_text(listing: Listing) -> str:
    parts = [f"Title: {listing.title}"]
    if listing.brand:
        parts.append(f"Brand: {listing.brand}")
    if listing.year:
        parts.append(f"Year: {listing.year}")
    if listing.price is not None:
        parts.append(f"Price: {listing.price} {listing.currency}")
    if listing.location:
        parts.append(f"Location: {listing.location}")
    parts.append(f"Description: {listing.description}")
    return "\n".join(parts)


# --- Similarity helpers -------------------------------------------------------


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def _similarity_to_percentage(sim: float) -> float:
    """Cosine similarity for normalized embeddings is in [-1, 1]; map to [0, 100]."""
    sim = max(-1.0, min(1.0, sim))
    return round(((sim + 1.0) / 2.0) * 100.0, 2)


# --- Public entrypoint --------------------------------------------------------


def score_demand_against_supplies(
    *,
    demand: Listing,
    supplies: Iterable[Listing],
    settings: Settings | None = None,
) -> list[MatchCandidate]:
    """Score `demand` against every supply in `supplies`.

    The caller is responsible for filtering `supplies` to e.g. `ListingType.supply`
    and `ListingStatus.active`. This function is pure: it returns candidates,
    it does not persist anything.
    """

    if demand.type != ListingType.demand:
        raise ValueError("score_demand_against_supplies expects a demand listing")

    supplies = [s for s in supplies if s.type == ListingType.supply and s.status == ListingStatus.active]
    if not supplies:
        return []

    settings = settings or get_settings()
    strategy = settings.match_strategy
    provider = _provider(settings)

    demand_text = _listing_to_text(demand)
    supply_texts = [_listing_to_text(s) for s in supplies]

    # ---- Embedding pre-filter ------------------------------------------------
    similarity_by_id: dict[str, float] = {}
    if strategy in ("embedding", "hybrid"):
        try:
            vectors = provider.embed([demand_text, *supply_texts])
        except Exception as exc:  # pragma: no cover - network failure path
            logger.warning("Embedding call failed, falling back to prompt-only: %s", exc)
            vectors = []

        if vectors:
            demand_vec, supply_vecs = vectors[0], vectors[1:]
            for supply, vec in zip(supplies, supply_vecs):
                similarity_by_id[str(supply.id)] = _cosine(demand_vec, vec)

    if strategy == "embedding":
        return sorted(
            (
                MatchCandidate(
                    supply_id=str(s.id),
                    match_percentage=_similarity_to_percentage(similarity_by_id.get(str(s.id), 0.0)),
                    ai_reasoning="Scored by embedding similarity.",
                )
                for s in supplies
            ),
            key=lambda c: c.match_percentage,
            reverse=True,
        )

    # ---- Pick candidates for the prompt pass --------------------------------
    if strategy == "hybrid" and similarity_by_id:
        ranked = sorted(supplies, key=lambda s: similarity_by_id.get(str(s.id), 0.0), reverse=True)
        candidates = ranked[: settings.match_candidate_limit]
    else:
        candidates = list(supplies)[: settings.match_candidate_limit]

    candidate_texts = {str(s.id): _listing_to_text(s) for s in candidates}

    results: list[MatchCandidate] = []
    for supply in candidates:
        try:
            pct, reasoning = provider.score(
                demand_text=demand_text, supply_text=candidate_texts[str(supply.id)]
            )
        except Exception as exc:
            logger.warning("Prompt scoring failed for supply %s: %s", supply.id, exc)
            sim = similarity_by_id.get(str(supply.id))
            if sim is None:
                continue
            pct = _similarity_to_percentage(sim)
            reasoning = "Fallback to embedding similarity due to LLM error."
        results.append(
            MatchCandidate(
                supply_id=str(supply.id),
                match_percentage=pct,
                ai_reasoning=reasoning,
            )
        )

    results.sort(key=lambda c: c.match_percentage, reverse=True)
    return results
