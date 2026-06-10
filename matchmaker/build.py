#!/usr/bin/env python3
"""Build machinery-deals-crm.html from JSX + JSON + template."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
JSX_FILE = ROOT / "machineseeker-crm.jsx"
JSON_FILE = ROOT / "30-dealu-eu-real.json"
TEMPLATE = ROOT / "template.html"
OUTPUT = ROOT / "machinery-deals-crm.html"


def main():
    jsx = JSX_FILE.read_text(encoding="utf-8")
    data = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    deals = data["deals"] if isinstance(data, dict) and "deals" in data else data

    jsx = jsx.replace(
        'import { useState, useEffect, useCallback } from "react";',
        'const { useState, useEffect, useCallback } = React;',
    )
    jsx = jsx.replace("export default function App", "function App")
    if "ReactDOM.render(<App" not in jsx:
        jsx += "\n\nReactDOM.render(<App />, document.getElementById(\"root\"));\n"

    preload = (
        "  <script>\n"
        f"    var PRELOADED_DEALS = {json.dumps(deals, ensure_ascii=False)};\n"
        "    (function(){try{localStorage.setItem(\"ms_deals_v16\",JSON.stringify(PRELOADED_DEALS));}catch(e){}})();\n"
        "  </script>"
    )

    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("{{PRELOAD}}", preload)
    html = html.replace("{{JSX}}", jsx)

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Build OK → {OUTPUT.name} ({len(deals)} dealů, {OUTPUT.stat().st_size} B)")


if __name__ == "__main__":
    sys.exit(main())
