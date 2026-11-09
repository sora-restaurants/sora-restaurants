import { notFound } from "next/navigation";
import { Menu } from "../../../components/menu/Menu.tsx";
import type { TableMenu } from "../../../components/menu/types.ts";
import { THEME_IDS, type ThemeId } from "../../../themes/themes.ts";

// Design preview with sample menus, so the themes can be judged without a database. Never served in production.
export const dynamic = "force-dynamic";

const item = (id: number, name: string, description: string, priceCents: number) => ({
  id: `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`,
  name,
  description,
  priceCents,
});

const SAMPLES: Record<ThemeId, TableMenu> = {
  "luxury-minimal": {
    restaurant: "Stellenbosch Winery",
    theme: "luxury-minimal",
    table: "Terrace 3",
    categories: [
      {
        id: "starters",
        name: "To begin",
        items: [
          item(1, "Snoek pâté", "Smoked snoek, apricot preserve, toasted seed loaf", 14500),
          item(2, "Springbok carpaccio", "Pickled shimeji, wild rocket, aged Dalewood cheese", 18500),
        ],
      },
      {
        id: "wine",
        name: "By the glass",
        items: [
          item(3, "Chenin Blanc 2024", "Old bush vines, stone fruit, a little honey", 9500),
          item(4, "Cabernet Sauvignon 2021", "Cassis, cedar, eighteen months in French oak", 12500),
        ],
      },
    ],
  },
  "fast-casual-vibrant": {
    restaurant: "Bree Street Roasters",
    theme: "fast-casual-vibrant",
    table: "Counter 2",
    categories: [
      {
        id: "coffee",
        name: "Coffee",
        items: [
          item(11, "Flat white", "Double shot, house blend", 3800),
          item(12, "Red cappuccino", "Rooibos espresso, steamed milk", 4200),
          item(13, "Cold brew", "Steeped 18 hours, over ice", 4500),
        ],
      },
      {
        id: "food",
        name: "Food",
        items: [
          item(14, "Toasted chicken mayo", "Sourdough, free-range chicken, chives", 8900),
          item(15, "Koeksister croissant", "Spiced syrup, coconut", 4800),
        ],
      },
    ],
  },
  "rustic-traditional": {
    restaurant: "Braai Spot Johannesburg",
    theme: "rustic-traditional",
    table: "Table 4",
    categories: [
      {
        id: "braai",
        name: "Off the coals",
        items: [
          item(21, "Boerewors roll", "With chakalaka", 8900),
          item(22, "Lamb chops", "Three chops, rosemary salt", 21000),
          item(23, "Sosaties", "Apricot curry glaze, two skewers", 14500),
          item(24, "Braaibroodjie", "Cheese, tomato, onion, toasted on the grid", 6500),
        ],
      },
      {
        id: "sides",
        name: "Sides",
        items: [
          item(25, "Pap and sous", "Stywe pap, tomato and onion relish", 4500),
          item(26, "Bunny chow", "Quarter loaf, mutton curry", 12500),
        ],
      },
    ],
  },
};

export default async function ThemePreview({ params }: { params: Promise<{ theme: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { theme } = await params;
  if (!THEME_IDS.includes(theme as ThemeId)) notFound();
  return <Menu menu={SAMPLES[theme as ThemeId]} theme={theme as ThemeId} qrToken="preview" preview />;
}
