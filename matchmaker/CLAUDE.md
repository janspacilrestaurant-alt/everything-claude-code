# CLAUDE.md — Machinery Deals CRM
# Přečti tento soubor jako první. Obsahuje vše co potřebuješ vědět.

---

## KDO JSEM

Jan Spáčil, průmyslový strojní broker. Zprostředkovávám nákup/prodej použitých průmyslových strojů a materiálů napříč Evropou. Vydělávám provizi 5–15 % z každého uzavřeného obchodu.

Email: jan.spacil86@gmail.com

---

## CO JE TENTO PROJEKT

**Machinery Deals CRM** — standalone HTML aplikace (React + Babel z CDN) pro správu broker dealů.

Soubory v této složce:
```
matchmaker/
├── CLAUDE.md                    ← tento soubor, čti první
├── machinery-deals-crm.html     ← hlavní aplikace (PRODUKCE)
├── machineseeker-crm.jsx        ← zdrojový React kód
├── 30-dealu-eu-real.json        ← dataset 30 reálných EU dealů
├── template.html                ← HTML wrapper pro build
└── build.py                     ← buildovací skript
```

---

## TECHNICKÝ STACK

- **React 18** z CDN (unpkg.com)
- **Babel standalone** z CDN — kompiluje JSX v prohlížeči
- **Tabler Icons** z CDN (cdn.jsdelivr.net)
- **localStorage** klíč: `ms_deals_v16`
- **Supabase** REST API: `https://xqnwfokmdgtjqqpftchz.supabase.co`
- **Hosting**: Netlify — `unique-beignet-c2c9a1.netlify.app`

### Build pravidla (KRITICKÉ):
```
1. machineseeker-crm.jsx → machinery-deals-crm.html

2. Změny v JSX:
   - import { useState, useEffect, useCallback } from "react";
   + const { useState, useEffect, useCallback } = React;

   - export default function App
   + function App

   - (na konec přidat)
   + ReactDOM.render(<App />, document.getElementById("root"));

3. HTML wrapper:
   <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
   <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
   <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.3.0/tabler-icons.min.css">

4. Preload script (PŘED babel scriptem):
   <script>
   var PRELOADED_DEALS = [...];  // var, ne const!
   (function() {
     try { localStorage.setItem("ms_deals_v16", JSON.stringify(PRELOADED_DEALS)); }
     catch(e) {}
   })();
   </script>

5. CSS variables musí být v <style> v <head>
```

---

## DATOVÝ MODEL — JEDEN DEAL

```json
{
  "id": "eu6001",
  "status": "new",
  "segment": "machines",
  "matchCriteria": {
    "brand": true,
    "specs": true,
    "year": "ok",
    "budget": "ok",
    "extras": true
  },
  "weightTier": 2,
  "demand": {
    "title": "DMG MORI CTX Beta 800",
    "buyer": "Název firmy kupujícího",
    "buyerEmail": "email@firma.cz",
    "buyerPhone": "+420 xxx xxx xxx",
    "country": "CZ",
    "budget": "40-70 k€",
    "budgetMidK": 55,
    "link": "https://...",
    "postedDate": "2026-06-01",
    "details": "Popis co přesně hledají",
    "searchQuery": "DMG MORI CTX Beta 800 CNC lathe"
  },
  "offer": {
    "title": "DMG MORI CTX Beta 800 (2013)",
    "seller": "Název firmy prodávajícího",
    "sellerEmail": "email@firma.de",
    "sellerPhone": "+49 xxx xxx",
    "sellerCountry": "DE",
    "price": 48,
    "specs": "Popis stroje · specifikace",
    "link": "https://...",
    "postedDate": "2026-05-15",
    "searchQuery": "DMG MORI CTX Beta 800"
  },
  "profit": { "val": "3-5 k€", "base": "~48 k€" },
  "flags": ["DMG MORI ✓", "Siemens 840D ✓"],
  "warnings": ["35 000 provozních hodin"],
  "notes": "",
  "emails": { "buyer": null, "seller": null },
  "createdAt": "2026-06-08T10:00:00.000Z"
}
```

### 6 segmentů:
- `machines` — použité průmyslové stroje (CNC soustruhy, frézky, lisy)
- `CNC` — CNC zakázkové obrábění (subdodávky, kapacity)
- `tooling` — nástrojové vybavení, formy, přípravky
- `MRO` — náhradní díly (Fanuc, Siemens, Heidenhain, Rexroth...)
- `reverse` — reverse engineering, 3D skenování, odlitky
- `building` — stavební materiál (ocelové profily, plechy, výztuž)

