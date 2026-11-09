import { notFound } from "next/navigation";
import { KitchenPreview } from "../../../kitchen/KitchenPreview.tsx";

// Design preview with 20 sample tickets, no database. Never served in production.
export const dynamic = "force-dynamic";

export default function KitchenPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitchenPreview />;
}
