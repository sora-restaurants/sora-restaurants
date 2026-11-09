/** Shape returned by the get_table_menu SQL function. */
export type TableMenu = {
  restaurant: string;
  theme: string;
  table: string;
  categories: { id: string; name: string; items: MenuItem[] }[];
};

export type MenuItem = { id: string; name: string; description: string; priceCents: number };
