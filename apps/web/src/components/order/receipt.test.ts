import { describe, expect, it } from "vitest";
import { formatRand } from "../../lib/money.ts";
import { receiptText } from "./Receipt.tsx";

describe("receiptText", () => {
  it("lists each line, the tip and the total the guest paid", () => {
    const text = receiptText({
      publicRef: "A123", createdAt: "2026-11-26T10:00:00Z", paidAt: "2026-11-26T10:30:00Z", subtotalCents: 23000, tipCents: 2300,
      items: [{ name: "Bunny chow", quantity: 2, unitPriceCents: 9000, notes: "Extra hot sauce" }, { name: "Coke", quantity: 1, unitPriceCents: 5000, notes: "" }],
    }, "Demo Bistro", "Table 4");
    expect(text).toContain("Demo Bistro receipt");
    expect(text).toContain("Order A123 · Table 4");
    expect(text).toContain(`2x Bunny chow (Extra hot sauce)  ${formatRand(18000)}`);
    expect(text).toContain(`Tip ${formatRand(2300)}`);
    expect(text).toContain(`Total ${formatRand(25300)}`);
    expect(text).toContain("Paid, thank you");
  });
});
