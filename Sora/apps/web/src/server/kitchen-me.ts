import type { Deps } from "./deps.ts";

/** GET /api/kitchen/me -> the restaurants whose kitchen board this staff member may open. */
export async function kitchenMe(req: Request, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // RLS already limits rows to the user's restaurants; the role filter keeps waiters off the board.
  const restaurants = await deps.db.asUser<{ id: string; name: string }>(
    userId,
    "select id, name from restaurants where is_member(id, array['owner','manager','kitchen']) order by name",
  );
  return Response.json({ restaurants });
}
