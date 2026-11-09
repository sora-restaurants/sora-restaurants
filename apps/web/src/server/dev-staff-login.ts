import { createHmac, timingSafeEqual } from "node:crypto";
import type { Deps } from "./deps.ts";

/**
 * Local-demo staff login, for machines without Supabase Auth (no Docker, no cloud).
 *
 * It only proves WHO the staff member is: it checks a seeded account's real password and issues a signed token
 * carrying that user id. Everything after that is unchanged: membership, role checks and RLS all run in the
 * database exactly as with a Supabase login. It cannot run in production: this check, prodDeps() and
 * next.config.ts each refuse it independently.
 */
type Env = Record<string, string | undefined>;

const DEV_FLAGS = ["DEV_STAFF_LOGIN", "NEXT_PUBLIC_DEV_STAFF_LOGIN", "DEV_STAFF_LOGIN_SECRET"];

/** Throws if any dev-login setting is present in production, so a stray .env line fails loudly instead of silently. */
export function assertNoDevLoginInProduction(env: Env = process.env, production = env.NODE_ENV === "production") {
  const set = DEV_FLAGS.filter((name) => env[name]);
  if (production && set.length) {
    throw new Error(`Refusing to run: dev staff login settings are set in production (${set.join(", ")}). Remove them.`);
  }
}

export function devStaffLoginEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.DEV_STAFF_LOGIN === "1" && (env.DEV_STAFF_LOGIN_SECRET?.length ?? 0) >= 32;
}

const TOKEN_HOURS = 12;
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(`sora-dev-staff:${payload}`).digest("base64url");

export function signDevToken(userId: string, secret: string, now = Date.now()): string {
  const payload = `${userId}.${now + TOKEN_HOURS * 3_600_000}`;
  return `dev.${payload}.${sign(payload, secret)}`;
}

/** The user id inside a valid, unexpired token, else null. */
export function verifyDevToken(token: string, secret: string, now = Date.now()): string | null {
  const match = /^dev\.([0-9a-f-]{36})\.(\d+)\.([A-Za-z0-9_-]+)$/i.exec(token);
  if (!match) return null;
  const [, userId, expires, signature] = match;
  const expected = Buffer.from(sign(`${userId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return Number(expires) > now ? userId : null;
}

/** POST /api/dev/staff-login  { email, password }  ->  { token } */
export async function devStaffLogin(req: Request, deps: Deps, env: Env = process.env): Promise<Response> {
  if (!devStaffLoginEnabled(env)) return new Response("Not found", { status: 404 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";

  // crypt() re-hashes with the stored hash's own salt: the standard pgcrypto password check.
  const [user] = await deps.db.asService<{ id: string }>(
    "select id from auth.users where lower(email) = $1 and encrypted_password = crypt($2, encrypted_password)",
    [email, password],
  );
  if (!user) return Response.json({ error: "invalid_login" }, { status: 401 });
  return Response.json({ token: signDevToken(user.id, env.DEV_STAFF_LOGIN_SECRET!) });
}
