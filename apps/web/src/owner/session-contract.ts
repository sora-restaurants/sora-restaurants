export type TableSessionState = "open" | "closed";

export type ManagedTable = {
  id: string;
  label: string;
  enabled: boolean;
  sessionState: TableSessionState;
  openedAt: string | null;
  qrUrl: string;
  qrImageSrc?: string;
};

export type OwnerDashboardSnapshot = {
  restaurantId?: string;
  restaurantName: string;
  role?: string;
  restaurants?: { id: string; name: string }[];
  staff?: { id: string; email: string | null; role: string; status: string }[];
  timezone: string;
  acceptedOrderValueCents: number;
  paidTodayCents: number;
  orders: { id: string; publicRef: string; table: string; status: string; totalCents: number; paymentStatus: string; createdAt: string }[];
  tables: ManagedTable[];
  menu: OwnerMenuCategory[];
};

export type OwnerMenuOption = { id: string; label: string; priceCents: number };
export type OwnerMenuItem = { id: string; name: string; description: string; priceCents: number; imageUrl: string | null; dietaryTags: string[]; allergens?: string[]; options?: OwnerMenuOption[]; available: boolean; soldOut: boolean };
export type OwnerMenuCategory = { id: string; name: string; station?: "kitchen" | "bar"; items: OwnerMenuItem[] };

export type OwnerReport = {
  from: string;
  to: string;
  days: { day: string; orders: number; totalCents: number; tipCents: number; paidCents: number }[];
  topItems: { name: string; quantity: number; totalCents: number }[];
};

/** QR orders only (every order is a QR order); value excludes tips, cancelled and rejected orders. */
export type OwnerStats = {
  period: "today" | "7d" | "30d";
  orders: number;
  valueCents: number;
  /** Tips on those orders, kept apart from the order value. */
  tipCents: number;
  /** Per hour ("17:00") for today, per day ("2026-11-25") for 7 and 30 days. */
  series: { label: string; orders: number }[];
  topItems: { name: string; quantity: number }[];
  byTable: { table: string; orders: number; valueCents: number; tipCents: number }[];
};

export type SessionCommandResult =
  | { ok: true; table: ManagedTable }
  | { ok: false; code: "TABLE_DISABLED" | "SESSION_ALREADY_OPEN" | "SESSION_ALREADY_CLOSED" };

export interface TableSessionAdapter {
  getSnapshot(): Promise<OwnerDashboardSnapshot>;
  openSession(tableId: string): Promise<SessionCommandResult>;
  closeSession(tableId: string): Promise<SessionCommandResult>;
  rotateQr?(tableId: string): Promise<OwnerDashboardSnapshot>;
  createTable?(label: string): Promise<OwnerDashboardSnapshot>;
  updateItem?(item: OwnerMenuItem): Promise<OwnerDashboardSnapshot>;
  createItem?(menuId: string, name: string, priceCents: number): Promise<OwnerDashboardSnapshot>;
  createCategory?(name: string): Promise<OwnerDashboardSnapshot>;
  /** Any other owner command (options, station, staff); returns the refreshed snapshot. */
  command?(body: object): Promise<OwnerDashboardSnapshot>;
  report?(from: string, to: string): Promise<OwnerReport>;
  stats?(period: OwnerStats["period"]): Promise<OwnerStats>;
}

