/** Option groups for dish customisation. Cooking doneness only for items that can take it. */

export const DIETARY = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Shellfish-free",
  "Halal", "Kosher", "Low-carb", "Keto", "No onion", "No garlic", "Sauce on the side",
];

export const SPICE = ["Mild", "Medium spice", "Hot", "Extra spicy"];

export const COOKING = ["Rare", "Medium-rare", "Medium", "Medium-well", "Well done"];

const COOKABLE = /steak|burger|beef|lamb|wagyu|fillet|sirloin|ribeye|rump|mince|patty/i;
const NO_COOK = /chicken|fish|prawn|shrimp|salmon|tuna|tofu|veg|salad|soup|pasta|pizza|dessert|cake/i;

export function canChooseDoneness(name: string): boolean {
  if (NO_COOK.test(name)) return false;
  return COOKABLE.test(name);
}
