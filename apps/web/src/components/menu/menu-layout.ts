/**
 * How a large menu is grouped on screen. The database keeps its own sections; a layout only regroups them into
 * blocks (Starters, Mains, Alcoholic...) that can hold smaller blocks (Pasta, Pizza...) or a list of dishes.
 */
import type { MenuItem, TableMenu } from "./types.ts";

export type Category = TableMenu["categories"][number];
/** A dish plus the database section it came from (cards, filters and search still use that section's name). */
export type Entry = { item: MenuItem; category: Category };

export type MenuNode = {
  id: string;
  name: string;
  kind: "food" | "drink";
  /** Smaller blocks inside this one. */
  children?: MenuNode[];
  /** Dishes, when this block is a list. */
  entries?: Entry[];
  /** "blocks": show the children as photo blocks. "list": show every dish, under the children's names. */
  showAs?: "blocks" | "list";
  /** Last serving time, "HH:MM" in the restaurant's timezone. After it the block is hidden. */
  until?: string;
};

export type MenuLayout = { groups: { label: string; nodes: MenuNode[] }[] };

const DRINK_SECTION = /cocktail|mimosa|bubbles|wine|cellar|ros[eé]|semi-sweet|beer|cider|spirit|shooter|soft drink|juice|coffee|tea\b|drinks?|smoothie|shake/i;
export const isDrinkSection = (name: string) => DRINK_SECTION.test(name);

/** Any other big menu: one block per database section, split into Eat and Drink. */
export function sectionLayout(categories: Category[]): MenuLayout {
  const node = (c: Category): MenuNode => ({ id: c.id, name: c.name, kind: isDrinkSection(c.name) ? "drink" : "food", entries: c.items.map((item) => ({ item, category: c })) });
  return { groups: [
    { label: "Eat", nodes: categories.filter((c) => !isDrinkSection(c.name)).map(node) },
    { label: "Drink", nodes: categories.filter((c) => isDrinkSection(c.name)).map(node) },
  ] };
}

const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Minutes since midnight in the given timezone. */
export function minutesNow(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Drops blocks past their serving time, and blocks left empty. */
export function servedNow(layout: MenuLayout, minutes: number): MenuLayout {
  const keep = (n: MenuNode): MenuNode | null => {
    if (n.until && minutes >= toMinutes(n.until)) return null;
    if (n.children) {
      const children = n.children.map(keep).filter((c): c is MenuNode => c !== null);
      return children.length > 0 ? { ...n, children } : null;
    }
    return n.entries && n.entries.length > 0 ? n : null;
  };
  return { groups: layout.groups.map((g) => ({ ...g, nodes: g.nodes.map(keep).filter((n): n is MenuNode => n !== null) })).filter((g) => g.nodes.length > 0) };
}

export function entriesOf(n: MenuNode): Entry[] {
  return n.children ? n.children.flatMap(entriesOf) : n.entries ?? [];
}

/** Every block with the trail of blocks above it, top first. */
export function walk(layout: MenuLayout): { node: MenuNode; trail: MenuNode[] }[] {
  const out: { node: MenuNode; trail: MenuNode[] }[] = [];
  const visit = (n: MenuNode, trail: MenuNode[]) => { out.push({ node: n, trail }); n.children?.forEach((c) => visit(c, [...trail, n])); };
  layout.groups.forEach((g) => g.nodes.forEach((n) => visit(n, [])));
  return out;
}
