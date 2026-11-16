/** Demo extras: wait times. */

export function demoWaitMinutes(itemCount: number): string {
  const base = 8 + itemCount * 2;
  return `${base}–${base + 5}`;
}
