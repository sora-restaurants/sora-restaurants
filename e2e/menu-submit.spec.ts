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

async function addDish(page: Page, name = "Bunny chow") {
  await page.goto(MENU);
  await page.getByRole("button", { name: `Add ${name}` }).click();
}
const placeButton = (page: Page) => page.getByRole("button", { name: /Place order|Order & pay|Sending/ });
const sent = (page: Page) => expect(page.getByText("Order sent to the kitchen")).toBeVisible();

test("repeated taps on Place order create exactly one order", async ({ page }) => {
  await addDish(page);
  const before = await orderCount();
  // Three clicks in one task, before React can re-render the button as disabled.
  await placeButton(page).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click(); });
  await sent(page);
  expect(await orderCount()).toBe(before + 1);
});

test("a submit that times out is retried with the same key: one order", async ({ page }) => {
  await addDish(page);
  const before = await orderCount();
  const keys: string[] = [];
  let first = true;
  await page.route(`**${MENU}`, async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    keys.push(req.postData() ?? "");
    if (!first) return route.continue();
    first = false;
    await route.fetch(); // the server places the order...
    await new Promise((r) => setTimeout(r, 20_000)); // ...but the reply never arrives in time
    await route.abort().catch(() => {});
  });
  await placeButton(page).click();
  await expect(page.locator("p[role=alert]")).toContainText("taking too long", { timeout: 20_000 });
  expect(await orderCount()).toBe(before + 1);
  await placeButton(page).click();
  await sent(page);
  await expect(page.getByRole("status")).toContainText("already received, not sent twice");
  expect(await orderCount()).toBe(before + 1);
  const keyOf = (body: string) => body.match(/"idempotencyKey":"([0-9a-f]+)"/)?.[1];
  expect(keyOf(keys[0])).toBeTruthy();
  expect(keyOf(keys[1])).toBe(keyOf(keys[0]));
});

test("refresh after placing does not resubmit", async ({ page }) => {
  await addDish(page);
  const before = await orderCount();
  await placeButton(page).click();
  await sent(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Add Bunny chow" })).toBeVisible();
  await expect(placeButton(page)).toHaveCount(0);
  expect(await orderCount()).toBe(before + 1);
});

test("a dish sold out mid-session gives the sold-out message", async ({ page }) => {
  await addDish(page, "Boerewors roll");
  await sql("update menu_items set available = false where id = $1", [BOEREWORS]);
  try {
    const before = await orderCount();
    await placeButton(page).click();
    await expect(page.locator("p[role=alert]")).toContainText("just sold out");
    expect(await orderCount()).toBe(before);
  } finally {
    await sql("update menu_items set available = true where id = $1", [BOEREWORS]);
  }
});

test("offline says 'not sent yet' and retry works once back online", async ({ page, context }) => {
  await addDish(page);
  const before = await orderCount();
  await context.setOffline(true);
  await placeButton(page).click();
  await expect(page.locator("p[role=alert]")).toContainText("not sent yet");
  expect(await orderCount()).toBe(before);
  await context.setOffline(false);
  await placeButton(page).click();
  await sent(page);
  expect(await orderCount()).toBe(before + 1);
});

test("pay now goes to the payment page", async ({ page }) => {
  await addDish(page);
  await page.getByText("Pay now").click();
  await placeButton(page).click();
  await expect(page).toHaveURL(/\/pay\//);
});

test("email copy order is sent", async ({ page }) => {
  await addDish(page);
  await page.getByLabel("Email me a copy of my order").check();
  await page.getByLabel("Email address for your order copy").fill("guest@example.com");
  await placeButton(page).click();
  await sent(page);
});
