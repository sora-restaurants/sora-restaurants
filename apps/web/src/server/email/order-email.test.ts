import { describe, expect, it } from "vitest";
import { freshDb } from "../../../../../supabase/tests/db";
import { BUNNY_CHOW } from "../../../../../supabase/tests/fixtures";
import { submitOrder } from "../submit-order.ts";
import { testDeps } from "../test-deps";
import { type EmailSender, type OrderEmail, sendPendingEmails } from "./order-email.ts";

describe("order email", () => {
  it("sends one escaped order summary, clearly not a tax invoice, then marks it sent", async () => {
    const db = await freshDb();
    const deps = testDeps(db);
    await db.query("update menu_items set name = 'Bunny <chow>' where id = $1", [BUNNY_CHOW]);
    await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-email-01", items: [{ menuItemId: BUNNY_CHOW, quantity: 2 }], email: "guest@example.com" }, deps);
    const outbox: OrderEmail[] = [];
    const sender: EmailSender = { name: "test", send: async (e) => void outbox.push(e) };

    expect(await sendPendingEmails(deps, sender)).toEqual({ sent: 1, failed: 0 });
    expect(await sendPendingEmails(deps, sender)).toEqual({ sent: 0, failed: 0 });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("guest@example.com");
    expect(outbox[0].subject).toContain("Demo Bistro");
    expect(outbox[0].html).toContain("Bunny &#60;chow&#62;");
    expect(outbox[0].html).not.toContain("<chow>");
    expect(outbox[0].text).toContain("R 250,00");
    expect(outbox[0].text).toContain("not a tax invoice");
    expect(outbox[0].text).toContain("pay your waiter");
  });

  it("a sending failure retries later and never touches the order", async () => {
    const db = await freshDb();
    const deps = testDeps(db);
    await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-email-02", items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }], email: "guest@example.com" }, deps);
    const broken: EmailSender = { name: "broken", send: async () => { throw new Error("mail server down"); } };
    expect(await sendPendingEmails(deps, broken)).toEqual({ sent: 0, failed: 1 });
    expect((await db.query("select status, attempts from email_jobs")).rows).toEqual([{ status: "failed", attempts: 1 }]);
    expect((await db.query("select status from orders")).rows).toEqual([{ status: "submitted" }]);
  });
});
