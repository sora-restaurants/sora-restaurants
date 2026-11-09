import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { DEMO, OTHER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { devStaffLogin, devStaffLoginEnabled, signDevToken, verifyDevToken } from "./dev-staff-login.ts";
import { kitchenMe } from "./kitchen-me.ts";
import { kitchenStream } from "./kitchen-stream.ts";
import { testDeps } from "./test-deps";

const SECRET = "x".repeat(40);
const DEV_ENV = { NODE_ENV: "development", DEV_STAFF_LOGIN: "1", DEV_STAFF_LOGIN_SECRET: SECRET };

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  // Same deps as the app would get in dev mode: staff tokens are dev tokens.
  deps = { ...testDeps(db), verifyStaffToken: async (t) => verifyDevToken(t, SECRET) };
});

const login = (body: unknown, env: Record<string, string | undefined> = DEV_ENV) =>
  devStaffLogin(new Request("http://x/api/dev/staff-login", { method: "POST", body: JSON.stringify(body) }), deps, env);

describe("devStaffLoginEnabled", () => {
  it("is off unless explicitly switched on with a long secret", () => {
    expect(devStaffLoginEnabled(DEV_ENV)).toBe(true);
    expect(devStaffLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(devStaffLoginEnabled({ ...DEV_ENV, DEV_STAFF_LOGIN: "true" })).toBe(false);
    expect(devStaffLoginEnabled({ ...DEV_ENV, DEV_STAFF_LOGIN_SECRET: "short" })).toBe(false);
  });

  it("is always off in production, even when switched on", () => {
    expect(devStaffLoginEnabled({ ...DEV_ENV, NODE_ENV: "production" })).toBe(false);
  });
});

describe("dev tokens", () => {
  it("round-trip, and any tampering is rejected", () => {
    const token = signDevToken("c0000000-0000-0000-0000-000000000001", SECRET);
    expect(verifyDevToken(token, SECRET)).toBe("c0000000-0000-0000-0000-000000000001");
    expect(verifyDevToken(token.replace("0001.", "0002."), SECRET)).toBeNull();
    expect(verifyDevToken(token, "y".repeat(40))).toBeNull();
    expect(verifyDevToken("nope", SECRET)).toBeNull();
  });
});

describe("POST /api/dev/staff-login", () => {
  it("signs in a seeded staff account with its real password", async () => {
    const res = await login({ email: "kitchen@demo.test", password: "demo-kitchen-pass" });
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(verifyDevToken(token, SECRET)).toBe("c0000000-0000-0000-0000-000000000001");
  });

  it("refuses a wrong password or unknown email with the same 401", async () => {
    expect((await login({ email: "kitchen@demo.test", password: "wrong" })).status).toBe(401);
    expect((await login({ email: "nobody@demo.test", password: "demo-kitchen-pass" })).status).toBe(401);
  });

  it("does not exist when disabled or in production", async () => {
    const body = { email: "kitchen@demo.test", password: "demo-kitchen-pass" };
    expect((await login(body, { NODE_ENV: "development" })).status).toBe(404);
    expect((await login(body, { ...DEV_ENV, NODE_ENV: "production" })).status).toBe(404);
  });
});

describe("dev login keeps every real check", () => {
  const tokenFor = async (email: string, password: string) =>
    (await (await login({ email, password })).json()).token as string;
  const me = async (token: string) =>
    (await kitchenMe(new Request("http://x/api/kitchen/me", { headers: { authorization: `Bearer ${token}` } }), deps)).json();
  const board = (restaurantId: string, token: string) =>
    kitchenStream(new Request("http://x", { headers: { authorization: `Bearer ${token}` } }), restaurantId, deps);

  it("each kitchen user only finds their own restaurant", async () => {
    expect(await me(await tokenFor("kitchen@demo.test", "demo-kitchen-pass"))).toEqual({
      restaurants: [{ id: DEMO, name: "Demo Bistro" }],
    });
    expect(await me(await tokenFor("kitchen@other.test", "other-kitchen-pass"))).toEqual({
      restaurants: [{ id: OTHER, name: "Other Grill" }],
    });
  });

  it("someone who runs two kitchens gets both restaurants to choose from", async () => {
    await db.query("insert into staff_memberships (restaurant_id, user_id, role) values ($1, 'c0000000-0000-0000-0000-000000000001', 'kitchen')", [OTHER]);
    expect(await me(await tokenFor("kitchen@demo.test", "demo-kitchen-pass"))).toEqual({
      restaurants: [
        { id: DEMO, name: "Demo Bistro" },
        { id: OTHER, name: "Other Grill" },
      ],
    });
  });

  it("a waiter finds no kitchen and is refused the board", async () => {
    const waiter = await tokenFor("waiter@demo.test", "demo-waiter-pass");
    expect(await me(waiter)).toEqual({ restaurants: [] });
    expect((await board(DEMO, waiter)).status).toBe(403);
  });

  it("Other Grill's kitchen is refused Demo Bistro's board", async () => {
    expect((await board(DEMO, await tokenFor("kitchen@other.test", "other-kitchen-pass"))).status).toBe(403);
  });

  it("kitchen/me without a token is 401", async () => {
    expect((await kitchenMe(new Request("http://x/api/kitchen/me"), deps)).status).toBe(401);
  });
});
