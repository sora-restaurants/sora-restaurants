import { describe, expect, it } from "vitest";
import { MAX_ORDER_BODY_BYTES, readCappedBody } from "./http.ts";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api/orders", { method: "POST", body, headers });

describe("readCappedBody", () => {
  it("returns small bodies", async () => {
    expect(await readCappedBody(post('{"a":1}'), MAX_ORDER_BODY_BYTES)).toBe('{"a":1}');
  });

  it("refuses an oversized body even when content-length lies", async () => {
    const big = "x".repeat(MAX_ORDER_BODY_BYTES + 1);
    expect(await readCappedBody(post(big), MAX_ORDER_BODY_BYTES)).toBeNull();
    expect(await readCappedBody(post(big, { "content-length": "10" }), MAX_ORDER_BODY_BYTES)).toBeNull();
  });
});
