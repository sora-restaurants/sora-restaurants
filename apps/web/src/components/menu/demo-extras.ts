/** Demo extras: pairings and wait times. Same dish always gets the same suggestions. */

const PAIRINGS: Record<string, string[]> = {
  default: ["House salad", "Sparkling water", "Garlic bread"],
  main: ["Side salad", "Fries", "House red"],
  starter: ["Sparkling water", "Bread basket"],
  dessert: ["Espresso", "Sweet wine"],
  drink: ["Snack plate"],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function demoPairings(name: string): string[] {
  const h = hash(name.toLowerCase());
  const keys = Object.keys(PAIRINGS);
  const key = keys[h % keys.length];
  return PAIRINGS[key].slice(0, 2);
}

export function demoWaitMinutes(itemCount: number): string {
  const base = 8 + itemCount * 2;
  return `${base}–${base + 5}`;
}
