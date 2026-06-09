import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ms_deals_v16";

const SEGMENTS = [
  { id: "machines",  label: "Stroje" },
  { id: "CNC",       label: "CNC zakázky" },
  { id: "tooling",   label: "Tooling" },
  { id: "MRO",       label: "MRO / ND" },
  { id: "reverse",   label: "Reverse" },
  { id: "building",  label: "Stavba" },
];

const SOURCES = [
  { id: "ex", name: "Exapro",        url: "https://www.google.com/search?q=site:exapro.com+" },
  { id: "ms", name: "Machineseeker", url: "https://www.machineseeker.com/mss/" },
  { id: "tm", name: "TradeMachines", url: "https://www.trademachines.com/search?q=" },
  { id: "sp", name: "Surplex",       url: "https://www.surplex.com/en/search/?q=" },
];

const STATUSES = ["new", "contacted", "negotiating", "closed", "lost"];

function loadDeals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveDeals(deals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  } catch (e) {}
}

function matchScore(deal) {
  const w = { brand: 0.25, specs: 0.30, year: 0.20, budget: 0.15, extras: 0.10 };
  const c = deal.matchCriteria || {};
  let score = 0;
  if (c.brand) score += w.brand;
  if (c.specs) score += w.specs;
  if (c.year === "ok") score += w.year;
  if (c.budget === "ok") score += w.budget;
  if (c.extras) score += w.extras;
  return Math.round(score * 100);
}

function commissionRate(segment, priceK) {
  if (segment === "machines")  return priceK > 50 ? 0.065 : 0.10;
  if (segment === "CNC")       return 0.075;
  if (segment === "tooling")   return 0.075;
  if (segment === "MRO")       return 0.125;
  if (segment === "reverse")   return 0.10;
  if (segment === "building")  return 0.04;
  return 0.08;
}

function DealRow({ deal, onStatus, onOpen }) {
  const score = matchScore(deal);
  const price = deal.offer?.price || 0;
  const rate = commissionRate(deal.segment, price);
  const profit = Math.round(price * rate * 10) / 10;
  return (
    <tr>
      <td>{deal.id}</td>
      <td>{deal.segment}</td>
      <td>{deal.demand?.title || "—"}</td>
      <td>{deal.demand?.country || "—"} → {deal.offer?.sellerCountry || "—"}</td>
      <td>{price ? `${price} k€` : "—"}</td>
      <td>{score} %</td>
      <td>~{profit} k€</td>
      <td>
        <select value={deal.status} onChange={(e) => onStatus(deal.id, e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td><button onClick={() => onOpen(deal.id)}>Detail</button></td>
    </tr>
  );
}

export default function App() {
  const [deals, setDeals] = useState([]);
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const initial = loadDeals();
    if (initial.length === 0 && typeof PRELOADED_DEALS !== "undefined") {
      setDeals(PRELOADED_DEALS);
      saveDeals(PRELOADED_DEALS);
    } else {
      setDeals(initial);
    }
  }, []);

  const updateStatus = useCallback((id, status) => {
    setDeals((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, status } : d));
      saveDeals(next);
      return next;
    });
  }, []);

  const filtered = deals.filter((d) => {
    if (segmentFilter !== "all" && d.segment !== segmentFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  const openDeal = deals.find((d) => d.id === openId);

  return (
    <div className="app">
      <header>
        <h1>Machinery Deals CRM</h1>
        <div className="filters">
          <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}>
            <option value="all">Všechny segmenty</option>
            {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Všechny stavy</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="count">{filtered.length} / {deals.length}</span>
        </div>
      </header>

      <table>
        <thead>
          <tr>
            <th>ID</th><th>Segment</th><th>Poptávka</th><th>Trasa</th>
            <th>Cena</th><th>Shoda</th><th>Zisk</th><th>Stav</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <DealRow key={d.id} deal={d} onStatus={updateStatus} onOpen={setOpenId} />
          ))}
        </tbody>
      </table>

      {openDeal && (
        <div className="modal" onClick={() => setOpenId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{openDeal.demand?.title}</h2>
            <p><b>Kupující:</b> {openDeal.demand?.buyer} ({openDeal.demand?.country})</p>
            <p><b>Email:</b> {openDeal.demand?.buyerEmail || "—"}</p>
            <p><b>Telefon:</b> {openDeal.demand?.buyerPhone || "—"}</p>
            <hr />
            <p><b>Prodávající:</b> {openDeal.offer?.seller} ({openDeal.offer?.sellerCountry})</p>
            <p><b>Email:</b> {openDeal.offer?.sellerEmail || "—"}</p>
            <p><b>Telefon:</b> {openDeal.offer?.sellerPhone || "—"}</p>
            <p><b>Cena:</b> {openDeal.offer?.price} k€</p>
            <hr />
            <p><b>Zdroje vyhledávání:</b></p>
            <ul>
              {SOURCES.map((s) => (
                <li key={s.id}>
                  <a href={s.url + encodeURIComponent(openDeal.offer?.searchQuery || "")} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <button onClick={() => setOpenId(null)}>Zavřít</button>
          </div>
        </div>
      )}
    </div>
  );
}
