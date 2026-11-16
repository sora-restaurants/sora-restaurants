/** Option groups. Food and drinks get different sets. */

export const NO_WANT = [
  "No onion", "No garlic", "No tomato", "No pickles", "No lettuce", "No cheese",
  "No mayo", "No sauce", "Sauce on the side", "No mushrooms", "No peppers", "No chilli",
];

export const SPICE = ["Mild", "Medium spice", "Hot", "Extra spicy"];

export const COOKING = ["Rare", "Medium-rare", "Medium", "Medium-well", "Well done"];

export const ADD_ONS: { label: string; cents: number }[] = [
  { label: "Extra hot sauce", cents: 1200 },
  { label: "Grilled onions", cents: 1500 },
  { label: "Jalapeño sauce", cents: 1200 },
  { label: "White cheese sauce", cents: 1800 },
  { label: "Extra cheese", cents: 1500 },
  { label: "Bacon", cents: 2000 },
  { label: "Avocado", cents: 1800 },
  { label: "Extra portion", cents: 2500 },
];

export const DRINK_SIZE = ["Small", "Medium", "Large"];

export const DRINK_ICE = ["Extra ice", "Normal ice", "No ice", "Ice on the side"];

export const DRINK_EXTRAS = ["No sugar", "Extra sugar", "Lemon", "No lemon", "Sparkling", "Still"];

/** Milk options for hot coffee drinks. */
export const COFFEE_MILK = ["Full cream", "Skim", "Oat milk", "Almond milk", "Soy milk", "No milk"];

export const COOL_DRINK_BRAND = ["Coca-Cola", "Pepsi", "Sprite", "Fanta"];
export const COOL_DRINK_TYPE = ["Can", "Bottle"];

const COOKABLE = /steak|burger|beef|lamb|wagyu|fillet|sirloin|ribeye|rump|mince|patty/i;
const NO_COOK = /chicken|fish|prawn|shrimp|salmon|tuna|tofu|veg|salad|soup|pasta|pizza|dessert|cake/i;

const DRINK = /drink|juice|soda|cola|coke|sprite|fanta|water|tea|coffee|latte|espresso|cappuccino|americano|mocha|beer|wine|cocktail|smoothie|shake|lemonade|iced|cooler|frappe|mocktail|gin|whisky|vodka|rum|cider|soft|beverage|bar|ale|lager|sparkling|still|flat white/i;
const COFFEE = /coffee|latte|espresso|cappuccino|americano|mocha|flat white|macchiato|frappe|hot chocolate|chai/i;
const HOT_DRINK = /hot|coffee|latte|espresso|cappuccino|americano|mocha|flat white|macchiato|tea|chai|hot chocolate/i;
const DRINK_CATEGORY = /drink|beverage|bar|wine|beer|cocktail|soft|juice|coffee|tea|hot|cold/i;

export function canChooseDoneness(name: string): boolean {
  if (NO_COOK.test(name)) return false;
  return COOKABLE.test(name);
}

export function isDrink(name: string, categoryName?: string): boolean {
  // Only items in drink categories get drink options
  return !!(categoryName && /hot drinks|cold drinks/i.test(categoryName));
}

export function isCoffee(name: string, categoryName?: string): boolean {
  if (categoryName && /hot/i.test(categoryName) && COFFEE.test(name)) return true;
  return COFFEE.test(name);
}

export function isHotDrink(name: string, categoryName?: string): boolean {
  if (categoryName && /hot drinks/i.test(categoryName)) return true;
  return /flat white|latte|cappuccino|espresso|hot chocolate|americano|mocha|chai/i.test(name);
}

export function addOnCost(notes: string[]): number {
  const priced = [...ADD_ONS, ...CHEESECAKE_SLICE, ...WATER_TYPE, ...STEAK_SIZE, ...WINGS_SIZE, ...FRIES_ADDONS];
  return notes.reduce((sum, n) => {
    const found = priced.find((a) => n.startsWith(a.label));
    return sum + (found?.cents ?? 0);
  }, 0);
}


export const CHEESECAKE_SLICE = [
  { label: "1 slice", cents: 0 },
  { label: "2 slices", cents: 8000 },
  { label: "Whole cake", cents: 28000 },
];
export const SMOOTHIE_FLAVOUR = ["Berry", "Mango", "Banana", "Mixed fruit", "Green"];
export const WATER_TYPE = [
  { label: "Tap water", cents: 0 },
  { label: "Bottled water", cents: 1500 },
  { label: "Sparkling water", cents: 3000 },
];
export const STEAK_SIZE = [
  { label: "250g", cents: 0 },
  { label: "300g", cents: 4000 },
  { label: "400g", cents: 9000 },
];
export const WINGS_SIZE = [
  { label: "6 wings", cents: 0 },
  { label: "8 wings", cents: 1000 },
  { label: "12 wings", cents: 3000 },
];
export const FRIES_SIZE = ["Small", "Medium", "Large"];
export const FRIES_ADDONS = [
  { label: "Cheese sauce", cents: 1500 },
  { label: "Bacon", cents: 2000 },
  { label: "Extra cheese", cents: 1000 },
];
