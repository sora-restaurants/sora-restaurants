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
  | { ok: true; statusToken: string; publicRef: string; replayed: boolean }
  | { ok: false; httpStatus: 400 | 404 | 409 | 413 | 422 | 429 | 500; error: string };

export type KitchenOrder = {
  id: string;
  publicRef: string;
  table: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: { name: string; quantity: number; notes: string }[];
};
