import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Menu } from "./Menu.tsx";
import { donnaLayout, matchesFilter, matchesQuery, requiredGroups } from "./donna-demo.ts";
import { entriesOf, minutesNow, servedNow, type MenuNode } from "./menu-layout.ts";

const dish = (name: string, description = "", extra: object = {}) => ({ id: name, name, description, priceCents: 10_000, ...extra });

describe("Donna's required choices", () => {
  it("asks how the fillet is cooked, which sauce and which side", () => {
    const groups = requiredGroups("Donna's", dish("Fillet", "250g beef fillet with pepper or mushroom sauce and a side."));
    expect(groups.map((g) => g.name)).toEqual(["How cooked", "Sauce", "Side"]);
    expect(groups[1].choices.map((c) => c.label)).toEqual(["Pepper sauce", "Mushroom sauce"]);
  });

  it("offers chips or salad only where the menu says so", () => {
    expect(requiredGroups("Donna's", dish("Halloumi Wrap", "Grilled halloumi. With chips or salad."))[0].choices.map((c) => c.label)).toEqual(["Chips", "Salad"]);
    expect(requiredGroups("Donna's", dish("Margherita", "Tomato, mozzarella and basil."))).toEqual([]);
  });

  it("prices a milkshake's Large from the owner's own option", () => {
    const groups = requiredGroups("Donna's", dish("Oreo Milkshake", "", { options: [{ id: "o", label: "Large", priceCents: 1000 }] }));
    expect(groups).toEqual([{ name: "Size", choices: [{ label: "Regular", priceCents: 0 }, { label: "Large", priceCents: 1000 }] }]);
  });

  it("leaves other restaurants alone", () => {
    expect(requiredGroups("Other Grill", dish("Fillet"))).toEqual([]);
  });
});

describe("quick filters and search", () => {
  it("only calls tagged dishes vegetarian", () => {
    expect(matchesFilter("vegetarian", dish("Chips", "", { dietaryTags: ["vegan"] }), "Sides")).toBe(true);
    expect(matchesFilter("vegetarian", dish("Calamari"), "Antipasti")).toBe(false);
    expect(matchesFilter("under100", dish("Chips", "", { priceCents: 9_999 }), "Sides")).toBe(true);
    expect(matchesFilter("under100", dish("Margherita", "", { priceCents: 10_000 }), "Pizze")).toBe(false);
  });

  it("matches every word, ignoring accents", () => {
    expect(matchesQuery("creme brulee", dish("Deconstructed Crème Brûlée"), "Dolci")).toBe(true);
    expect(matchesQuery("prawn pizza", dish("Seafood Pizza", "prawns, mussels"), "Pizze")).toBe(true);
    expect(matchesQuery("prawn pizza", dish("Prawn Linguine"), "Primi")).toBe(false);
  });
});

describe("large menu browser", () => {
  const big = {
    restaurant: "Donna's", table: "Table 4", theme: "luxury-minimal",
    categories: Array.from({ length: 5 }, (_, c) => ({ id: `c${c}`, name: c === 4 ? "Red wine" : `Food ${c}`, items: Array.from({ length: 10 }, (_, i) => dish(`Dish ${c}-${i}`)) })),
  };

  it("opens on section blocks with search and quick filters, in Donna's theme", () => {
    const html = renderToStaticMarkup(createElement(Menu, { menu: big, theme: "luxury-minimal", qrToken: "preview" }));
    expect(html).toContain('data-theme="donna"');
    expect(html).toContain("Search the menu");
    expect(html).toContain("Under R100");
    expect(html).toContain("section-block");
    expect(html).toContain(">Drink<");
    expect(html).not.toContain("Dish 0-0"); // dishes only show once a section is opened
  });
});

