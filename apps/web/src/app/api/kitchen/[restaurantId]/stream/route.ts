import { kitchenStream } from "../../../../../server/kitchen-stream.ts";
import { prodDeps } from "../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  return kitchenStream(req, restaurantId, prodDeps());
}
