import { readCappedBody } from "../../../server/http.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { MAX_WAITLIST_BODY_BYTES, submitApplication } from "../../../server/waitlist.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readCappedBody(req, MAX_WAITLIST_BODY_BYTES);
  if (body === null) return Response.json({ error: "That is more text than the form accepts. Shorten your answers." }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return Response.json({ error: "We could not read the form. Reload the page and try again." }, { status: 400 }); }
  // The first address in x-forwarded-for is the visitor's, as set by the host's proxy (Vercel).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  try {
    const result = await submitApplication(input, prodDeps().db, ip);
    if (!result.ok) return Response.json({ error: result.error, fields: result.fields }, { status: result.httpStatus });
    return Response.json({ reference: result.reference, restaurantName: result.restaurantName }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    console.error("waitlist submission failed", error);
    return Response.json({ error: "We could not save your application just now. Your answers are still here; try again in a moment." }, { status: 500 });
  }
}
