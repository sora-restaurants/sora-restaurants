import { notFound } from "next/navigation";
import { OwnerDashboard } from "../../../owner/OwnerDashboard.tsx";
import { createMockSessionAdapter } from "../../../owner/mock-session-adapter.ts";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const adapter = createMockSessionAdapter();
  return <OwnerDashboard initial={await adapter.getSnapshot()} />;
}

