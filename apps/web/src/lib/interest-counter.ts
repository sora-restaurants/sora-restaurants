/**
 * The public "launch interest indicator" on /waitlist. It is SIMULATED: a fixed function of the calendar day in
 * Johannesburg, never a count of registrations (the real count lives in the database and shows only in /admin).
 * The page labels it as illustrative. Same day, same number, on every device; nothing is stored or random per load.
 */
const DAY_ZERO = Date.UTC(2026, 10, 15); // 15 November 2026 shows 30
export const MIN = 30;
export const MAX = 50;

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" });

/** Whole calendar days since day zero, counted in Africa/Johannesburg. */
export function johannesburgDay(now: Date): number {
  const [y, m, d] = dayFormat.format(now).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - DAY_ZERO) / 86_400_000);
}

/** 0 to 99, fixed per day number. */
function roll(day: number): number {
  let x = (day + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) % 100;
}

export function interestCount(now: Date = new Date()): number {
  const days = johannesburgDay(now);
  let value = MIN;
  for (let day = 1; day <= days; day++) {
    const r = roll(day);
    // Mostly +2 a day; some days +3 or +1, some flat, a few slightly down.
    value += r < 55 ? 2 : r < 78 ? 3 : r < 84 ? 1 : r < 90 ? 0 : r < 96 ? -1 : -2;
    // At the ceiling it falls back a few and climbs again, so it keeps moving inside the range.
    if (value > MAX) value = MAX - 3 - (r % 6);
    if (value < MIN) value = MIN;
  }
  return value;
}
