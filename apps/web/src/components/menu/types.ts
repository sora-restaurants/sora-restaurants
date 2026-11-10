/** Shape returned by the get_table_menu SQL function. */
export type TableMenu = {
  restaurant: string;
  theme: string;
  table: string;
  orderingEnabled?: boolean;
  categories: { id: string; name: string; items: MenuItem[] }[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl?: string | null;
  dietaryTags?: string[];
  soldOut?: boolean;
};
