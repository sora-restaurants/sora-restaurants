import { describe, expect, it } from "vitest";
import { interestCount, johannesburgDay, MAX, MIN } from "./interest-counter.ts";

const at = (iso: string) => new Date(iso);
const DAY = 86_400_000;

describe("simulated interest counter", () => {
  it("starts at 30 and never shows less, even before day zero", () => {
    expect(interestCount(at("2026-11-15T10:00:00+02:00"))).toBe(30);
    expect(interestCount(at("2020-01-01T00:00:00Z"))).toBe(30);
  });

  it("stays between 30 and 50 on every day for five years, across month and year ends", () => {
    const start = at("2026-11-15T12:00:00+02:00").getTime();
    for (let d = 0; d < 365 * 5; d++) {
      const n = interestCount(new Date(start + d * DAY));
      expect(n).toBeGreaterThanOrEqual(MIN);
      expect(n).toBeLessThanOrEqual(MAX);
    }
  });

  it("is the same number all day in Johannesburg and changes only at local midnight", () => {
    // 21:59 UTC on 31 Dec is 23:59 in Johannesburg; 22:00 UTC is already 1 January there.
    expect(johannesburgDay(at("2026-12-31T21:59:59Z"))).toBe(johannesburgDay(at("2026-12-31T00:00:00+02:00")));
    expect(johannesburgDay(at("2026-12-31T22:00:00Z")) - johannesburgDay(at("2026-12-31T21:59:59Z"))).toBe(1);
    expect(interestCount(at("2026-12-31T06:00:00+02:00"))).toBe(interestCount(at("2026-12-31T23:59:00+02:00")));
    expect(johannesburgDay(at("2028-03-01T12:00:00+02:00")) - johannesburgDay(at("2028-02-28T12:00:00+02:00"))).toBe(2); // leap day
  });

  it("mostly rises by about 2 a day, with some flat days and some small drops, and keeps moving after the ceiling", () => {
    const start = at("2026-11-15T12:00:00+02:00").getTime();
    const series = Array.from({ length: 400 }, (_, d) => interestCount(new Date(start + d * DAY)));
    const steps = series.slice(1).map((n, i) => n - series[i]);
    expect(steps.filter((s) => s > 0).length).toBeGreaterThan(steps.length / 2);
    expect(steps.some((s) => s === 0)).toBe(true);
    expect(steps.some((s) => s < 0)).toBe(true);
    const firstClimb = steps.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
    expect(firstClimb).toBeGreaterThan(1);
    expect(firstClimb).toBeLessThan(3);
    expect(new Set(series.slice(200)).size).toBeGreaterThan(3); // not parked on one value
  });
});
