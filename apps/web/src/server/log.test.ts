import { describe, expect, it } from "vitest";
import { log } from "./log.ts";

describe("log", () => {
  it("writes one JSON line and redacts emails, tokens and notes", () => {
    const lines: string[] = [];
    log("error", "submit_order failed", {
      requestId: "r1",
      restaurantId: "rest-1",
      email: "a@b.co",
      qrToken: "demo-table-4-token",
      items: [{ note: "no onions" }],
      error: "boom for jo@example.com, Bearer abc.def",
    }, (l) => lines.push(l));
    expect(lines).toHaveLength(1);
    const out = JSON.parse(lines[0]);
    expect(out).toMatchObject({ level: "error", event: "submit_order failed", requestId: "r1", restaurantId: "rest-1", email: "[redacted]", qrToken: "[redacted]", items: [{ note: "[redacted]" }] });
    expect(out.error).toBe("boom for [email], Bearer [redacted]");
  });
});
