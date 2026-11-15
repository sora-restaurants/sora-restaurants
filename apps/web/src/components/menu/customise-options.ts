/** Option groups. Food and drinks get different sets. */

export const DIETARY = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Shellfish-free",
  "Halal", "Kosher", "Low-carb", "Keto", "No onion", "No garlic", "Sauce on the side",
];

export const SPICE = ["Mild", "Medium spice", "Hot", "Extra spicy"];

export const COOKING = ["Rare", "Medium-rare", "Medium", "Medium-well", "Well done"];

export const DRINK_SIZE = ["Small", "Medium", "Large"];

export const DRINK_ICE = ["Extra ice", "Normal ice", "No ice", "Ice on the side"];

export const DRINK_EXTRAS = ["No sugar", "Extra sugar", "Lemon", "No lemon", "Sparkling", "Still"];

const COOKABLE = /steak|burger|beef|lamb|wagyu|fillet|sirloin|ribeye|rump|mince|patty/i;
const NO_COOK = /chicken|fish|prawn|shrimp|salmon|tuna|tofu|veg|salad|soup|pasta|pizza|dessert|cake/i;

const DRINK = /drink|juice|soda|cola|coke|sprite|water|tea|coffee|latte|espresso|cappuccino|beer|wine|cocktail|smoothie|shake|lemonade|iced/i;
const COFFEE = /coffee|latte|espresso|cappuccino|americano|mocha|flat white|macchiato/i;

export function canChooseDoneness(name: string): boolean {
  if (NO_COOK.test(name)) return false;
  return COOKABLE.test(name);
}

export function isDrink(name: string): boolean {
  return DRINK.test(name);
}

export function isCoffee(name: string): boolean {
  return COFFEE.test(name);
}
