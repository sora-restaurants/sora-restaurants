export type TableSessionState = "open" | "closed";

export type ManagedTable = {
  id: string;
  label: string;
  enabled: boolean;
  sessionState: TableSessionState;
  openedAt: string | null;
  qrUrl: string;
};

export type OwnerDashboardSnapshot = {
  restaurantName: string;
  timezone: string;
  acceptedOrderValueCents: number;
  tables: ManagedTable[];
};

export type SessionCommandResult =
  | { ok: true; table: ManagedTable }
  | { ok: false; code: "TABLE_DISABLED" | "SESSION_ALREADY_OPEN" | "SESSION_ALREADY_CLOSED" };

export interface TableSessionAdapter {
  getSnapshot(): Promise<OwnerDashboardSnapshot>;
  openSession(tableId: string): Promise<SessionCommandResult>;
  closeSession(tableId: string): Promise<SessionCommandResult>;
}

