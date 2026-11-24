import { health } from "../../../server/health.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return health(prodDeps);
}
