import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./deps.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiFindExisting, apiRecentCount, apiInsert, apiList, apiGet, apiUpdate, apiStats } from "./waitlist-api.ts";
export type WaitlistDb = Db | SupabaseClient;
import { fieldErrors, MIN_WAITLIST_FILL_MS, STATUSES, submissionSchema, type Status } from "../lib/waitlist-schema.ts";

export const MAX_WAITLIST_BODY_BYTES = 32 * 1024;
const MAX_PER_HOUR = 5;

export type WaitlistResult =
  | { ok: true; reference: string; restaurantName: string; replayed: boolean }
  | { ok: false; httpStatus: 400 | 413 | 422 | 429 | 500; error: string; fields?: Record<string, string> };

export type Application = {
  id: string; reference: string; status: Status;
  restaurant_name: string; restaurant_type: string; city: string;
  locations: number | null; tables_count: number | null; seating_capacity: number | null; website: string | null; social: string | null;
  contact_name: string; contact_position: string; email: string; phone: string; preferred_contact: string | null; best_time: string | null;
  pos_system: string; pos_other: string | null; ordering_method: string | null; uses_qr: string | null; kitchen_system: string | null;
  payment_handling: string[]; daily_volume: string | null;
  improvements: string[]; feature_interests: string[]; biggest_challenge: string | null; requests: string | null;
  test_timeline: string | null; open_to_demo: string | null; pilot_interest: string | null; comments: string | null;
  admin_notes: string; consent_at: string; created_at: string; updated_at: string;
};

const COLUMNS = `id, reference, status, restaurant_name, restaurant_type, city, locations, tables_count, seating_capacity, website, social,
  contact_name, contact_position, email, phone, preferred_contact, best_time, pos_system, pos_other, ordering_method, uses_qr,
  kitchen_system, payment_handling, daily_volume, improvements, feature_interests, biggest_challenge, requests, test_timeline,
  open_to_demo, pilot_interest, comments, admin_notes, consent_at, created_at, updated_at`;

const hashIp = (ip: string) => createHash("sha256").update(`${process.env.WAITLIST_IP_SALT ?? ""}:${ip}`).digest("hex");
// No 0, O, 1 or I: the reference is read out over the phone.
const newReference = () => `SORA-${Array.from(randomBytes(6), (b) => "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 32]).join("")}`;
const nullable = (v: string | number) => (v === "" ? null : v);

/** Validates and saves one application. Safe to retry: the same submission key, or the same restaurant and email, returns the first reference. */
export async function submitApplication(input: unknown, db: WaitlistDb, ip: string): Promise<WaitlistResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, httpStatus: 422, error: "Some answers need another look.", fields: fieldErrors(parsed.error) };
  const a = parsed.data;
  if (a.companyUrl !== "" || a.elapsedMs < MIN_WAITLIST_FILL_MS) {
    return { ok: false, httpStatus: 400, error: "We could not submit the form. Reload the page and try again." };
  }

  const existing = "asService" in db ? await db.asService<{ reference: string; restaurant_name: string }>(
    `select reference, restaurant_name from restaurant_waitlist_applications
     where submission_key = $1 or (lower(email) = $2 and $2 <> '' and lower(restaurant_name) = lower($3))
       or (phone = $4 and $4 <> '' and lower(restaurant_name) = lower($3)) order by created_at limit 1`,
    [a.submissionKey, a.email, a.restaurantName, a.phone],
  ) : await apiFindExisting(db, a);
  if (existing[0]) return { ok: true, reference: existing[0].reference, restaurantName: existing[0].restaurant_name, replayed: true };

  const ipHash = hashIp(ip);
  const [{ n }] = "asService" in db ? await db.asService<{ n: number }>(
    "select count(*)::int as n from restaurant_waitlist_applications where ip_hash = $1 and created_at > now() - interval '1 hour'",
    [ipHash],
  ) : [{ n: await apiRecentCount(db, ipHash) }];
  if (n >= MAX_PER_HOUR) return { ok: false, httpStatus: 429, error: "Too many applications from this connection. Try again in an hour." };

  // The lists go in as text and are cast twice (::text::jsonb): postgres.js JSON-encodes a jsonb parameter itself, PGlite does not.
  const reference = newReference();
  const saved = "asService" in db ? await db.asService<{ reference: string }>(
    `insert into restaurant_waitlist_applications (
       reference, submission_key, restaurant_name, restaurant_type, city, locations, tables_count, seating_capacity, website, social,
       contact_name, contact_position, email, phone, preferred_contact, best_time, pos_system, pos_other, ordering_method, uses_qr,
       kitchen_system, payment_handling, daily_volume, improvements, feature_interests, biggest_challenge, requests, test_timeline,
       open_to_demo, pilot_interest, comments, consent_at, ip_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::text::jsonb,$23,$24::text::jsonb,$25::text::jsonb,$26,$27,$28,$29,$30,$31, now(), $32)
     on conflict (submission_key) do nothing returning reference`,
    [
      reference, a.submissionKey, a.restaurantName, a.restaurantType, a.city, nullable(a.locations), nullable(a.tablesCount),
      nullable(a.seatingCapacity), nullable(a.website), nullable(a.social), a.contactName, a.contactPosition, a.email, a.phone,
      nullable(a.preferredContact), nullable(a.bestTime), a.posSystem, a.posSystem === "Other" ? a.posOther : null,
      nullable(a.orderingMethod), nullable(a.usesQr), nullable(a.kitchenSystem), JSON.stringify(a.paymentHandling),
      nullable(a.dailyVolume), JSON.stringify(a.improvements), JSON.stringify(a.featureInterests), nullable(a.biggestChallenge),
      nullable(a.requests), nullable(a.testTimeline), nullable(a.openToDemo), nullable(a.pilotInterest), nullable(a.comments), ipHash,
    ],
  ) : await apiInsert(db, a, reference, ipHash);
  // A second request with the same key that raced this one wins the insert; both answer with its reference.
  if (!saved[0]) {
    const [first] = "asService" in db
      ? await db.asService<{ reference: string }>("select reference from restaurant_waitlist_applications where submission_key = $1", [a.submissionKey])
      : await apiFindExisting(db, a);
    return { ok: true, reference: first.reference, restaurantName: a.restaurantName, replayed: true };
  }
  return { ok: true, reference: saved[0].reference, restaurantName: a.restaurantName, replayed: false };
}

