import type { PGlite } from "@electric-sql/pglite";
import { asStaff } from "../../../../supabase/tests/db";
import { DEMO_USER, OTHER_USER, WAITER_USER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps";

const TOKENS: Record<string, string> = { "token-A": DEMO_USER, "token-B": OTHER_USER, "token-waiter": WAITER_USER };

export function testDeps(db: PGlite): Deps {
  return {
    db: {
      // The database owner stands in for Supabase's service_role, which also bypasses RLS.
      asService: async (sql, params = []) => (await db.query<never>(sql, params)).rows,
      asUser: (userId, sql, params = []) => asStaff(db, userId, sql, params),
    },
    verifyStaffToken: async (bearer) => TOKENS[bearer] ?? null,
    pollMs: 50,
  };
}
