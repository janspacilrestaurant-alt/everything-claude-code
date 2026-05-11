import { ListingsTable } from "@/components/listings-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function ListingsPage() {
  const [supplies, demands] = await Promise.all([
    api.listings({ type: "supply" }).catch(() => []),
    api.listings({ type: "demand" }).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Listings</h1>
        <p className="text-muted-foreground">
          Everything ingested from the scrapers. Supplies are seller-side, demands are buyer-side.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplies ({supplies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingsTable listings={supplies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demands ({demands.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingsTable listings={demands} />
        </CardContent>
      </Card>
    </div>
  );
}
