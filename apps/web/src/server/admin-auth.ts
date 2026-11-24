import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The /admin sign-in: one shared password (ADMIN_PASSWORD) and a signed, expiring cookie (ADMIN_SESSION_SECRET).
// With either variable missing, nobody can sign in. shortcut: one shared password, move to per-person accounts
// (Supabase Auth, as staff use) once more than a few people need access or an audit trail.

export const ADMIN_COOKIE = "sora_admin";
export const SESSION_HOURS = 12;

const digest = (s: string) => createHash("sha256").update(s).digest();
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("hex");

export function adminConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const localDemoPassword = env.NODE_ENV === "development" && !env.VERCEL && env.ADMIN_PASSWORD === "Sora";
  return (localDemoPassword || (env.ADMIN_PASSWORD?.length ?? 0) >= 12) &&
    (env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
}

export function passwordMatches(given: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return adminConfigured(env) && timingSafeEqual(digest(given), digest(env.ADMIN_PASSWORD!));
}

export function newSession(now: number, env: NodeJS.ProcessEnv = process.env): string {
  const expires = String(now + SESSION_HOURS * 3_600_000);
  return `${expires}.${sign(expires, env.ADMIN_SESSION_SECRET!)}`;
}

export function sessionValid(cookie: string | undefined, now: number, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!cookie || !adminConfigured(env)) return false;
  const [expires, mac] = cookie.split(".");
  if (!/^\d+$/.test(expires ?? "") || !mac) return false;
  const expected = sign(expires, env.ADMIN_SESSION_SECRET!);
  return mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) && Number(expires) > now;
}

// shortcut: counted per server instance, so several instances each allow their own 8 tries; move to a shared store if /admin is ever attacked.
const attempts = new Map<string, { n: number; resetAt: number }>();
export function loginAllowed(ip: string, now: number): boolean {
  const a = attempts.get(ip);
  if (!a || a.resetAt < now) { attempts.set(ip, { n: 1, resetAt: now + 15 * 60_000 }); return true; }
  return ++a.n <= 8;
}
