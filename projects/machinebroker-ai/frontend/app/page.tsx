import { StatsCards } from "@/components/stats-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { MatchCard } from "@/components/match-card";

export default async function OverviewPage() {
  const [stats, matches] = await Promise.all([
    api.stats().catch(() => null),
    api.matches({ min_pct: 60 }).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Pipeline health for MachineBroker AI.</p>
      </div>

      {stats ? (
        <StatsCards stats={stats} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Backend unreachable</CardTitle>
            <CardDescription>
              Could not reach the FastAPI service at <code>NEXT_PUBLIC_API_URL</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Top recent matches (≥ 60%)</h2>
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No matches yet — ingest listings and trigger matching from the Match Center.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches.slice(0, 5).map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
