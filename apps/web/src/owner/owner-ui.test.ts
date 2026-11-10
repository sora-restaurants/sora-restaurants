import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderingUnavailable } from "../components/menu/OrderingUnavailable.tsx";
import { PrintableQrCard } from "./PrintableQrCard.tsx";
import { createMockSessionAdapter } from "./mock-session-adapter.ts";

describe("owner UI contracts", () => {
  it("keeps session transitions behind the adapter", async () => {
    const adapter = createMockSessionAdapter();
    expect((await adapter.openSession("table-2")).ok).toBe(true);
    expect((await adapter.openSession("table-2"))).toEqual({ ok: false, code: "SESSION_ALREADY_OPEN" });
    expect((await adapter.openSession("table-3"))).toEqual({ ok: false, code: "TABLE_DISABLED" });
  });

  it("labels printable material without inventing a QR implementation", async () => {
    const snapshot = await createMockSessionAdapter().getSnapshot();
    const html = renderToStaticMarkup(createElement(PrintableQrCard, { restaurantName: snapshot.restaurantName, table: snapshot.tables[0] }));
    expect(html).toContain("Scan to view the menu");
    expect(html).toContain("QR image supplied at integration");
  });

  it("gives customers an actionable inactive-session state", () => {
    const html = renderToStaticMarkup(createElement(OrderingUnavailable, { restaurant: "Sora Test Kitchen", table: "Table 2" }));
    expect(html).toContain("Ordering is not open yet");
    expect(html).toContain("ask a member of staff");
    expect(html).toContain("Try again");
  });
});

