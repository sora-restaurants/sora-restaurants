import type { ManagedTable, OwnerDashboardSnapshot, SessionCommandResult, TableSessionAdapter } from "./session-contract.ts";

const INITIAL_TABLES: ManagedTable[] = [
  { id: "table-1", label: "Table 1", enabled: true, sessionState: "open", openedAt: "2026-11-10T10:25:00+02:00", qrUrl: "https://demo.sora.rest/t/table-1" },
  { id: "table-2", label: "Table 2", enabled: true, sessionState: "closed", openedAt: null, qrUrl: "https://demo.sora.rest/t/table-2" },
  { id: "table-3", label: "Patio 3", enabled: false, sessionState: "closed", openedAt: null, qrUrl: "https://demo.sora.rest/t/patio-3" },
];

export function createMockSessionAdapter(seed = INITIAL_TABLES): TableSessionAdapter {
  let tables = seed.map((table) => ({ ...table }));

  const update = (tableId: string, next: "open" | "closed"): SessionCommandResult => {
    const table = tables.find((candidate) => candidate.id === tableId);
    if (!table || !table.enabled) return { ok: false, code: "TABLE_DISABLED" };
    if (table.sessionState === next) return { ok: false, code: next === "open" ? "SESSION_ALREADY_OPEN" : "SESSION_ALREADY_CLOSED" };
    const changed = { ...table, sessionState: next, openedAt: next === "open" ? new Date().toISOString() : null };
    tables = tables.map((candidate) => candidate.id === tableId ? changed : candidate);
    return { ok: true, table: changed };
  };

  return {
    async getSnapshot(): Promise<OwnerDashboardSnapshot> {
      return {
        restaurantName: "Sora Test Kitchen",
        timezone: "Africa/Johannesburg",
        acceptedOrderValueCents: 284_550,
        tables: tables.map((table) => ({ ...table })),
        menu: [],
      };
    },
    async openSession(tableId) { return update(tableId, "open"); },
    async closeSession(tableId) { return update(tableId, "closed"); },
  };
}

