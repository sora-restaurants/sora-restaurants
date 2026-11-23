import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { submissionSchema } from "../lib/waitlist-schema.ts";
import type { Application, Filters, Stats } from "./waitlist.ts";

const TABLE = "restaurant_waitlist_applications";
type Submission = z.infer<typeof submissionSchema>;
type Reference = { reference: string; restaurant_name: string };

async function result<T>(query: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`Waitlist API error ${error.code ?? "unknown"}: ${error.message}`);
  return data as T;
}

const literalPattern = (text: string) => text.replace(/[\\%_]/g, "\\$&");

export async function apiFindExisting(db: SupabaseClient, a: Submission): Promise<Reference[]> {
  const byKey = await result<Reference[]>(db.from(TABLE).select("reference,restaurant_name").eq("submission_key", a.submissionKey).limit(1));
  if (byKey.length) return byKey;
  if (a.email) {
    const byEmail = await result<Reference[]>(db.from(TABLE).select("reference,restaurant_name")
      .ilike("restaurant_name", literalPattern(a.restaurantName)).ilike("email", literalPattern(a.email)).order("created_at").limit(1));
    if (byEmail.length) return byEmail;
  }
  if (!a.phone) return [];
  return result<Reference[]>(db.from(TABLE).select("reference,restaurant_name")
    .ilike("restaurant_name", literalPattern(a.restaurantName)).eq("phone", a.phone).order("created_at").limit(1));
}

export async function apiRecentCount(db: SupabaseClient, ipHash: string): Promise<number> {
  const { count, error } = await db.from(TABLE).select("id", { head: true, count: "exact" })
    .eq("ip_hash", ipHash).gt("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if (error) throw new Error(`Waitlist count error ${error.code}`);
  return count ?? 0;
}

export function apiInsert(db: SupabaseClient, a: Submission, reference: string, ipHash: string) {
  const { submissionKey, consent, companyUrl, elapsedMs, ...answers } = a;
  const row = Object.fromEntries(Object.entries(answers).map(([name, value]) => [
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    value === "" && name !== "email" && name !== "phone" ? null : value,
  ]));
  return result<{ reference: string }[]>(db.from(TABLE).upsert({
    ...row, pos_other: a.posSystem === "Other" ? a.posOther : null,
    reference, submission_key: submissionKey, consent_at: new Date().toISOString(), ip_hash: ipHash,
  }, { onConflict: "submission_key", ignoreDuplicates: true }).select("reference"));
}

export function apiList(db: SupabaseClient, f: Filters): Promise<Application[]> {
  let query = db.from(TABLE).select("*").order("created_at", { ascending: false }).limit(1000);
  if (f.status) query = query.eq("status", f.status);
  if (f.city) query = query.ilike("city", literalPattern(f.city));
  if (f.pos) query = query.eq("pos_system", f.pos);
  if (f.q) {
    const pattern = `"%${literalPattern(f.q).replace(/"/g, '\\"')}%"`;
    query = query.or(["restaurant_name", "contact_name", "email", "reference", "city"].map((name) => `${name}.ilike.${pattern}`).join(","));
  }
  return result<Application[]>(query);
}

export function apiGet(db: SupabaseClient, id: string): Promise<Application | null> {
  return result<Application | null>(db.from(TABLE).select("*").eq("id", id).maybeSingle());
}

export async function apiUpdate(db: SupabaseClient, id: string, status: string, notes: string): Promise<boolean> {
  const rows = await result<{ id: string }[]>(db.from(TABLE)
    .update({ status, admin_notes: notes.slice(0, 5000), updated_at: new Date().toISOString() }).eq("id", id).select("id"));
  return rows.length === 1;
}

export async function apiDelete(db: SupabaseClient, id: string): Promise<boolean> {
  return (await result<{ id: string }[]>(db.from(TABLE).delete().eq("id", id).select("id"))).length === 1;
}

type StatsRow = Pick<Application, "status" | "pilot_interest" | "pos_system" | "pos_other" | "feature_interests" | "created_at" | "city">;

export async function apiStats(db: SupabaseClient): Promise<Stats> {
  const rows: StatsRow[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const page = await result<StatsRow[]>(db.from(TABLE)
      .select("status,pilot_interest,pos_system,pos_other,feature_interests,created_at,city")
      .order("created_at").order("id").range(offset, offset + size - 1));
    rows.push(...page);
    if (page.length < size) break;
  }
  const pos = new Map<string, number>();
  const features = new Map<string, number>();
  const days = new Map<string, number>();
  const cities = new Set<string>();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const row of rows) {
    const system = row.pos_system === "Other" ? row.pos_other || "Other" : row.pos_system;
    pos.set(system, (pos.get(system) ?? 0) + 1);
    for (const feature of row.feature_interests) features.set(feature, (features.get(feature) ?? 0) + 1);
    if (Date.parse(row.created_at) > Date.now() - 30 * 86_400_000) {
      const label = day.format(new Date(row.created_at));
      days.set(label, (days.get(label) ?? 0) + 1);
    }
    cities.add(row.city.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
  }
  const ranked = (map: Map<string, number>) => Array.from(map, ([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  return {
    total: rows.length, fresh: rows.filter((row) => row.status === "new").length,
    contacted: rows.filter((row) => row.status === "contacted").length,
    approved: rows.filter((row) => row.status === "approved").length,
    pilotCandidates: rows.filter((row) => row.pilot_interest === "Yes").length,
    pos: ranked(pos).slice(0, 8), features: ranked(features),
    byDay: Array.from(days, ([day, n]) => ({ day, n })).sort((a, b) => a.day.localeCompare(b.day)),
    cities: Array.from(cities).sort(),
  };
}
