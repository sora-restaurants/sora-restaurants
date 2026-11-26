/**
 * Donna's demo: required choices, hand-picked highlights and the quick filters for the large-menu browser.
 *
 * Required choices come only from what Donna's printed menu offers ("grilled or fried", "pepper or mushroom
 * sauce", "with chips or salad", "half or full"). Where the menu says "your choice of sauce" without naming the
 * sauces, the three sauces it names for the other seafood plates are used (marked GUESS below).
 * Chef's picks, Popular tonight and Shareable are flagged by hand for the sales demo; they are not Donna's own.
 */
import type { MenuItem } from "./types.ts";
import { COOKING } from "./customise-options.ts";

export type ChoiceGroup = { name: string; choices: { label: string; priceCents: number }[] };

const free = (...labels: string[]) => labels.map((label) => ({ label, priceCents: 0 }));
const SEAFOOD_SAUCE = free("Lemon butter", "Lemon & herb", "Peri-peri");
const GRILLED_FRIED: ChoiceGroup = { name: "Grilled or fried", choices: free("Grilled", "Fried") };
// The Secondi side options already exist as Donna's owner-set options (all R0), so these labels match them.
const SECONDI_SIDE: ChoiceGroup = { name: "Side", choices: free("Chips", "Medi veg", "Salad", "Rice") };

const BY_NAME: Record<string, ChoiceGroup[]> = {
  "Calamari": [GRILLED_FRIED, { name: "Sauce", choices: SEAFOOD_SAUCE }],
  "Seafood Linguine": [{ name: "Sauce", choices: free("Creamy", "Napolitana") }],
  "Fillet": [{ name: "How cooked", choices: free(...COOKING) }, { name: "Sauce", choices: free("Pepper sauce", "Mushroom sauce") }, SECONDI_SIDE],
  "Lamb Chops": [SECONDI_SIDE],
  "Sole": [{ name: "Sauce", choices: free("Lemon butter", "Lemon herb & caper", "Peri-peri") }, SECONDI_SIDE],
  "Kingklip": [{ name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE], // GUESS: sauces not named on the menu
  "Queen Prawns": [{ name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE],
  "Calamari Main": [GRILLED_FRIED, { name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE], // GUESS: sauces
  "Baby Chicken": [{ name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE],
  "Seafood Platter for One": [{ name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE], // GUESS: sauces
  "Hake": [GRILLED_FRIED, { name: "Sauce", choices: SEAFOOD_SAUCE }, SECONDI_SIDE], // GUESS: sauces
  "Seared Salmon": [SECONDI_SIDE],
  "Cannoli": [{ name: "Filling", choices: free("Oreo", "Pistachio") }],
  "Italian Doughnuts": [{ name: "Filling", choices: free("Custard", "Chocolate") }],
  "Plain Waffle": [{ name: "Topping", choices: free("Maple syrup", "Honey") }],
  "Red Bull": [{ name: "Flavour", choices: free("Original", "Sugar Free", "Summer Edition") }],
  "Valpré Still or Sparkling 750ml": [{ name: "Water", choices: free("Still", "Sparkling") }],
  "Valpré Still or Sparkling 350ml": [{ name: "Water", choices: free("Still", "Sparkling") }],
};

export function isDonnas(restaurant: string): boolean {
  return /^donna/i.test(restaurant.trim());
}

/** Choices the guest must make before the dish can go in the basket. Priced choices reuse the dish's owner-set options. */
export function requiredGroups(restaurant: string, item: MenuItem): ChoiceGroup[] {
  if (!isDonnas(restaurant)) return [];
  const groups = [...(BY_NAME[item.name] ?? [])];
  if (/with chips or salad/i.test(item.description)) groups.push({ name: "Side", choices: free("Chips", "Salad") });
  // "Half or full portion" waffles and the milkshakes with a printed "Large" price: the extra comes from the owner option.
  const priced = (label: string) => item.options?.find((o) => o.label === label);
  const full = priced("Full portion");
  if (full) groups.push({ name: "Portion", choices: [{ label: "Half portion", priceCents: 0 }, { label: full.label, priceCents: full.priceCents }] });
  const large = priced("Large");
  if (large) groups.push({ name: "Size", choices: [{ label: "Regular", priceCents: 0 }, { label: large.label, priceCents: large.priceCents }] });
  return groups;
}

/** Demo-only highlights, by dish name. Hand-picked for the pitch, not Donna's own recommendations. */
export const DONNA_CHEFS_PICKS = new Set(["Focaccia Prima Donna", "Burrata con Pomodoro", "Prawn Linguine", "Butternut Ravioli", "Fillet", "Tiramisu"]);
export const DONNA_POPULAR_TONIGHT = ["Margherita", "Calamari", "Seafood Linguine", "Creamy Prawn Tails", "Rigatoni al Burrata", "Lamb Chops"];
/** Sections whose dishes we call "Shareable" in the demo (a guess: the menu does not say). */
const SHAREABLE_SECTIONS = /^(antipasti|pizze)$/i;

export type QuickFilter = "vegetarian" | "kids" | "under100" | "shareable";
export const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "kids", label: "Kids" },
  { id: "under100", label: "Under R100" },
  { id: "shareable", label: "Shareable" },
];

export function matchesFilter(filter: QuickFilter, item: MenuItem, categoryName: string): boolean {
  switch (filter) {
    // Only what the menu tags: Donna's marks dishes vegetarian or vegan; vegan counts as vegetarian.
    case "vegetarian": return !!item.dietaryTags?.some((t) => /^(vegetarian|vegan)$/i.test(t));
    case "kids": return /kids|bambini/i.test(categoryName);
    case "under100": return item.priceCents < 10_000;
    case "shareable": return SHAREABLE_SECTIONS.test(categoryName);
  }
}

const DRINK_SECTION = /cocktail|mimosa|bubbles|wine|cellar|beer|cider|spirit|shooter|soft drink|juice|coffee|tea\b|drinks?/i;
export const isDrinkSection = (name: string) => DRINK_SECTION.test(name);

/** Plain-text search over dish name, description and section. */
export function matchesQuery(query: string, item: MenuItem, categoryName: string): boolean {
  const words = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
  const hay = `${item.name} ${item.description} ${categoryName}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return words.every((w) => hay.includes(w));
}
