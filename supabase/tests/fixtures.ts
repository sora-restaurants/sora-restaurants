import type { PGlite } from "@electric-sql/pglite";

export const DEMO = "a0000000-0000-0000-0000-000000000001";
export const OTHER = "b0000000-0000-0000-0000-000000000001";
export const DEMO_USER = "c0000000-0000-0000-0000-000000000001";
export const OTHER_USER = "c0000000-0000-0000-0000-000000000002";
export const OWNER_USER = "c0000000-0000-0000-0000-000000000004";
export const PRIMAVERA = "a2000000-0000-0000-0000-000000000001";
export const RUMP = "b2000000-0000-0000-0000-000000000001";

type Line = { menuItemId: string; quantity: number; notes?: string };

// Runs as the database owner, standing in for the server's service-role call.
export async function submitOrder(db: PGlite, tableToken: string, key: string, items: Line[]) {
  const { rows } = await db.query<{ r: { statusToken: string; publicRef: string; replayed: boolean } }>(
    "select submit_order($1, $2, $3::jsonb) r",
    [tableToken, key, JSON.stringify(items)],
  );
  return rows[0].r;
}

export const COKE = "a2000000-0000-0000-0000-000000000003";
export const WAITER_USER = "c0000000-0000-0000-0000-000000000003";
