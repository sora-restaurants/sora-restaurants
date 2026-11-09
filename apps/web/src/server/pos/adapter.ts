/** What Sora hands to a till. Prices are the server's own snapshot, in integer cents, VAT-inclusive. */
export type PosOrder = {
  orderId: string;
  publicRef: string;
  restaurant: string;
  table: string;
  createdAt: string;
  totalCents: number;
  vatCents: number;
  lines: { name: string; quantity: number; unitPriceCents: number; notes: string }[];
};

/**
 * One implementation per till vendor, added only once that vendor's official API is approved.
 * sendOrder must be safe to call again for the same orderId (the vendor's idempotency key, or a lookup first),
 * because a crash after the till accepted but before Sora recorded it means one retry.
 */
export interface PosAdapter {
  name: string;
  sendOrder(order: PosOrder): Promise<{ externalRef: string }>;
}

/** Stand-in till for demos: prints the docket and issues a reference. failRate makes outages easy to try. */
export function simulatedPos({ failRate = 0, log = console.log }: { failRate?: number; log?: (line: string) => void } = {}): PosAdapter {
  const seen = new Map<string, string>();
  return {
    name: "simulated",
    async sendOrder(order) {
      if (Math.random() < failRate) throw new Error("simulated till offline");
      const existing = seen.get(order.orderId);
      if (existing) return { externalRef: existing };
      const externalRef = `SIM-${String(seen.size + 1).padStart(4, "0")}`;
      seen.set(order.orderId, externalRef);
      const rand = (c: number) => `R${(c / 100).toFixed(2)}`;
      log(
        [
          `🧾 TILL ${externalRef}  ${order.restaurant} · ${order.table} · #${order.publicRef}`,
          ...order.lines.map((l) => `     ${l.quantity}× ${l.name}  ${rand(l.unitPriceCents * l.quantity)}${l.notes ? `  (${l.notes})` : ""}`),
          `     TOTAL ${rand(order.totalCents)}  (VAT ${rand(order.vatCents)})`,
        ].join("\n"),
      );
      return { externalRef };
    },
  };
}
