import { describe, expect, it } from "vitest";
import { formatRand } from "./money.ts";

const NBSP = " ";

describe("formatRand", () => {
  it("writes South African rands the same way on every device", () => {
    expect(formatRand(28500)).toBe(`R${NBSP}285,00`);
    expect(formatRand(5)).toBe(`R${NBSP}0,05`);
    expect(formatRand(0)).toBe(`R${NBSP}0,00`);
  });

  it("groups thousands with a space", () => {
    expect(formatRand(128500)).toBe(`R${NBSP}1${NBSP}285,00`);
    expect(formatRand(123456789)).toBe(`R${NBSP}1${NBSP}234${NBSP}567,89`);
  });

  it("does not depend on the runtime's locale data", () => {
    const original = Intl.NumberFormat;
    // A browser whose en-ZA data differs must still produce the server's exact text.
    (Intl as { NumberFormat: unknown }).NumberFormat = function () {
      return { format: () => "ZAR 285.00" };
    };
    try {
      expect(formatRand(28500)).toBe(`R${NBSP}285,00`);
    } finally {
      Intl.NumberFormat = original;
    }
  });
});