### Krajiny:
CZ, SK, DE, AT, PL, HU, FR, IT, ES, UK, SE, NL, BE, RO

---

## ZDROJE POPTÁVEK (verified, fungují)

| Zdroj | URL | Segment |
|-------|-----|---------|
| Enterprise Europe Network | `https://een.ec.europa.eu/partnering-opportunities` | všechny |
| EU Tenders (TED) | `https://ted.europa.eu/en/search/result?q=KEYWORD` | veřejné zakázky |
| Europages | `https://www.europages.co.uk/companies/KEYWORD.html` | všechny |
| Practical Machinist | `https://www.practicalmachinist.com/forum/categories/machinery-for-sale-or-wanted.12/` | machines |

## ZDROJE NABÍDEK (verified, fungují)

| Zdroj | URL formát | Funguje |
|-------|-----------|---------|
| Machineseeker | `https://www.machineseeker.com/mss/KEYWORD` | ✅ |
| Surplex | `https://www.surplex.com/en/search/?q=KEYWORD` | ✅ |
| TradeMachines | `https://www.trademachines.com/search?q=KEYWORD` | ✅ |
| Exapro kategorie | `https://www.exapro.com/ps-used-KATEGORIE/` | ✅ |
| Exapro spec page | `https://www.exapro.com/sp/STROJ-ID/` | ✅ |
| Google site search | `https://www.google.com/search?q=site:exapro.com+KEYWORD` | ✅ vždy |

### POZOR — CO NEFUNGUJE:
- `exapro.com/search/?q=` → **404, nepoužívat!**
- `europages.co.uk/companies/KEYWORD.html` → **403 při automatickém přístupu**
- `machineseeker.com/mss/` s víceznačnými dotazy → **404**
- `een.ec.europa.eu/node/` → **403 při automatickém přístupu**
- Specifické listing URL na Exapro → **expirují po prodeji**

### SPOLEHLIVÉ ŘEŠENÍ pro všechny linky:
```
Použij Google site search — VŽDY funguje:
https://www.google.com/search?q=site:PLATFORMA+KEYWORD
```

---

## APLIKACE — KLÍČOVÉ FUNKCE

1. **Párování dealů** — weighted % score (brand 25%, specs 30%, rok 20%, budget 15%, extras 10%)
2. **Kalkulace logistiky** — Haversine vzdálenost → doprava + pojištění + clo + montáž
3. **Vícejazyčné emaily** — CZ/SK/DE/AT/PL/EN (nikdy neodhalí protistranu!)
4. **Čistý zisk** — cena × provize v reálném čase
5. **Supabase cloud sync** — REST API, tabulka `deals_eu`, upsert
6. **Export/Import JSON** — záloha dat
7. **Mobile responsive**

---

## SUPABASE

- **URL**: `https://xqnwfokmdgtjqqpftchz.supabase.co`
- **Tabulka**: `deals_eu`
- **RLS**: aktivní
- **Upsert pattern**: `POST` s `Prefer: resolution=merge-duplicates,return=minimal`
- **Anon key**: uložen v `localStorage("sb_key")`

---

## NETLIFY

- **URL**: `https://unique-beignet-c2c9a1.netlify.app`
- **Deploy**: přetáhnout `machinery-deals-crm.html` na `app.netlify.com/drop`
- **Nebo CLI**: `netlify deploy --prod --dir . --message "update"`

---

## PRAVIDLA PRO EMAILY (KRITICKÉ)

1. **Nikdy** nesmíš odhalit druhou stranu (protistranu)
2. Kupujícímu piš jen o dostupnosti stroje — ne od koho
3. Prodávajícímu piš jen o zájemci — ne kdo
4. Jazyk emailu = jazyk země protistrany
5. Provize se nezmiňuje v emailu

---

## COMMISE MODEL

| Segment | Marže |
|---------|-------|
| Stroje (>50k€) | 5–8% |
| Stroje (<50k€) | 8–12% |
| CNC zakázky | 5–10% |
| Tooling | 5–10% |
| MRO/ND | 10–15% |
| Reverse | 8–12% |
| Stavba | 3–5% |

---

## JAK BUILDOVAT HTML

```bash
python3 build.py
```

Vytvoří `machinery-deals-crm.html` z `template.html` + `machineseeker-crm.jsx` + `30-dealu-eu-real.json`.
