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
  timezone: string;
  acceptedOrderValueCents: number;
  tables: ManagedTable[];
  menu: OwnerMenuCategory[];
};

export type OwnerMenuItem = { id: string; name: string; description: string; priceCents: number; imageUrl: string | null; dietaryTags: string[]; available: boolean; soldOut: boolean };
export type OwnerMenuCategory = { id: string; name: string; items: OwnerMenuItem[] };

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
}

