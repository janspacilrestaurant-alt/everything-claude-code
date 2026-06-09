#!/usr/bin/env python3
"""
Fix Machinery Deals CRM:
1. Rewrite broken listing links in 30-dealu-eu-real.json to Google site search
   (per CLAUDE.md: exapro/search, europages/companies, een/node, multi-word
   machineseeker/mss, practicalmachinist/categories all fail; site:google search
   always works).
2. Patch SOURCES array in HTML (fix Exapro endpoint).
3. Patch EmailModal so recipient address is editable inline (most deals have
   no buyerEmail/sellerEmail; user needs to paste one).
4. Re-embed corrected dataset into PRELOADED_DEALS in HTML.
"""
import json
import pathlib
import re
import sys
from urllib.parse import quote_plus

ROOT = pathlib.Path(__file__).parent
JSON_FILE = ROOT / "30-dealu-eu-real.json"
HTML_FILE = ROOT / "machinery-deals-crm.html"


def google_site(domain: str, query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(f'site:{domain} {query}')}"


def rewrite_link(link: str, search_query: str) -> str:
    """Return a working URL for the given listing link + search query."""
    if not link:
        return link
    q = search_query or ""

    # Hard-fail patterns per CLAUDE.md → always rewrite to Google site search
    if "exapro.com/search" in link:
        return google_site("exapro.com", q)
    if "europages.co.uk/companies" in link:
        return google_site("europages.co.uk", q)
    if re.search(r"een\.ec\.europa\.eu/node/\d+", link):
        return google_site("een.ec.europa.eu", q)
    if "practicalmachinist.com/forum/categories" in link:
        return google_site("practicalmachinist.com", q)

    # Machineseeker /mss/ works only with single-token query — multi-word breaks
    m = re.match(r"https?://(?:www\.)?machineseeker\.com/mss/(.+)$", link)
    if m and ("+" in m.group(1) or "%20" in m.group(1)):
        return google_site("machineseeker.com", q)

    # These patterns work — keep as-is:
    # - een.ec.europa.eu/partnering-opportunities/<slug>
    # - ted.europa.eu/en/search/...
    # - surplex.com/en/search/?q=...
    # - trademachines.com/search?q=...
    # - machineseeker.com/mss/<single-word>
    return link


def fix_deals(deals: list) -> tuple[list, int]:
    changed = 0
    for d in deals:
        for side in ("demand", "offer"):
            sect = d.get(side) or {}
            old = sect.get("link", "")
            new = rewrite_link(old, sect.get("searchQuery", ""))
            if new != old:
                sect["link"] = new
                changed += 1
    return deals, changed


SOURCES_OLD = (
    '  { id:"ex",  name:"Exapro",         url:"https://www.exapro.com/search/?q=",'
)
SOURCES_NEW = (
    '  { id:"ex",  name:"Exapro",         '
    'url:"https://www.google.com/search?q=site%3Aexapro.com+",'
)

EMAIL_RECIPIENT_OLD = (
    '  const recipient = type==="buyer" ? deal.demand.buyerEmail : deal.offer.sellerEmail;\n'
    '  const handleSend=()=>{setSent(true);setTimeout(()=>{onSent(type);onClose();},800);};\n'
    '  const handleOpenMail=()=>{ window.location.href = buildMailto(recipient, body); onSent(type); };'
)
EMAIL_RECIPIENT_NEW = (
    '  const defaultRecipient = type==="buyer" ? (deal.demand.buyerEmail||"") : (deal.offer.sellerEmail||"");\n'
    '  const [recipient,setRecipient]=useState(defaultRecipient);\n'
    '  const handleSend=()=>{setSent(true);setTimeout(()=>{onSent(type);onClose();},800);};\n'
    '  const handleOpenMail=()=>{ window.location.href = buildMailto(recipient, body); onSent(type); };'
)

# Replace the status badge line so user can edit recipient inline.
EMAIL_STATUS_OLD = (
    '          <span>{type==="buyer"?`${deal.demand.buyer} · ${deal.demand.country}`:`${deal.offer.seller} · ${deal.offer.sellerCountry||""}`}</span>\n'
    '          <span style={{color:recipient?"#639922":"#854F0B",whiteSpace:"nowrap"}}>{recipient?`✉ ${recipient}`:"⚠ chybí email"}</span>'
)
EMAIL_STATUS_NEW = (
    '          <span>{type==="buyer"?`${deal.demand.buyer} · ${deal.demand.country}`:`${deal.offer.seller} · ${deal.offer.sellerCountry||""}`}</span>\n'
    '          <input type="email" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="vlož e-mail příjemce" style={{flex:1,maxWidth:260,fontSize:11,padding:"3px 6px",border:`0.5px solid ${recipient?"#639922":"#FAC775"}`,borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/>'
)


def patch_html(html: str, deals: list) -> str:
    # 1) Replace PRELOADED_DEALS array (single line at top)
    new_payload = json.dumps(deals, ensure_ascii=False)
    html2, n = re.subn(
        r"const PRELOADED_DEALS = \[.*?\];",
        f"const PRELOADED_DEALS = {new_payload};",
        html,
        count=1,
        flags=re.DOTALL,
    )
    if n != 1:
        raise RuntimeError("Could not find PRELOADED_DEALS in HTML")

    # 2) Fix SOURCES Exapro entry
    if SOURCES_OLD not in html2:
        raise RuntimeError("Could not find Exapro SOURCES line")
    html2 = html2.replace(SOURCES_OLD, SOURCES_NEW)

    # 3) Patch EmailModal recipient handling
    if EMAIL_RECIPIENT_OLD not in html2:
        raise RuntimeError("Could not find recipient/handleSend/handleOpenMail block")
    html2 = html2.replace(EMAIL_RECIPIENT_OLD, EMAIL_RECIPIENT_NEW)

    if EMAIL_STATUS_OLD not in html2:
        raise RuntimeError("Could not find recipient status badge")
    html2 = html2.replace(EMAIL_STATUS_OLD, EMAIL_STATUS_NEW)

    return html2


def main():
    data = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    deals = data["deals"] if isinstance(data, dict) and "deals" in data else data
    deals, changed = fix_deals(deals)
    if isinstance(data, dict) and "deals" in data:
        data["deals"] = deals
        JSON_FILE.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    else:
        JSON_FILE.write_text(
            json.dumps(deals, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    html = HTML_FILE.read_text(encoding="utf-8")
    html = patch_html(html, deals)
    HTML_FILE.write_text(html, encoding="utf-8")

    print(f"Rewrote {changed} link(s) across {len(deals)} deals.")
    print(f"Patched SOURCES + EmailModal in {HTML_FILE.name}.")


if __name__ == "__main__":
    sys.exit(main())
