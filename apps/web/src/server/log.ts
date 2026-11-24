/** One JSON line per server event. POPIA: emails, tokens and notes never reach the logs. */
type Level = "info" | "warn" | "error";
type Fields = { requestId?: string; restaurantId?: string; [key: string]: unknown };

const SECRET_KEY = /email|token|note|password|secret|authorization|cookie/i;
const EMAIL = /[^\s@"',;<>()]+@[^\s@"',;<>()]+\.[A-Za-z]{2,}/g;
const BEARER = /bearer\s+\S+/gi;

export function redact(value: unknown, key = ""): unknown {
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return value.replace(EMAIL, "[email]").replace(BEARER, "Bearer [redacted]");
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  return value;
}

/** Vercel's per-request id, when the handler has the request. */
export const requestIdOf = (req: Request) => req.headers.get("x-vercel-id") ?? undefined;

export function log(level: Level, event: string, fields: Fields = {}, write: (line: string) => void = console[level]) {
  write(JSON.stringify({ level, event, ...(redact(fields) as object), at: new Date().toISOString() }));
}
