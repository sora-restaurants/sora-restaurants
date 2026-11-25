/** Shape returned by the get_table_menu SQL function. */
export type TableMenu = {
  restaurant: string;
  theme: string;
  /** customer_choice | pay_now_only | pay_later_only */
  paymentPolicy?: string;
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
  special?: string;
  allergens?: string[];
  prepTime?: string;
  soldOut?: boolean;
  /** Owner-set choices; when present they replace the built-in add-on list for this dish. */
  options?: { id: string; label: string; priceCents: number }[];
};
