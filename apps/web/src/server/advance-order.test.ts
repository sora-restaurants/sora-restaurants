import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { PRIMAVERA } from "../../../../supabase/tests/fixtures";
import { advanceOrder } from "./advance-order.ts";
import type { Deps } from "./deps.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
let orderId: string;

beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
  await submitOrder(
    { qrToken: "demo-table-4-token", idempotencyKey: "key-adv-0001", items: [{ menuItemId: PRIMAVERA, quantity: 1 }] },
    deps,
  );
  orderId = (await db.query<{ id: string }>("select id from orders")).rows[0].id;
});

const advance = (to: unknown, token: string | null = "token-A", id = orderId) =>
  advanceOrder(
    new Request(`http://x/api/kitchen/orders/${id}/advance`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ to }),
    }),
    id,
    deps,
  );
const status = async () => (await db.query<{ status: string }>("select status from orders")).rows[0].status;

describe("advanceOrder", () => {
  it("one tap takes a new ticket straight to preparing", async () => {
    const res = await advance("preparing");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "preparing" });
    expect(await status()).toBe("preparing");
    const events = await db.query("select from_status, to_status from order_events order by id");
    expect(events.rows.slice(1)).toEqual([
      { from_status: "submitted", to_status: "accepted" },
      { from_status: "accepted", to_status: "preparing" },
    ]);
  });

  it("then ready, then served", async () => {
    await advance("preparing");
    expect((await advance("ready")).status).toBe(200);
    expect((await advance("served")).status).toBe(200);
    expect(await status()).toBe("served");
  });

  it("refuses to skip or go backwards", async () => {
    expect((await advance("ready")).status).toBe(409); // submitted cannot jump to ready
    await advance("preparing");
    expect((await advance("submitted")).status).toBe(400); // not a board target at all
    expect((await advance("served")).status).toBe(409);
    expect(await status()).toBe("preparing");
  });

  it("Start is all-or-nothing: if the second step fails, the ticket stays new", async () => {
    await db.exec(`
      create function fail_on_preparing() returns trigger language plpgsql as $$
        begin if new.status = 'preparing' then raise exception 'simulated failure'; end if; return new; end $$;
      create trigger fail_on_preparing before update on orders for each row execute function fail_on_preparing();`);
    expect((await advance("preparing")).status).toBe(500);
    expect(await status()).toBe("submitted");
  });

  it("a new ticket can be rejected; a cooking or ready one can be cancelled", async () => {
    expect((await advance("rejected")).status).toBe(200);
    expect(await status()).toBe("rejected");
  });

  it("cancel works from cooking and from ready, never after served", async () => {
    await advance("preparing");
    expect((await advance("cancelled")).status).toBe(200);
    expect(await status()).toBe("cancelled");
  });

  it("reject only applies to new tickets; served is final", async () => {
    await advance("preparing");
    expect((await advance("rejected")).status).toBe(409);
    await advance("ready");
    await advance("served");
    expect((await advance("cancelled")).status).toBe(409);
    expect(await status()).toBe("served");
  });

  it("Restaurant B staff get 404 and change nothing", async () => {
    const res = await advance("preparing", "token-B");
    expect(res.status).toBe(404);
    expect(await status()).toBe("submitted");
  });

  it("waiters cannot run the kitchen board", async () => {
    expect((await advance("preparing", "token-waiter")).status).toBe(404);
    expect(await status()).toBe("submitted");
  });

  it("no token is 401, a garbage id is 404", async () => {
    expect((await advance("preparing", null)).status).toBe(401);
    expect((await advance("preparing", "token-A", "not-a-uuid")).status).toBe(404);
  });
});
