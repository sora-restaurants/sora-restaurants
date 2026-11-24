import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DB } from "../playwright.config.ts";

const MENU = "/t/demo-table-1-token";
const BOEREWORS = "a2000000-0000-0000-0000-000000000002";

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client(E2E_DB);
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}
const orderCount = async () => Number((await sql<{ n: string }>("select count(*) n from orders"))[0].n);

/** Adds one dish and walks the basket to its last step (review → payment → receipt), ready to place. */
async function readyToPlace(page: Page, name = "Bunny chow") {
  await page.goto(MENU);
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await page.getByRole("button", { name: /View your order/ }).click();
  const basket = page.getByRole("dialog");
  await basket.getByRole("button", { name: "Continue" }).click();
  await basket.getByRole("button", { name: "Continue" }).click();
}
const placeButton = (page: Page) => page.getByRole("dialog").getByRole("button", { name: /Place order|Sending/ });
const alert = (page: Page) => page.getByRole("dialog").getByRole("alert");
const received = (page: Page) => expect(page.getByRole("status").filter({ hasText: "Received" })).toBeVisible();

test("repeated taps on Place order create exactly one order", async ({ page }) => {
  await readyToPlace(page);
  const before = await orderCount();
  // Three clicks in one task, before React can re-render the button as disabled.
  await placeButton(page).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click(); });
  await received(page);
  expect(await orderCount()).toBe(before + 1);
});

test("a submit that times out is retried with the same key: one order", async ({ page }) => {
  await readyToPlace(page);
  const before = await orderCount();
  const keys: string[] = [];
  let first = true;
  await page.route(`**${MENU}`, async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    const body = req.postData() ?? "";
    if (!body.includes("idempotencyKey")) return route.continue(); // checkout and receipt actions pass through
    keys.push(body);
    if (!first) return route.continue();
    first = false;
    await route.fetch(); // the server places the order...
    await new Promise((r) => setTimeout(r, 20_000)); // ...but the reply never arrives in time
    await route.abort().catch(() => {});
  });
  await placeButton(page).click();
  await expect(alert(page)).toContainText("taking too long", { timeout: 20_000 });
  expect(await orderCount()).toBe(before + 1);
  await placeButton(page).click();
  await received(page);
  expect(await orderCount()).toBe(before + 1);
  const keyOf = (body: string) => body.match(/"idempotencyKey":"([0-9a-f]+)"/)?.[1];
  expect(keyOf(keys[0])).toBeTruthy();
  expect(keyOf(keys[1])).toBe(keyOf(keys[0]));
});

test("refresh after placing does not resubmit and keeps tracking the order", async ({ page }) => {
  await readyToPlace(page);
  const before = await orderCount();
  await placeButton(page).click();
  await received(page);
  await page.reload();
  await received(page);
  expect(await orderCount()).toBe(before + 1);
});

test("a dish sold out mid-session gives the sold-out message", async ({ page }) => {
  await readyToPlace(page, "Boerewors roll");
  await sql("update menu_items set sold_out = true where id = $1", [BOEREWORS]);
  try {
    const before = await orderCount();
    await placeButton(page).click();
    await expect(alert(page)).toContainText("just sold out");
    expect(await orderCount()).toBe(before);
  } finally {
    await sql("update menu_items set sold_out = false where id = $1", [BOEREWORS]);
  }
});

test("offline says 'not sent yet' and retry works once back online", async ({ page, context }) => {
  await readyToPlace(page);
  const before = await orderCount();
  await context.setOffline(true);
  await placeButton(page).click();
  await expect(alert(page)).toContainText("not sent yet");
  expect(await orderCount()).toBe(before);
  await context.setOffline(false);
  await placeButton(page).click();
  await received(page);
  expect(await orderCount()).toBe(before + 1);
});
