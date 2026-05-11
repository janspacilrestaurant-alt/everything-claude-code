"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailReviewDialog } from "@/components/email-review-modal";
import type { Match } from "@/lib/api";

function percentageVariant(pct: number) {
  if (pct >= 80) return "success" as const;
  if (pct >= 60) return "warning" as const;
  return "secondary" as const;
}

export function MatchCard({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const pct = Number(match.match_percentage);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {match.demand.title}
                <span className="mx-2 text-muted-foreground">↔</span>
                {match.supply.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {match.supply.brand ?? "Unknown brand"} ·{" "}
                {match.supply.year ?? "—"} ·{" "}
                {match.supply.location ?? "—"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={percentageVariant(pct)} className="text-base">
                {pct.toFixed(0)}%
              </Badge>
              <Badge variant="outline">{match.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{match.ai_reasoning || "No reasoning provided."}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setOpen(true)}>Review &amp; send emails</Button>
          </div>
        </CardContent>
      </Card>
      <EmailReviewDialog matchId={match.id} open={open} onOpenChange={setOpen} match={match} />
    </>
  );
}
