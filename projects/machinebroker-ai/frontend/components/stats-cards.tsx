import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stats } from "@/lib/api";

const items: { label: string; description: string; pick: (s: Stats) => string }[] = [
  { label: "Active supplies", description: "Sellers ready to match", pick: (s) => String(s.active_supplies) },
  { label: "Active demands", description: "Open buyer requests", pick: (s) => String(s.active_demands) },
  { label: "Total matches", description: "AI-scored pairs", pick: (s) => String(s.total_matches) },
  { label: "Emails sent", description: "Outreach in flight", pick: (s) => String(s.matches_emailed) },
  {
    label: "Success rate",
    description: "Closed / emailed",
    pick: (s) => `${(s.success_rate * 100).toFixed(1)}%`,
  },
];

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {items.map((i) => (
        <Card key={i.label}>
          <CardHeader className="pb-2">
            <CardDescription>{i.description}</CardDescription>
            <CardTitle className="text-3xl">{i.pick(stats)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{i.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
