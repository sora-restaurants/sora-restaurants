import type { Deps } from "./deps.ts";
import { log } from "./log.ts";

/** Liveness plus a trivial DB round trip. Says nothing about versions or config. */
export async function health(deps: () => Deps): Promise<Response> {
  try {
    await deps().db.asService("select 1");
    return Response.json({ ok: true, db: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    log("error", "health_db_failed", { error: error instanceof Error ? error.message : "" });
    return Response.json({ ok: false, db: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
