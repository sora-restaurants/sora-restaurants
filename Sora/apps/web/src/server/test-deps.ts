import type { PGlite } from "@electric-sql/pglite";
import { asStaff } from "../../../../supabase/tests/db";
import { DEMO_USER, OTHER_USER, WAITER_USER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps";

const TOKENS: Record<string, string> = { "token-A": DEMO_USER, "token-B": OTHER_USER, "token-waiter": WAITER_USER };

export function testDeps(db: PGlite): Deps {
  return {
    db: {
      // Same as prodDeps: switch to service_role, so missing grants show up in tests, not in the demo.
      asService: (sql, params = []) =>
        db.transaction(async (tx) => {
          await tx.exec("set local role service_role");
          return (await tx.query<never>(sql, params)).rows;
        }),
      asUser: (userId, sql, params = []) => asStaff(db, userId, sql, params),
    },
    verifyStaffToken: async (bearer) => TOKENS[bearer] ?? null,
    pollMs: 50,
  };
}
