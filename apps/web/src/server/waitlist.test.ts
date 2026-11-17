import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { DEMO_USER } from "../../../../supabase/tests/fixtures";
import type { Db } from "./deps.ts";
import { adminConfigured, loginAllowed, newSession, passwordMatches, sessionValid } from "./admin-auth.ts";
import { testDeps } from "./test-deps";
import { getApplication, listApplications, submitApplication, toCsv, updateApplication, waitlistStats } from "./waitlist.ts";

let pg: PGlite;
let db: Db;
beforeEach(async () => {
  pg = await freshDb();
  db = testDeps(pg).db;
});

let n = 0;
const key = () => (++n).toString(16).padStart(32, "0");
const form = (over: Record<string, unknown> = {}) => ({
  restaurantName: "Die Blou Deur", restaurantType: "Casual dining", city: "Stellenbosch", locations: "1", tablesCount: "24", seatingCapacity: "",
  website: "", social: "", contactName: "Thandi Mokoena", contactPosition: "Owner", email: "Thandi@BlouDeur.example", phone: "082 123 4567",
  preferredContact: "WhatsApp", bestTime: "", posSystem: "Pilot POS", posOther: "", orderingMethod: "A mix of both", usesQr: "No", kitchenSystem: "Printed tickets",
  paymentHandling: ["Cash", "Pay at the till"], dailyVolume: "50 to 150", improvements: ["Reduce waiter workload"],
  featureInterests: ["QR table ordering", "Live kitchen dashboard"], biggestChallenge: "", requests: "", testTimeline: "As soon as possible", openToDemo: "Yes",
  pilotInterest: "Yes", comments: "", consent: true, submissionKey: key(), companyUrl: "", elapsedMs: 60_000, ...over,
});

describe("waitlist applications", () => {
  it("saves a valid application, normalises the phone and email, and gives a reference", async () => {
    const r = await submitApplication(form(), db, "1.1.1.1");
    if (!r.ok) throw new Error(r.error);
    expect(r.reference).toMatch(/^SORA-[2-9A-HJ-NP-Z]{6}$/);
    const [row] = await listApplications(db);
    expect(row).toMatchObject({ restaurant_name: "Die Blou Deur", email: "thandi@bloudeur.example", phone: "+27821234567", status: "new", tables_count: 24, seating_capacity: null });
    expect(row.feature_interests).toEqual(["QR table ordering", "Live kitchen dashboard"]);
    expect(row.consent_at).toBeTruthy();
  });

  it("rejects missing fields, bad values and missing consent with a message per field, and saves nothing", async () => {
    const r = await submitApplication(form({ restaurantName: " ", email: "nope", phone: "12", restaurantType: "Spaceship", consent: false, posSystem: "Other" }), db, "1.1.1.1");
    expect(r).toMatchObject({ ok: false, httpStatus: 422 });
    if (r.ok) return;
    expect(Object.keys(r.fields!).sort()).toEqual(["consent", "email", "phone", "posOther", "restaurantName", "restaurantType"]);
    expect(await listApplications(db)).toHaveLength(0);
  });

  it("stores one row for a retried submission and for the same restaurant applying twice", async () => {
    const first = form();
    const a = await submitApplication(first, db, "1.1.1.1");
    const retry = await submitApplication(first, db, "1.1.1.1");
    const again = await submitApplication(form({ restaurantName: "die blou deur", email: "THANDI@bloudeur.example" }), db, "2.2.2.2");
    expect(retry).toMatchObject({ ok: true, replayed: true, reference: a.ok && a.reference });
    expect(again).toMatchObject({ ok: true, replayed: true, reference: a.ok && a.reference });
    expect(await listApplications(db)).toHaveLength(1);
  });

  it("lets the database refuse a second row for the same email and restaurant, and keeps the function from staff", async () => {
    await submitApplication(form(), db, "1.1.1.1");
    await expect(pg.query("insert into restaurant_waitlist_applications (reference, submission_key, restaurant_name, restaurant_type, city, contact_name, contact_position, email, phone, pos_system, consent_at) values ('SORA-X', repeat('f', 32), 'DIE BLOU DEUR', 't', 'c', 'n', 'p', 'thandi@bloudeur.example', '1', 'p', now())")).rejects.toThrow(/unique/);
    await expect(db.asUser(DEMO_USER, "select * from submit_waitlist_application('{}')")).rejects.toThrow(/permission/);
  });

  it("refuses bots: a filled hidden field, or a form sent within seconds", async () => {
    expect(await submitApplication(form({ companyUrl: "http://spam.example" }), db, "1.1.1.1")).toMatchObject({ ok: false, httpStatus: 400 });
    expect(await submitApplication(form({ elapsedMs: 900 }), db, "1.1.1.1")).toMatchObject({ ok: false, httpStatus: 400 });
    expect(await listApplications(db)).toHaveLength(0);
  });

  it("allows five applications an hour from one connection, then answers 429", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await submitApplication(form({ restaurantName: `Place ${i}`, email: `a${i}@x.example` }), db, "9.9.9.9")).toMatchObject({ ok: true });
    }
    expect(await submitApplication(form({ restaurantName: "Place 6", email: "a6@x.example" }), db, "9.9.9.9")).toMatchObject({ ok: false, httpStatus: 429 });
    expect(await submitApplication(form({ restaurantName: "Elsewhere", email: "b@x.example" }), db, "8.8.8.8")).toMatchObject({ ok: true });
  });

  it("keeps applications away from signed-in restaurant staff", async () => {
    await submitApplication(form(), db, "1.1.1.1");
    await expect(db.asUser(DEMO_USER, "select * from restaurant_waitlist_applications")).rejects.toThrow();
  });
});

