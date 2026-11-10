import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asStaff, freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO, OTHER, OTHER_USER, OWNER_USER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { saveMenuItem, setItemAvailable } from "./menu-admin.ts";
import { getStaff, inviteStaff, removeStaff, setStaffRole } from "./staff-admin.ts";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const req = (token: string, body?: unknown) =>
  new Request("http://x", { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
type Staff = { id: string; email: string; role: string; status: string };
const staff = async (token = "token-owner") => (await (await getStaff(req(token), deps)).json()) as { staff: Staff[]; events: { action: string }[] };
const member = async (email: string) => (await staff()).staff.find((s) => s.email === email)!;
const makeManager = () => db.query("update staff_memberships set role = 'manager' where user_id = 'c0000000-0000-0000-0000-000000000001'");

describe("staff management", () => {
  it("an owner lists staff, invites by email, changes a role and removes someone", async () => {
    expect((await staff()).staff.map((s) => s.email).sort()).toEqual(["kitchen@demo.test", "owner@demo.test", "waiter@demo.test"]);
    expect((await inviteStaff(req("token-owner", { email: " New@Demo.test ", role: "waiter" }), deps)).status).toBe(200);
    expect(await member("new@demo.test")).toMatchObject({ role: "waiter", status: "invited" });
    expect((await inviteStaff(req("token-owner", { email: "new@demo.test", role: "kitchen" }), deps)).status).toBe(409);

    const waiter = await member("waiter@demo.test");
    expect((await setStaffRole(req("token-owner", { role: "kitchen" }), waiter.id, deps)).status).toBe(204);
    expect((await member("waiter@demo.test")).role).toBe("kitchen");
    expect((await removeStaff(req("token-owner", {}), waiter.id, deps)).status).toBe(204);
    expect((await member("waiter@demo.test")).status).toBe("inactive");
    // A deactivated waiter loses access straight away.
    expect((await staff("token-waiter")).staff).toBeUndefined();
  });

  it("kitchen and waiter staff cannot see or change staff", async () => {
    const owner = await member("owner@demo.test");
    expect((await getStaff(req("token-A"), deps)).status).toBe(403);
    expect((await inviteStaff(req("token-waiter", { email: "x@y.co", role: "waiter" }), deps)).status).toBe(404);
    expect((await setStaffRole(req("token-A", { role: "kitchen" }), owner.id, deps)).status).toBe(404);
    expect((await removeStaff(req("token-waiter", {}), owner.id, deps)).status).toBe(404);
  });

  it("a manager runs the team but cannot create, demote or remove owners", async () => {
    await makeManager();
    const owner = await member("owner@demo.test");
    const waiter = await member("waiter@demo.test");
    expect((await inviteStaff(req("token-A", { email: "boss@demo.test", role: "owner" }), deps)).status).toBe(403);
    expect((await setStaffRole(req("token-A", { role: "owner" }), waiter.id, deps)).status).toBe(403);
    expect((await setStaffRole(req("token-A", { role: "waiter" }), owner.id, deps)).status).toBe(403);
    expect((await removeStaff(req("token-A", {}), owner.id, deps)).status).toBe(403);
    expect((await setStaffRole(req("token-A", { role: "kitchen" }), waiter.id, deps)).status).toBe(204);
    expect((await inviteStaff(req("token-A", { email: "cook@demo.test", role: "kitchen" }), deps)).status).toBe(200);
  });

  it("the last active owner cannot be demoted or removed; with a second owner they can", async () => {
    const owner = await member("owner@demo.test");
    expect((await setStaffRole(req("token-owner", { role: "manager" }), owner.id, deps)).status).toBe(409);
    expect((await removeStaff(req("token-owner", {}), owner.id, deps)).status).toBe(409);
    const kitchen = await member("kitchen@demo.test");
    expect((await setStaffRole(req("token-owner", { role: "owner" }), kitchen.id, deps)).status).toBe(204);
    expect((await setStaffRole(req("token-owner", { role: "manager" }), owner.id, deps)).status).toBe(204);
  });

  it("another restaurant's owner gets 404 for this restaurant's staff", async () => {
    await db.query("update staff_memberships set role = 'owner' where restaurant_id = $1 and user_id = $2", [OTHER, OTHER_USER]);
    const waiter = await member("waiter@demo.test");
    expect((await staff("token-B")).staff.map((s) => s.email)).toEqual(["kitchen@other.test"]);
    expect((await setStaffRole(req("token-B", { role: "owner" }), waiter.id, deps)).status).toBe(404);
    expect((await removeStaff(req("token-B", {}), waiter.id, deps)).status).toBe(404);
    expect((await setStaffRole(req("token-B", { role: "owner" }), "not-a-uuid", deps)).status).toBe(404);
  });

  it("refuses bad emails, roles and smuggled restaurant ids", async () => {
    for (const body of [{ email: "nope", role: "waiter" }, { email: "a@b.co", role: "admin" }, { email: "a@b.co", role: "waiter", restaurantId: OTHER }]) {
      expect((await inviteStaff(req("token-owner", body), deps)).status).toBe(400);
    }
  });
});

describe("audit log", () => {
  it("records staff, menu, payment and policy changes; owners and managers read it, nobody writes it", async () => {
    await inviteStaff(req("token-owner", { email: "new@demo.test", role: "waiter" }), deps);
    await setStaffRole(req("token-owner", { role: "kitchen" }), (await member("waiter@demo.test")).id, deps);
    await removeStaff(req("token-owner", {}), (await member("new@demo.test")).id, deps);
    await saveMenuItem(req("token-owner", { id: BUNNY_CHOW, name: "Bunny chow", description: "", priceCents: 13000 }), deps);
    await setItemAvailable(req("token-A", { available: false }), BUNNY_CHOW, deps);
    await asStaff(db, OWNER_USER, "select set_payment_policy('pay_now_only')");

    const { events } = await staff();
    expect(events.map((e) => e.action)).toEqual(["payment_policy", "menu.availability", "menu.edit", "staff.remove", "staff.role", "staff.invite"]);
    expect(events[2]).toMatchObject({ actor: "owner@demo.test", before: { priceCents: 12500 }, after: { priceCents: 13000 } });

    expect(await asStaff(db, "c0000000-0000-0000-0000-000000000001", "select * from admin_events")).toEqual([]);
    await expect(asStaff(db, OWNER_USER, "insert into admin_events (restaurant_id, action) values ($1, 'fake')", [DEMO])).rejects.toThrow();
    await expect(asStaff(db, OWNER_USER, "delete from admin_events")).rejects.toThrow();
    await expect(asStaff(db, OWNER_USER, "select log_admin_event($1, 'fake', null, null, null)", [DEMO])).rejects.toThrow();
  });
});
