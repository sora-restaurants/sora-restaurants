import { notFound } from "next/navigation";
import { Menu } from "../../../components/menu/Menu.tsx";
import type { TableMenu } from "../../../components/menu/types.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { resolveTheme } from "../../../themes/themes.ts";

export const dynamic = "force-dynamic";

// The QR code opens /t/<qr_token>. The token picks the restaurant and table server-side; its row picks the theme.
export default async function TableMenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length > 100) notFound();
  const [row] = await prodDeps().db.asService<{ m: TableMenu | null }>("select get_table_menu($1) m", [token]);
  if (!row?.m) notFound();
  return <Menu menu={row.m} theme={resolveTheme(row.m.theme)} qrToken={token} />;
}
