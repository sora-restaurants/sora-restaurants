import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, resolveTheme, THEME_IDS } from "./themes.ts";

describe("resolveTheme", () => {
  it("keeps known themes", () => {
    for (const id of THEME_IDS) expect(resolveTheme(id)).toBe(id);
  });

  it("falls back for anything else, so a bad row never breaks the menu", () => {
    for (const value of [undefined, null, "", "neon", 42, "LUXURY-MINIMAL"]) {
      expect(resolveTheme(value)).toBe(DEFAULT_THEME);
    }
  });

  it("matches the database's allowed values", () => {
    expect([...THEME_IDS].sort()).toEqual(["fast-casual-vibrant", "luxury-minimal", "rustic-traditional"]);
  });
});
