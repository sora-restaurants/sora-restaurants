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
import { isDrinkSection, type Category, type Entry, type MenuLayout, type MenuNode } from "./menu-layout.ts";

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

/** Plain-text search over dish name, description and section. */
export function matchesQuery(query: string, item: MenuItem, categoryName: string): boolean {
  const words = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
  const hay = `${item.name} ${item.description} ${categoryName}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return words.every((w) => hay.includes(w));
}

/**
 * Donna's serving times, from their breakfast menu (donnamodernitalian.co.za, DONNA-BREAKFAST.pdf, Jan 2026):
 * "Breakfast classics: served until 12pm", "Toasties / Wraps: served until 4pm", "Mimosas: served until 1pm".
 * The breakfast menu only prints the 12pm time beside Breakfast classics; the whole Breakfast block follows it.
 */
export const DONNA_TIMEZONE = "Africa/Johannesburg";
export const DONNA_SERVING_UNTIL = { breakfast: "12:00", toastiesAndWraps: "16:00", mimosas: "13:00" };

/** Where each of Donna's dishes goes on screen: [block, sub-block?, sub-sub-block?], from its section and name. */
function placeDonna(section: string, name: string): string[] {
  const s = section.toLowerCase();
  if (/breakfast/.test(s)) {
    if (/smoothie/i.test(name)) return ["Smoothies & shakes"];
    if (/pancake/i.test(name)) return ["Breakfast", "Pancakes"];
    if (/fruit bowl/i.test(name)) return ["Breakfast", "Healthy start"];
    return ["Breakfast", "Breakfast classics"];
  }
  if (/toasties|wraps/.test(s)) return ["Mains", "Toasties & wraps"];
  if (s === "antipasti") return ["Starters", "Antipasti"];
  if (s === "insalate") return ["Starters", "Salads"];
  if (s === "primi") return ["Mains", "Pasta & risotto"];
  if (s === "pizze") return ["Mains", "Pizza"];
  if (s === "secondi") return [ "Mains", /sole|kingklip|prawn|calamari|seafood|hake|salmon/i.test(name) ? "Seafood" : "Meat & chicken"];
  if (s === "kids") return ["Mains", "Kids"];
  if (s === "sides") return ["Mains", "Sides"];
  if (s === "dolci") return ["Desserts", "Dolci"];
  if (/waffle|shake|gelato/.test(s)) return /shake/i.test(name) ? ["Smoothies & shakes"] : ["Desserts", "Waffles & gelato"];
  if (s === "cocktails") return ["Alcoholic", "Cocktails"];
  if (/mimosa|bubbles/.test(s)) return ["Alcoholic", "Wine", /mimosa/i.test(name) ? "Mimosas" : "Bubbles"];
  if (s === "wine by the glass") return ["Alcoholic", "Wine", "Wine by the glass"];
  if (s === "white wine") return ["Alcoholic", "Wine", "White wine"];
  if (s === "red wine") return ["Alcoholic", "Wine", "Red wine"];
  if (/ros[eé]|semi-sweet/.test(s)) return ["Alcoholic", "Wine", "Rosé & sweet"];
  if (s === "cellar list") return ["Alcoholic", "Wine", "Cellar list"];
  if (/beer|cider/.test(s)) return ["Alcoholic", "Beer & cider"];
  if (/spirit|shooter/.test(s)) return ["Alcoholic", "Spirits & shooters"];
  if (/soft drink|juice/.test(s)) return [/juice/i.test(name) ? "Juices" : "Soft drinks"];
  if (/coffee|tea/.test(s)) return ["Tea & coffee"];
  return [section]; // a section added later still shows, as its own block
}

/** Block order on the home screen, and inside each block. Anything not listed goes last, in menu order. */
const DONNA_ORDER = [
  "Breakfast", "Healthy start", "Pancakes", "Breakfast classics",
  "Starters", "Antipasti", "Salads",
  "Mains", "Pasta & risotto", "Pizza", "Meat & chicken", "Seafood", "Toasties & wraps", "Kids", "Sides",
  "Desserts", "Dolci", "Waffles & gelato",
  "Alcoholic", "Cocktails", "Wine", "Wine by the glass", "White wine", "Red wine", "Rosé & sweet", "Cellar list", "Mimosas", "Bubbles", "Beer & cider", "Spirits & shooters",
  "Soft drinks", "Juices", "Tea & coffee", "Smoothies & shakes",
];
const DRINK_BLOCKS = new Set(["Alcoholic", "Soft drinks", "Juices", "Tea & coffee", "Smoothies & shakes"]);
const SHOW_AS_BLOCKS = new Set(["Mains", "Alcoholic", "Wine"]);
const UNTIL: Record<string, string> = { "Breakfast": DONNA_SERVING_UNTIL.breakfast, "Toasties & wraps": DONNA_SERVING_UNTIL.toastiesAndWraps, "Mimosas": DONNA_SERVING_UNTIL.mimosas };
const slug = (path: string[]) => path.join("-").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Donna's menu as Troy laid it out: Breakfast, Starters, Mains, Desserts; then Alcoholic and the non-alcoholic drinks. */
export function donnaLayout(categories: Category[]): MenuLayout {
  type Draft = { name: string; path: string[]; children: Map<string, Draft>; entries: Entry[] };
  const root: Draft = { name: "", path: [], children: new Map(), entries: [] };
  for (const category of categories) for (const item of category.items) {
    let at = root;
    for (const name of placeDonna(category.name, item.name)) {
      if (!at.children.has(name)) at.children.set(name, { name, path: [...at.path, name], children: new Map(), entries: [] });
      at = at.children.get(name)!;
    }
    at.entries.push({ item, category });
  }
  const rank = (name: string) => { const i = DONNA_ORDER.indexOf(name); return i < 0 ? DONNA_ORDER.length : i; };
  const build = (d: Draft, kind: MenuNode["kind"]): MenuNode => {
    const children = [...d.children.values()].sort((a, b) => rank(a.name) - rank(b.name)).map((c) => build(c, kind));
    return {
      id: slug(d.path), name: d.name, kind,
      ...(children.length > 0 ? { children, showAs: SHOW_AS_BLOCKS.has(d.name) ? "blocks" : "list" } : { entries: d.entries }),
      ...(UNTIL[d.name] ? { until: UNTIL[d.name] } : {}),
    } as MenuNode;
  };
  const top = [...root.children.values()].sort((a, b) => rank(a.name) - rank(b.name));
  const kindOf = (name: string): MenuNode["kind"] => DRINK_BLOCKS.has(name) || (rank(name) === DONNA_ORDER.length && isDrinkSection(name)) ? "drink" : "food";
  const nodes = top.map((d) => build(d, kindOf(d.name)));
  return { groups: [
    { label: "Eat", nodes: nodes.filter((n) => n.kind === "food") },
    { label: "Drink", nodes: nodes.filter((n) => n.kind === "drink") },
  ] };
}
