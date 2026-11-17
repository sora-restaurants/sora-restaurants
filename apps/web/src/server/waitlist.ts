import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./deps.ts";
import { fieldErrors, STATUSES, submissionSchema, type Status } from "../lib/waitlist-schema.ts";

export const MAX_WAITLIST_BODY_BYTES = 32 * 1024;
const MAX_PER_HOUR = 5;
const MIN_FILL_MS = 4000;

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
export async function submitApplication(input: unknown, db: Db, ip: string): Promise<WaitlistResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, httpStatus: 422, error: "Some answers need another look.", fields: fieldErrors(parsed.error) };
  const a = parsed.data;
  if (a.companyUrl !== "" || a.elapsedMs < MIN_FILL_MS) {
    return { ok: false, httpStatus: 400, error: "We could not submit the form. Reload the page and try again." };
  }

  const ipHash = hashIp(ip);
  const [{ n }] = await db.asService<{ n: number }>(
    "select count(*)::int as n from restaurant_waitlist_applications where ip_hash = $1 and created_at > now() - interval '1 hour'",
    [ipHash],
  );
  if (n >= MAX_PER_HOUR) return { ok: false, httpStatus: 429, error: "Too many applications from this connection. Try again in an hour." };

  // The database enforces one application per submission key and per email + restaurant, and answers a repeat with the first reference.
  // Sent as text and cast twice (::text::jsonb): postgres.js JSON-encodes a jsonb parameter itself, PGlite does not.
  const [saved] = await db.asService<{ reference: string; restaurant_name: string; replayed: boolean }>(
    "select * from submit_waitlist_application($1::text::jsonb)",
    [JSON.stringify({
      reference: newReference(), submission_key: a.submissionKey, restaurant_name: a.restaurantName, restaurant_type: a.restaurantType,
      city: a.city, locations: nullable(a.locations), tables_count: nullable(a.tablesCount), seating_capacity: nullable(a.seatingCapacity),
      website: nullable(a.website), social: nullable(a.social), contact_name: a.contactName, contact_position: a.contactPosition,
      email: a.email, phone: a.phone, preferred_contact: nullable(a.preferredContact), best_time: nullable(a.bestTime),
      pos_system: a.posSystem, pos_other: a.posSystem === "Other" ? a.posOther : null, ordering_method: nullable(a.orderingMethod),
      uses_qr: nullable(a.usesQr), kitchen_system: nullable(a.kitchenSystem), payment_handling: a.paymentHandling,
      daily_volume: nullable(a.dailyVolume), improvements: a.improvements, feature_interests: a.featureInterests,
      biggest_challenge: nullable(a.biggestChallenge), requests: nullable(a.requests), test_timeline: nullable(a.testTimeline),
      open_to_demo: nullable(a.openToDemo), pilot_interest: nullable(a.pilotInterest), comments: nullable(a.comments), ip_hash: ipHash,
    })],
  );
  return { ok: true, reference: saved.reference, restaurantName: saved.restaurant_name, replayed: saved.replayed };
}

export type Filters = { q?: string; status?: string; city?: string; pos?: string };

export function listApplications(db: Db, f: Filters = {}): Promise<Application[]> {
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

export async function getApplication(db: Db, id: string): Promise<Application | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await db.asService<Application>(`select ${COLUMNS} from restaurant_waitlist_applications where id = $1`, [id]))[0] ?? null;
}

export async function updateApplication(db: Db, id: string, status: string, notes: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(STATUSES as readonly string[]).includes(status)) return false;
  const rows = await db.asService<{ id: string }>(
    "update restaurant_waitlist_applications set status = $2, admin_notes = $3, updated_at = now() where id = $1 returning id",
    [id, status, notes.slice(0, 5000)],
  );
  return rows.length === 1;
}

export async function deleteApplication(db: Db, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  return (await db.asService<{ id: string }>("delete from restaurant_waitlist_applications where id = $1 returning id", [id])).length === 1;
}

export type Stats = {
  total: number; fresh: number; contacted: number; approved: number; pilotCandidates: number;
  pos: { label: string; n: number }[]; features: { label: string; n: number }[]; byDay: { day: string; n: number }[];
  cities: string[];
};

/** Every figure is counted from saved applications; an empty table gives zeros and empty lists. */
export async function waitlistStats(db: Db): Promise<Stats> {
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
