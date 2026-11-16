import { notFound } from "next/navigation";
import { Menu } from "../../../components/menu/Menu.tsx";
import { DEMO_MENU } from "../../../components/menu/demo-menu.ts";
import { OrderingUnavailable } from "../../../components/menu/OrderingUnavailable.tsx";
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
  if (row.m.orderingEnabled === false) return <OrderingUnavailable restaurant={row.m.restaurant} table={row.m.table} />;
  // The staging demo table shows the full sample menu (photos, specials); every real table shows its own menu.
  const preview = token.startsWith("staging-demo");
  const menu = preview ? { ...DEMO_MENU, table: row.m.table } : row.m;
  return <Menu menu={menu} theme={resolveTheme(row.m.theme)} qrToken={token} preview={preview} />;
}
