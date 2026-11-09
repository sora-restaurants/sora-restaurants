import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { submitResultResponse } from "../apps/web/src/server/http.ts";
import { submitOrder } from "../apps/web/src/server/submit-order.ts";
import { testDeps } from "../apps/web/src/server/test-deps.ts";
import { freshDb } from "../supabase/tests/db.ts";

const run = promisify(execFile);
const SCRIPT = path.join(__dirname, "simulate-order.mjs");

async function simulate(args: string[]) {
  try {
    const { stdout, stderr } = await run(process.execPath, ["--experimental-strip-types", SCRIPT, ...args], {
      timeout: 60_000,
    });
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, out: e.stdout + e.stderr };
  }
}

let db: PGlite;
let server: Server;
let url: string;
const totals = async () => (await db.query<{ total_cents: number }>("select total_cents from orders")).rows;

beforeAll(async () => {
  db = await freshDb();
  const deps = testDeps(db);
  // Same checkout and HTTP mapping as the real /api/orders route.
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const response = req.method === "POST" && req.url === "/api/orders"
      ? submitResultResponse(await submitOrder(body, deps))
      : new Response("not found", { status: 404 });
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("simulate-order.mjs", () => {
  it("places Table 4 order from the terminal", async () => {
    const { code, out } = await simulate(["--url", url]);
    expect(out).toContain("✅ Order");
    expect(code).toBe(0);
    expect(await totals()).toEqual([{ total_cents: 28500 }]);
  });

  it("tampered price is refused", async () => {
    const { code, out } = await simulate(["--url", url, "--tamper"]);
    expect(code).toBe(1);
    expect(out).toContain("400 unexpected_field");
    expect(await totals()).toHaveLength(1);
  });

  it("server down gives a clear message", async () => {
    const { code, out } = await simulate(["--url", "http://127.0.0.1:9"]);
    expect(code).toBe(1);
    expect(out).toContain("Cannot reach");
  });

  it("demo:pipeline runs end to end in memory", async () => {
    const { code, out } = await simulate([]);
    expect(out).toContain("🍳 Kitchen received");
    expect(out).toContain("R285.00");
    expect(code).toBe(0);
  });
});
