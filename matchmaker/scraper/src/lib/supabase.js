import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

// Upsert deals into deals_eu. The table's primary key is `id`, so re-runs
// merge on the deterministic IDs produced by the matcher.
export async function upsertDeals(deals) {
  if (deals.length === 0) return { inserted: 0, updated: 0 };
  const supabase = getClient();
  const { data, error, count } = await supabase
    .from("deals_eu")
    .upsert(deals, { onConflict: "id", count: "exact" })
    .select();
  if (error) throw error;
  return { upserted: data?.length ?? count ?? 0 };
}
