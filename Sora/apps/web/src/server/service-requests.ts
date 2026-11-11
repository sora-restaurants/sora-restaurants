import { z } from "zod";
import type { Deps } from "./deps.ts";

const Create = z.object({
  qrToken: z.string().min(1).max(100),
  type: z.enum(["waiter", "water", "cutlery", "bill", "other"]),
  notes: z.string().max(200).optional(),
}).strict();

export type ServiceRequest = {
  id: string;
  type: string;
  status: string;
  notes: string;
  table: string;
  createdAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Customer request. Restaurant and table come from the QR token, never the client. */
export async function createServiceRequest(input: unknown, deps: Deps) {
  const parsed = Create.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_request" };
  try {
    const [row] = await deps.db.asService<{ id: string }>(
      "select create_service_request($1, $2, $3) id",
      [parsed.data.qrToken, parsed.data.type, parsed.data.notes ?? ""],
    );
    return { ok: true as const, id: row.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "table_not_found") return { ok: false as const, error: message };
    return { ok: false as const, error: "internal" };
  }
}

export async function listServiceRequests(userId: string, deps: Deps): Promise<ServiceRequest[]> {
  return deps.db.asUser<ServiceRequest>(
    userId,
    `select r.id, r.type, r.status, r.notes, t.label as table, r.created_at as "createdAt"
       from service_requests r
       join tables t on t.restaurant_id = r.restaurant_id and t.id = r.table_id
      where r.status in ('open', 'acknowledged')
      order by r.created_at`,
  );
}

export async function updateServiceRequest(userId: string, id: string, to: string, deps: Deps) {
  if (!UUID.test(id) || !["acknowledged", "completed", "cancelled"].includes(to)) {
    return { ok: false as const, error: "invalid_request" };
  }
  try {
    await deps.db.asUser(userId, "select update_service_request($1, $2)", [id, to]);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found" || message === "invalid_transition") return { ok: false as const, error: message };
    return { ok: false as const, error: "internal" };
  }
}
