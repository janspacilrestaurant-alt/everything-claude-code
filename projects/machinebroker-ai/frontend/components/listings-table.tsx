import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/lib/api";

export function ListingsTable({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return <p className="text-sm text-muted-foreground">No listings yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Year</th>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-3 py-2">
                <Badge variant={l.type === "supply" ? "secondary" : "outline"}>{l.type}</Badge>
              </td>
              <td className="px-3 py-2 font-medium">{l.title}</td>
              <td className="px-3 py-2">{l.brand ?? "—"}</td>
              <td className="px-3 py-2">{l.year ?? "—"}</td>
              <td className="px-3 py-2">
                {l.price ? `${l.price} ${l.currency}` : "—"}
              </td>
              <td className="px-3 py-2">{l.location ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{l.contact_email}</td>
              <td className="px-3 py-2">
                <Badge variant={l.status === "active" ? "success" : "outline"}>{l.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
