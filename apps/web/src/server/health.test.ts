import { describe, expect, it } from "vitest";
import { freshDb } from "../../../../supabase/tests/db";
import type { Deps } from "./deps.ts";
import { health } from "./health.ts";
import { testDeps } from "./test-deps";

describe("health", () => {
  it("200 with ok and db when the database answers", async () => {
    const deps = testDeps(await freshDb());
    const res = await health(() => deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it("503 when the database is unreachable", async () => {
    const deps = testDeps(await freshDb());
    const down: Deps = { ...deps, db: { ...deps.db, asService: async () => { throw new Error("ECONNREFUSED"); } } };
    const res = await health(() => down);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });

  it("503 when deps cannot be built (e.g. DATABASE_URL missing)", async () => {
    const res = await health(() => { throw new Error("DATABASE_URL is not set"); });
    expect(res.status).toBe(503);
  });
});
