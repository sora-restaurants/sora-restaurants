/** Full demo menu with matching pictures, specials, allergens and prep times. */

import type { TableMenu } from "./types.ts";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export const DEMO_MENU: TableMenu = {
  restaurant: "Sora",
  theme: "sora",
  table: "Table 1",
  categories: [
    {
      id: "starters",
      name: "Starters",
      items: [
        { id: "d-bruschetta", name: "Tomato Bruschetta", description: "Toasted sourdough, ripe tomatoes, basil, olive oil.", priceCents: 8500, imageUrl: img("photo-1506280754576-f6fa8a873550"), dietaryTags: ["Vegetarian", "Vegan"], prepTime: "8 min" },
        { id: "d-calamari", name: "Crispy Calamari", description: "Lightly battered squid with lemon aioli.", priceCents: 12000, imageUrl: img("photo-1565680018434-b513d5e5fd47"), dietaryTags: [], allergens: ["Shellfish", "Gluten"], prepTime: "12 min" },
        { id: "d-spring-rolls", name: "Vegetable Spring Rolls", description: "Crisp rolls with sweet chilli dip.", priceCents: 9000, imageUrl: img("photo-1565680018434-b513d5e5fd47"), dietaryTags: ["Vegetarian", "Vegan"], prepTime: "10 min" },
        { id: "d-chicken-wings", name: "Peri-Peri Wings", description: "Six wings with extra hot peri-peri sauce.", priceCents: 11000, imageUrl: img("photo-1527477396000-e27163b481c2"), dietaryTags: ["Gluten-free"], prepTime: "15 min" },
      ],
    },
    {
      id: "mains",
      name: "Mains",
      items: [
        { id: "d-ribeye", name: "Ribeye Steak", description: "300g grain-fed ribeye, herb butter, chips.", priceCents: 28500, imageUrl: img("photo-1558030006-450675393462"), dietaryTags: ["Gluten-free"], special: "Chef's special", allergens: ["Dairy"], prepTime: "22 min" },
        { id: "d-burger", name: "Sora Smash Burger", description: "Double beef patty, cheese, pickles, special sauce.", priceCents: 16500, imageUrl: img("photo-1568901346375-23c9450c58cd"), dietaryTags: [], allergens: ["Gluten", "Dairy"], prepTime: "16 min" },
        { id: "d-grilled-chicken", name: "Grilled Chicken Breast", description: "Herb-marinated chicken, seasonal vegetables.", priceCents: 17500, imageUrl: img("photo-1532550907401-a500c9a57435"), dietaryTags: ["Gluten-free", "Dairy-free"], prepTime: "18 min" },
        { id: "d-salmon", name: "Pan-Seared Salmon", description: "Atlantic salmon, lemon butter, greens.", priceCents: 24500, imageUrl: img("photo-1467003909585-2f8a72700288"), dietaryTags: ["Gluten-free"], special: "Today's special", allergens: ["Fish"], prepTime: "20 min" },
        { id: "d-pasta", name: "Tomato Basil Pasta", description: "Fresh pasta in a slow-cooked tomato sauce.", priceCents: 14500, imageUrl: img("photo-1473093295043-cdd812d0e601"), dietaryTags: ["Vegetarian"], allergens: ["Gluten"], prepTime: "14 min" },
        { id: "d-veggie-bowl", name: "Garden Veggie Bowl", description: "Quinoa, roasted vegetables, tahini dressing.", priceCents: 13500, imageUrl: img("photo-1512621776951-a57141f2eefd"), dietaryTags: ["Vegetarian", "Vegan", "Gluten-free"], prepTime: "12 min" },
      ],
    },
    {
      id: "sides",
      name: "Sides",
      items: [
        { id: "d-fries", name: "Skinny Fries", description: "Crisp fries with sea salt.", priceCents: 4500, imageUrl: img("photo-1573080496219-bb080dd4f877"), dietaryTags: ["Vegetarian", "Vegan"], prepTime: "8 min" },
        { id: "d-salad", name: "Garden Salad", description: "Mixed leaves, cucumber, tomato, vinaigrette.", priceCents: 5500, imageUrl: img("photo-1546793665-c74683f339c1"), dietaryTags: ["Vegetarian", "Vegan", "Gluten-free"], prepTime: "5 min" },
        { id: "d-mac", name: "Mac & Cheese", description: "Creamy three-cheese macaroni.", priceCents: 7500, imageUrl: img("photo-1543339494-b4cd4f7ba686"), dietaryTags: ["Vegetarian"], allergens: ["Gluten", "Dairy"], prepTime: "10 min" },
      ],
    },
    {
      id: "desserts",
      name: "Desserts",
      items: [
        { id: "d-brownie", name: "Chocolate Brownie", description: "Warm brownie with vanilla ice cream.", priceCents: 8500, imageUrl: img("photo-1606313564200-e75d5e30476c"), dietaryTags: ["Vegetarian"], allergens: ["Gluten", "Dairy", "Nuts"], prepTime: "5 min" },
        { id: "d-cheesecake", name: "New York Cheesecake", description: "Classic baked cheesecake, berry coulis.", priceCents: 9500, imageUrl: img("photo-1578985545062-69928b1d9587"), dietaryTags: ["Vegetarian"], allergens: ["Gluten", "Dairy"], prepTime: "5 min" },
      ],
    },
    {
      id: "hot-drinks",
      name: "Hot Drinks",
      items: [
        { id: "d-flat-white", name: "Flat White", description: "Double espresso with steamed milk.", priceCents: 4200, imageUrl: img("photo-1572442388796-11668a67e53d"), dietaryTags: ["Vegetarian"], allergens: ["Dairy"], prepTime: "4 min" },
        { id: "d-latte", name: "Cafe Latte", description: "Espresso with a silky milk foam.", priceCents: 4500, imageUrl: img("photo-1461023058943-07fcbe16d735"), dietaryTags: ["Vegetarian"], allergens: ["Dairy"], prepTime: "4 min" },
        { id: "d-cappuccino", name: "Cappuccino", description: "Equal parts espresso, steamed milk and foam.", priceCents: 4500, imageUrl: img("photo-1534778101976-62847782c213"), dietaryTags: ["Vegetarian"], allergens: ["Dairy"], prepTime: "4 min" },
        { id: "d-espresso", name: "Espresso", description: "A short, strong shot.", priceCents: 2800, imageUrl: img("photo-1510591509098-f4fdc6d0ff04"), dietaryTags: ["Vegan"], prepTime: "2 min" },
        { id: "d-hot-chocolate", name: "Hot Chocolate", description: "Rich cocoa with steamed milk.", priceCents: 4800, imageUrl: img("photo-1542990253-0d0f5be5f0ed"), dietaryTags: ["Vegetarian"], allergens: ["Dairy"], prepTime: "5 min" },
      ],
    },
    {
      id: "cold-drinks",
      name: "Cold Drinks",
      items: [
        { id: "d-cool-drink", name: "Cool Drink", description: "Choose your brand and can or bottle.", priceCents: 3500, imageUrl: img("photo-1629203851122-3726ecdf080e"), dietaryTags: ["Vegan"], prepTime: "2 min" },
        { id: "d-lemonade", name: "Fresh Lemonade", description: "House-made with mint.", priceCents: 4000, imageUrl: img("photo-1621263764928-df1444c5e859"), dietaryTags: ["Vegetarian", "Vegan"], prepTime: "3 min" },
        { id: "d-smoothie", name: "Smoothie", description: "Pick your flavour.", priceCents: 5500, imageUrl: img("photo-1505252585461-04db1eb84625"), dietaryTags: ["Vegetarian", "Vegan", "Dairy-free"], allergens: ["Nuts"], prepTime: "4 min" },
        { id: "d-iced-tea", name: "Iced Tea", description: "Chilled black tea with lemon.", priceCents: 3800, imageUrl: img("photo-1556679343-c7306c1976bc"), dietaryTags: ["Vegan"], prepTime: "2 min" },
        { id: "d-water", name: "Water", description: "Tap (free), bottled or sparkling.", priceCents: 0, imageUrl: img("photo-1548839140-29a749e1cf4d"), dietaryTags: ["Vegan"], prepTime: "1 min" },
      ],
    },
  ],
};