describe("Donna's blocks", () => {
  const sec = (name: string, ...dishes: string[]) => ({ id: name, name, items: dishes.map((d) => dish(d)) });
  const categories = [
    sec("Breakfast & brunch", "Berry Best Smoothie", "Blueberry Pancakes", "Eggs Benedict"),
    sec("Toasties & wraps", "Halloumi Wrap"),
    sec("Antipasti", "Calamari"), sec("Insalate", "Caesar Salad"),
    sec("Primi", "Prawn Linguine"), sec("Pizze", "Margherita"), sec("Secondi", "Fillet", "Hake"),
    sec("Dolci", "Tiramisu"), sec("Waffles, shakes & gelato", "Oreo Waffle", "Oreo Milkshake"),
    sec("Cocktails", "Negroni"), sec("Mimosas & bubbles", "Mimosa", "Moët Brut"),
    sec("Wine by the glass", "House White"), sec("Rosé & semi-sweet", "Babylonstoren Rosé"), sec("Cellar list", "Kanonkop"),
    sec("Beer & cider", "Castle Lite"), sec("Spirits & shooters", "Jägermeister"),
    sec("Soft drinks & juice", "Coca-Cola", "Orange Juice"), sec("Coffee & tea", "Cappuccino"),
  ];
  const layout = donnaLayout(categories);
  const names = (nodes: MenuNode[] = []) => nodes.map((n) => n.name);
  const find = (l: typeof layout, ...trail: string[]) => trail.reduce<MenuNode | undefined>((at, name) => (at ? at.children : l.groups.flatMap((g) => g.nodes))?.find((n) => n.name === name), undefined);

  it("opens on Breakfast, Starters, Mains, Desserts, then the drinks", () => {
    expect(layout.groups.map((g) => [g.label, names(g.nodes)])).toEqual([
      ["Eat", ["Breakfast", "Starters", "Mains", "Desserts"]],
      ["Drink", ["Alcoholic", "Soft drinks", "Juices", "Tea & coffee", "Smoothies & shakes"]],
    ]);
  });

  it("keeps rosé and every other drink out of the food blocks", () => {
    const food = layout.groups[0].nodes.flatMap(entriesOf).map((e) => e.item.name);
    expect(food).not.toContain("Babylonstoren Rosé");
    expect(food).not.toContain("Oreo Milkshake");
    expect(food).not.toContain("Berry Best Smoothie");
    expect(names(find(layout, "Alcoholic")?.children)).toEqual(["Cocktails", "Wine", "Beer & cider", "Spirits & shooters"]);
    expect(names(find(layout, "Alcoholic", "Wine")?.children)).toEqual(["Wine by the glass", "Rosé & sweet", "Cellar list", "Mimosas", "Bubbles"]);
    expect(entriesOf(find(layout, "Juices")!).map((e) => e.item.name)).toEqual(["Orange Juice"]);
  });

  it("shows a Milkshakes section with the smoothies", () => {
    const moved = donnaLayout([...categories, sec("Milkshakes", "Bar One Milkshake")]);
    expect(entriesOf(find(moved, "Smoothies & shakes")!).map((e) => e.item.name)).toContain("Bar One Milkshake");
  });

  it("splits Mains into smaller blocks, and lists Starters with headings", () => {
    expect(find(layout, "Mains")?.showAs).toBe("blocks");
    expect(names(find(layout, "Mains")?.children)).toEqual(["Pasta & risotto", "Pizza", "Meat & chicken", "Seafood", "Toasties & wraps"]);
    expect(find(layout, "Starters")?.showAs).toBe("list");
    expect(names(find(layout, "Starters")?.children)).toEqual(["Antipasti", "Salads"]);
  });

  it("hides breakfast from 12:00, mimosas from 13:00 and toasties from 16:00", () => {
    const at = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return servedNow(layout, h * 60 + m); };
    expect(names(at("11:59").groups[0].nodes)).toContain("Breakfast");
    expect(names(at("12:00").groups[0].nodes)).not.toContain("Breakfast");
    expect(names(find(at("13:00"), "Alcoholic", "Wine")?.children)).not.toContain("Mimosas");
    expect(names(find(at("15:59"), "Mains")?.children)).toContain("Toasties & wraps");
    expect(names(find(at("16:00"), "Mains")?.children)).not.toContain("Toasties & wraps");
  });

  it("reads the clock in Johannesburg", () => {
    expect(minutesNow("Africa/Johannesburg", new Date("2026-11-27T09:30:00Z"))).toBe(11 * 60 + 30);
  });
});
