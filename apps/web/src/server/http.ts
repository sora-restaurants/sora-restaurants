import type { SubmitResult } from "./deps.ts";

/** HTTP form of a checkout result, shared by the API route and the terminal simulator's test server. */
export function submitResultResponse(result: SubmitResult): Response {
  if (!result.ok) return Response.json({ error: result.error }, { status: result.httpStatus });
  const { statusToken, publicRef, replayed } = result;
  return Response.json({ statusToken, publicRef }, { status: replayed ? 200 : 201 });
}
