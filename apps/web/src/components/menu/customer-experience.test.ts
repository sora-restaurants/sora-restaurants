import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TableMenuLoading from "../../app/t/[token]/loading.tsx";
import TableMenuNotFound from "../../app/t/[token]/not-found.tsx";
import { Menu } from "./Menu.tsx";

const demoMenu = {
  restaurant: "Sora Test Kitchen",
  table: "Table 7",
  theme: "fast-casual-vibrant",
  categories: [
    {
      id: "mains",
      name: "Mains",
      items: [{ id: "burger", name: "Sora Burger", description: "Flame grilled", priceCents: 12_500 }],
    },
  ],
};

describe("customer ordering experience", () => {
  it("renders the restaurant, category, price and accessible basket action", () => {
    const html = renderToStaticMarkup(createElement(Menu, { menu: demoMenu, theme: "fast-casual-vibrant", qrToken: "preview-token", preview: true }));

    expect(html).toContain("Sora Test Kitchen");
    expect(html).toContain("Mains");
    expect(html).toContain("Sora Burger");
    expect(html).toContain("R 125,00");
    expect(html).toContain('aria-label="Add Sora Burger"');
  });

  it("provides a meaningful loading state for slow mobile connections", () => {
    const html = renderToStaticMarkup(createElement(TableMenuLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading the menu");
  });

  it("explains an inactive table QR code without exposing technical details", () => {
    const html = renderToStaticMarkup(createElement(TableMenuNotFound));

    expect(html).toContain("QR code not active");
    expect(html).toContain("ask a member of staff");
  });

  it("handles a temporarily empty restaurant menu", () => {
    const html = renderToStaticMarkup(createElement(Menu, { menu: { ...demoMenu, categories: [] }, theme: "fast-casual-vibrant", qrToken: "preview-token", preview: true }));

    expect(html).toContain("The menu is being updated");
    expect(html).toContain("no dishes available");
  });
});
