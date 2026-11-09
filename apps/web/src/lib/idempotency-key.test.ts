import { afterEach, describe, expect, it, vi } from "vitest";
import { newIdempotencyKey } from "./idempotency-key.ts";

afterEach(() => vi.unstubAllGlobals());

describe("newIdempotencyKey", () => {
  it("works on a plain-http page, where crypto.randomUUID does not exist (phone on Wi-Fi)", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(newIdempotencyKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is unique each time and fits the server's 8-100 character rule", () => {
    const keys = new Set(Array.from({ length: 1000 }, newIdempotencyKey));
    expect(keys.size).toBe(1000);
    for (const key of keys) expect(key.length).toBeGreaterThanOrEqual(8);
  });
});
