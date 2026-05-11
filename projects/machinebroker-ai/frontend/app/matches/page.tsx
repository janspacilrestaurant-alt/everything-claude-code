"use client";

import { useEffect, useState } from "react";
import { MatchCard } from "@/components/match-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Listing, type Match } from "@/lib/api";

export default function MatchCenterPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [demands, setDemands] = useState<Listing[]>([]);
  const [minPct, setMinPct] = useState(60);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [m, d] = await Promise.all([
        api.matches({ min_pct: minPct }),
        api.listings({ type: "demand", status: "active" }),
      ]);
      setMatches(m);
      setDemands(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPct]);

  async function runFor(demandId: string) {
    setRunning(demandId);
    setError(null);
    try {
      await api.runMatching(demandId);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Match Center</h1>
          <p className="text-muted-foreground">
            AI-scored supply ↔ demand pairs. Open one to review and send buyer + seller emails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Min %</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minPct}
            onChange={(e) => setMinPct(Number(e.target.value))}
            className="w-20"
          />
          <Button variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Run matching</CardTitle>
          <CardDescription>
            Trigger the AI matcher for an active demand. Auto-drafts emails for any match ≥ 80%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active demands yet.</p>
          ) : (
            <ul className="space-y-2">
              {demands.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded border p-3">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.location ?? "—"} · {d.contact_email}</p>
                  </div>
                  <Button onClick={() => runFor(d.id)} disabled={running === d.id} size="sm">
                    {running === d.id ? "Matching…" : "Run match"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Matches</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No matches above {minPct}%.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