describe("admin review", () => {
  it("filters, updates status and notes, counts real rows, and exports CSV safely", async () => {
    await submitApplication(form(), db, "1.1.1.1");
    await submitApplication(form({ restaurantName: "=HYPERLINK(\"x\")", email: "b@x.example", contactName: "Sipho Dlamini", city: "Durban", posSystem: "Other", posOther: "TillPoint", pilotInterest: "No", featureInterests: ["QR table ordering"] }), db, "2.2.2.2");

    expect(await listApplications(db, { city: "durban" })).toHaveLength(1);
    expect(await listApplications(db, { pos: "Pilot POS" })).toHaveLength(1);
    expect(await listApplications(db, { q: "thandi" })).toHaveLength(1);
    expect(await listApplications(db, { q: "%" })).toHaveLength(0);

    const [durban] = await listApplications(db, { city: "Durban" });
    expect(await updateApplication(db, durban.id, "contacted", "Called on Monday")).toBe(true);
    expect(await updateApplication(db, durban.id, "made-up", "")).toBe(false);
    expect(await getApplication(db, durban.id)).toMatchObject({ status: "contacted", admin_notes: "Called on Monday" });
    expect(await listApplications(db, { status: "contacted" })).toHaveLength(1);

    const s = await waitlistStats(db);
    expect(s).toMatchObject({ total: 2, fresh: 1, contacted: 1, approved: 0, pilotCandidates: 1, cities: ["Durban", "Stellenbosch"] });
    expect(s.features[0]).toEqual({ label: "QR table ordering", n: 2 });
    expect(s.pos.map((p) => p.label).sort()).toEqual(["Pilot POS", "TillPoint"]);
    expect(s.byDay).toHaveLength(1);

    const csv = toCsv(await listApplications(db));
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("gives zeros and empty lists with no applications", async () => {
    expect(await waitlistStats(db)).toEqual({ total: 0, fresh: 0, contacted: 0, approved: 0, pilotCandidates: 0, pos: [], features: [], byDay: [], cities: [] });
  });
});

describe("admin sign-in", () => {
  const env = { ADMIN_PASSWORD: "correct horse battery", ADMIN_SESSION_SECRET: "s".repeat(32) } as unknown as NodeJS.ProcessEnv;
  const now = 1_800_000_000_000;

  it("is closed when not configured, or configured with a short password or secret", () => {
    expect(adminConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(adminConfigured({ ADMIN_PASSWORD: "short", ADMIN_SESSION_SECRET: "s".repeat(32) } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(passwordMatches("", {} as NodeJS.ProcessEnv)).toBe(false);
    expect(sessionValid(newSession(now, env), now, {} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("accepts only the right password and only an unexpired, untampered session", () => {
    expect(passwordMatches("correct horse battery", env)).toBe(true);
    expect(passwordMatches("correct horse batterx", env)).toBe(false);
    const session = newSession(now, env);
    expect(sessionValid(session, now + 1000, env)).toBe(true);
    expect(sessionValid(session, now + 13 * 3_600_000, env)).toBe(false);
    const [expires, mac] = session.split(".");
    expect(sessionValid(`${Number(expires) + 1}.${mac}`, now, env)).toBe(false);
    expect(sessionValid(`${expires}.${"0".repeat(64)}`, now, env)).toBe(false);
    expect(sessionValid(undefined, now, env)).toBe(false);
  });

  it("stops password guessing after 8 tries in 15 minutes", () => {
    const tries = Array.from({ length: 9 }, () => loginAllowed("7.7.7.7", now));
    expect(tries).toEqual([...Array(8).fill(true), false]);
    expect(loginAllowed("7.7.7.7", now + 16 * 60_000)).toBe(true);
  });
});
