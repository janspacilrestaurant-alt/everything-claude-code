#!/usr/bin/env python3
"""Apply real listing URLs from /tmp/deal_lookup_output.json to the dataset
and re-embed into machinery-deals-crm.html."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
JSON_FILE = ROOT / "30-dealu-eu-real.json"
HTML_FILE = ROOT / "machinery-deals-crm.html"
LOOKUP = pathlib.Path("/tmp/deal_lookup_output.json")


def main():
    lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
    data = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    deals = data["deals"]

    applied = 0
    for deal in deals:
        entry = lookup.get(deal["id"])
        if not entry:
            continue
        for side in ("demand", "offer"):
            new_url = (entry.get(side) or {}).get("url")
            if new_url and new_url != deal[side].get("link"):
                deal[side]["link"] = new_url
                applied += 1
        # Capture link kind for UI hint
        deal["linkKind"] = {
            "demand": entry["demand"]["kind"],
            "offer": entry["offer"]["kind"],
        }

    data["deals"] = deals
    JSON_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Re-embed in HTML
    html = HTML_FILE.read_text(encoding="utf-8")
    new_payload = json.dumps(deals, ensure_ascii=False)
    html2, n = re.subn(
        r"const PRELOADED_DEALS = \[.*?\];",
        f"const PRELOADED_DEALS = {new_payload};",
        html,
        count=1,
        flags=re.DOTALL,
    )
    if n != 1:
        raise RuntimeError("PRELOADED_DEALS not found")
    HTML_FILE.write_text(html2, encoding="utf-8")

    print(f"Applied {applied} URL updates across {len(deals)} deals.")


if __name__ == "__main__":
    main()
