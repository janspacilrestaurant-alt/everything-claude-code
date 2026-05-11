"""Heuristic language detection for outbound emails.

Order of precedence:
1. Email address TLD (`...@vendor.de` -> de).
2. Country code or country name found in the listing `location` field.
3. Fallback to English.
"""

from __future__ import annotations

import re

# Map ISO country code -> BCP-47 language tag we draft in.
_COUNTRY_TO_LANG: dict[str, str] = {
    "DE": "de",
    "AT": "de",
    "CH": "de",
    "FR": "fr",
    "BE": "fr",
    "LU": "fr",
    "ES": "es",
    "MX": "es",
    "AR": "es",
    "IT": "it",
    "PT": "pt",
    "BR": "pt-BR",
    "NL": "nl",
    "PL": "pl",
    "TR": "tr",
    "RO": "ro",
    "CZ": "cs",
    "SK": "sk",
    "SE": "sv",
    "NO": "no",
    "DK": "da",
    "FI": "fi",
    "JP": "ja",
    "KR": "ko",
    "CN": "zh",
    "TW": "zh-TW",
    "RU": "ru",
    "UA": "uk",
    "US": "en",
    "GB": "en",
    "UK": "en",
    "IE": "en",
    "AU": "en",
    "CA": "en",
}

# Some longer-form country names that may show up in scraped location strings.
_COUNTRY_NAME_TO_LANG: dict[str, str] = {
    "germany": "de",
    "deutschland": "de",
    "austria": "de",
    "switzerland": "de",
    "france": "fr",
    "spain": "es",
    "mexico": "es",
    "italy": "it",
    "italia": "it",
    "portugal": "pt",
    "brazil": "pt-BR",
    "brasil": "pt-BR",
    "netherlands": "nl",
    "poland": "pl",
    "turkey": "tr",
    "china": "zh",
    "japan": "ja",
    "russia": "ru",
}

_TLD_TO_LANG: dict[str, str] = {
    "de": "de",
    "at": "de",
    "ch": "de",
    "fr": "fr",
    "es": "es",
    "it": "it",
    "pt": "pt",
    "br": "pt-BR",
    "nl": "nl",
    "pl": "pl",
    "tr": "tr",
    "se": "sv",
    "no": "no",
    "dk": "da",
    "fi": "fi",
    "jp": "ja",
    "kr": "ko",
    "cn": "zh",
    "ru": "ru",
    "ua": "uk",
}

_COUNTRY_CODE_RE = re.compile(r"\b([A-Z]{2})\b")


def detect_language(*, contact_email: str | None, location: str | None) -> str:
    """Return a BCP-47 language tag for the recipient."""

    if contact_email and "@" in contact_email:
        tld = contact_email.rsplit(".", 1)[-1].lower().strip()
        if tld in _TLD_TO_LANG:
            return _TLD_TO_LANG[tld]

    if location:
        loc_upper = location.upper()
        for match in _COUNTRY_CODE_RE.findall(loc_upper):
            if match in _COUNTRY_TO_LANG:
                return _COUNTRY_TO_LANG[match]
        loc_lower = location.lower()
        for name, lang in _COUNTRY_NAME_TO_LANG.items():
            if name in loc_lower:
                return lang

    return "en"