export type Filters = { q?: string; status?: string; city?: string; pos?: string };

export function listApplications(db: WaitlistDb, f: Filters = {}): Promise<Application[]> {
  if (!("asService" in db)) return apiList(db, f);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  // Wildcards a searcher types are matched literally.
  if (f.q) add("(restaurant_name || ' ' || contact_name || ' ' || email || ' ' || reference || ' ' || city) ilike ?", `%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (f.status && (STATUSES as readonly string[]).includes(f.status)) add("status = ?", f.status);
  if (f.city) add("lower(city) = lower(?)", f.city);
  if (f.pos) add("pos_system = ?", f.pos);
  return db.asService<Application>(
    `select ${COLUMNS} from restaurant_waitlist_applications ${where.length ? `where ${where.join(" and ")}` : ""} order by created_at desc limit 1000`,
    params,
  );
}

export async function getApplication(db: WaitlistDb, id: string): Promise<Application | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!("asService" in db)) return apiGet(db, id);
  return (await db.asService<Application>(`select ${COLUMNS} from restaurant_waitlist_applications where id = $1`, [id]))[0] ?? null;
}

export async function updateApplication(db: WaitlistDb, id: string, status: string, notes: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(STATUSES as readonly string[]).includes(status)) return false;
  if (!("asService" in db)) return apiUpdate(db, id, status, notes);
  const rows = await db.asService<{ id: string }>(
    "update restaurant_waitlist_applications set status = $2, admin_notes = $3, updated_at = now() where id = $1 returning id",
    [id, status, notes.slice(0, 5000)],
  );
  return rows.length === 1;
}

export type Stats = {
  total: number; fresh: number; contacted: number; approved: number; pilotCandidates: number;
  pos: { label: string; n: number }[]; features: { label: string; n: number }[]; byDay: { day: string; n: number }[];
  cities: string[];
};

/** Every figure is counted from saved applications; an empty table gives zeros and empty lists. */
export async function waitlistStats(db: WaitlistDb): Promise<Stats> {
  if (!("asService" in db)) return apiStats(db);
  const t = "restaurant_waitlist_applications";
  const [[totals], pos, features, byDay, cities] = await Promise.all([
    db.asService<{ total: number; fresh: number; contacted: number; approved: number; pilot: number }>(
      `select count(*)::int as total, count(*) filter (where status = 'new')::int as fresh,
              count(*) filter (where status = 'contacted')::int as contacted, count(*) filter (where status = 'approved')::int as approved,
              count(*) filter (where pilot_interest = 'Yes')::int as pilot from ${t}`),
    db.asService<{ label: string; n: number }>(
      `select case when pos_system = 'Other' then coalesce(nullif(pos_other, ''), 'Other') else pos_system end as label, count(*)::int as n
       from ${t} group by 1 order by n desc, label limit 8`),
    db.asService<{ label: string; n: number }>(
      `select f as label, count(*)::int as n from ${t}, jsonb_array_elements_text(feature_interests) f group by f order by n desc, f`),
    db.asService<{ day: string; n: number }>(
      `select to_char(created_at at time zone 'Africa/Johannesburg', 'YYYY-MM-DD') as day, count(*)::int as n
       from ${t} where created_at > now() - interval '30 days' group by 1 order by 1`),
    db.asService<{ city: string }>(`select distinct initcap(lower(city)) as city from ${t} order by 1`),
  ]);
  return {
    total: totals.total, fresh: totals.fresh, contacted: totals.contacted, approved: totals.approved, pilotCandidates: totals.pilot,
    pos, features, byDay, cities: cities.map((c) => c.city),
  };
}

const CSV_FIELDS: (keyof Application)[] = [
  "reference", "status", "created_at", "restaurant_name", "restaurant_type", "city", "locations", "tables_count", "seating_capacity",
  "website", "social", "contact_name", "contact_position", "email", "phone", "preferred_contact", "best_time", "pos_system", "pos_other",
  "ordering_method", "uses_qr", "kitchen_system", "payment_handling", "daily_volume", "improvements", "feature_interests",
  "biggest_challenge", "requests", "test_timeline", "open_to_demo", "pilot_interest", "comments", "admin_notes", "consent_at", "updated_at",
];

export function toCsv(rows: Application[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? "" : Array.isArray(v) ? v.join("; ") : v instanceof Date ? v.toISOString() : String(v);
    // Applicants write these cells: a leading = + - @ would run as a formula when the file opens in a spreadsheet.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [CSV_FIELDS.join(","), ...rows.map((r) => CSV_FIELDS.map((f) => cell(r[f])).join(","))].join("\r\n");
}
