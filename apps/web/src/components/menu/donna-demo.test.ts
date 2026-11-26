import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Menu } from "./Menu.tsx";
import { matchesFilter, matchesQuery, requiredGroups } from "./donna-demo.ts";

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
