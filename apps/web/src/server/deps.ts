export interface Db {
  asService<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs as the signed-in staff user, so row-level security applies. */
  asUser<T>(userId: string, sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Deps {
  db: Db;
  verifyStaffToken(bearer: string): Promise<string | null>;
  pollMs: number;
}

export type SubmitResult =
  | { ok: true; statusToken: string; publicRef: string; replayed: boolean; payNow: boolean }
  | { ok: false; httpStatus: 400 | 404 | 409 | 413 | 422 | 500; error: string };

export type KitchenOrder = {
  id: string;
  publicRef: string;
  table: string;
  status: string;
  totalCents: number;
  createdAt: string;
  /** Paid in the app (pay now). */
  paid: boolean;
  /** Pay after dinner and not yet paid: staff collect at the table. */
  payAtTable: boolean;
  items: { name: string; quantity: number; notes: string }[];
};
