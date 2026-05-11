const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ListingType = "supply" | "demand";
export type ListingStatus = "active" | "paused" | "closed";
export type MatchStatus = "pending" | "emailed" | "successful" | "rejected";
export type TargetParty = "buyer" | "seller";
export type SentStatus = "draft" | "queued" | "sent" | "failed";

export interface Listing {
  id: string;
  type: ListingType;
  title: string;
  description: string;
  brand: string | null;
  year: number | null;
  price: string | null;
  currency: string;
  location: string | null;
  contact_email: string;
  source_url: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  supply_id: string;
  demand_id: string;
  match_percentage: string;
  ai_reasoning: string;
  status: MatchStatus;
  created_at: string;
  supply: Listing;
  demand: Listing;
}

export interface Communication {
  id: string;
  match_id: string;
  target_party: TargetParty;
  subject: string;
  email_content: string;
  language: string;
  sent_status: SentStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  active_supplies: number;
  active_demands: number;
  total_matches: number;
  matches_emailed: number;
  matches_successful: number;
  success_rate: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  stats: () => request<Stats>("/stats"),
  listings: (params: { type?: ListingType; status?: ListingStatus } = {}) => {
    const q = new URLSearchParams();
    if (params.type) q.set("type", params.type);
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<Listing[]>(`/listings${qs ? `?${qs}` : ""}`);
  },
  matches: (params: { min_pct?: number; status?: MatchStatus } = {}) => {
    const q = new URLSearchParams();
    if (params.min_pct !== undefined) q.set("min_pct", String(params.min_pct));
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<Match[]>(`/matches${qs ? `?${qs}` : ""}`);
  },
  runMatching: (demandId: string) =>
    request<{ demand_id: string; matches_created: number; drafts_created: number; threshold: number }>(
      `/matches/run/${demandId}`,
      { method: "POST" },
    ),
  forceDraft: (matchId: string) =>
    request<Match>(`/matches/${matchId}/draft`, { method: "POST" }),
  communicationsForMatch: (matchId: string) =>
    request<Communication[]>(`/communications/by-match/${matchId}`),
  updateCommunication: (
    id: string,
    patch: { subject?: string; email_content?: string; language?: string },
  ) =>
    request<Communication>(`/communications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  sendCommunication: (id: string) =>
    request<{ id: string; sent_status: SentStatus; error_message: string | null }>(
      `/communications/${id}/send`,
      { method: "POST" },
    ),
};
