/** Full demo menu with pictures and dietary tags. */

import type { TableMenu } from "./types.ts";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export const DEMO_MENU: TableMenu = {
  theme: "sora",
  restaurant: "Sora",
  table: "Table 1",
  categories: [
    {
      id: "starters",
      name: "Starters",
      items: [
        { id: "d-bruschetta", name: "Tomato Bruschetta", description: "Toasted sourdough, ripe tomatoes, basil, olive oil.", priceCents: 8500, imageUrl: img("photo-1572695157366-5e585ab2b69f"), dietaryTags: ["Vegetarian", "Vegan"] },
        { id: "d-calamari", name: "Crispy Calamari", description: "Lightly battered squid with lemon aioli.", priceCents: 12000, imageUrl: img("photo-1599487488170-d11ec9c172f0"), dietaryTags: [] },
        { id: "d-spring-rolls", name: "Vegetable Spring Rolls", description: "Crisp rolls with sweet chilli dip.", priceCents: 9000, imageUrl: img("photo-1626700051175-6818013e1d4f"), dietaryTags: ["Vegetarian", "Vegan"] },
        { id: "d-chicken-wings", name: "Peri-Peri Wings", description: "Six wings with extra hot peri-peri sauce.", priceCents: 11000, imageUrl: img("photo-1608039829572-78524f79c4c7"), dietaryTags: ["Gluten-free"] },
      ],
    },
    {
      id: "mains",
      name: "Mains",
      items: [
        { id: "d-ribeye", name: "Ribeye Steak", description: "300g grain-fed ribeye, herb butter, chips.", priceCents: 28500, imageUrl: img("photo-1558030006-450675393462"), dietaryTags: ["Gluten-free"] },
        { id: "d-burger", name: "Sora Smash Burger", description: "Double beef patty, cheese, pickles, special sauce.", priceCents: 16500, imageUrl: img("photo-1568901346375-23c9450c58cd"), dietaryTags: [] },
        { id: "d-grilled-chicken", name: "Grilled Chicken Breast", description: "Herb-marinated chicken, seasonal vegetables.", priceCents: 17500, imageUrl: img("photo-1532550907401-a500c9a57435"), dietaryTags: ["Gluten-free", "Dairy-free"] },
        { id: "d-salmon", name: "Pan-Seared Salmon", description: "Atlantic salmon, lemon butter, greens.", priceCents: 24500, imageUrl: img("photo-1467003909585-2f8a72700288"), dietaryTags: ["Gluten-free"] },
        { id: "d-pasta", name: "Tomato Basil Pasta", description: "Fresh pasta in a slow-cooked tomato sauce.", priceCents: 14500, imageUrl: img("photo-1621996346565-e3dbc646d9a9"), dietaryTags: ["Vegetarian"] },
        { id: "d-veggie-bowl", name: "Garden Veggie Bowl", description: "Quinoa, roasted vegetables, tahini dressing.", priceCents: 13500, imageUrl: img("photo-1512621776951-a57141f2eefd"), dietaryTags: ["Vegetarian", "Vegan", "Gluten-free"] },
      ],
    },
    {
      id: "sides",
      name: "Sides",
      items: [
        { id: "d-fries", name: "Skinny Fries", description: "Crisp fries with sea salt.", priceCents: 4500, imageUrl: img("photo-1573080496219-bb080dd4f877"), dietaryTags: ["Vegetarian", "Vegan"] },
        { id: "d-salad", name: "Garden Salad", description: "Mixed leaves, cucumber, tomato, vinaigrette.", priceCents: 5500, imageUrl: img("photo-1546793665-c74683f339c1"), dietaryTags: ["Vegetarian", "Vegan", "Gluten-free"] },
        { id: "d-mac", name: "Mac & Cheese", description: "Creamy three-cheese macaroni.", priceCents: 7500, imageUrl: img("photo-1543339494-b4cd4f7ba686"), dietaryTags: ["Vegetarian"] },
      ],
    },
    {
      id: "desserts",
      name: "Desserts",
      items: [
        { id: "d-brownie", name: "Chocolate Brownie", description: "Warm brownie with vanilla ice cream.", priceCents: 8500, imageUrl: img("photo-1606313564200-e75d5e30476c"), dietaryTags: ["Vegetarian"] },
        { id: "d-cheesecake", name: "New York Cheesecake", description: "Classic baked cheesecake, berry coulis.", priceCents: 9500, imageUrl: img("photo-1533134486753-c833f0ed4866"), dietaryTags: ["Vegetarian"] },
      ],
    },
    {
      id: "drinks",
      name: "Drinks",
      items: [
        { id: "d-coke", name: "Coca-Cola", description: "Ice-cold classic.", priceCents: 3500, imageUrl: img("photo-1629203851122-3726ecdf080e"), dietaryTags: ["Vegan"] },
        { id: "d-lemonade", name: "Fresh Lemonade", description: "House-made with mint.", priceCents: 4000, imageUrl: img("photo-1621263764928-df1444c5e859"), dietaryTags: ["Vegetarian", "Vegan"] },
        { id: "d-latte", name: "Flat White", description: "Double espresso with steamed milk.", priceCents: 4200, imageUrl: img("photo-1572442388796-11668a67e53d"), dietaryTags: ["Vegetarian"] },
        { id: "d-smoothie", name: "Berry Smoothie", description: "Mixed berries, banana, almond milk.", priceCents: 5500, imageUrl: img("photo-1505252585461-04db1eb84625"), dietaryTags: ["Vegetarian", "Vegan", "Dairy-free"] },
      ],
    },
  ],
};
