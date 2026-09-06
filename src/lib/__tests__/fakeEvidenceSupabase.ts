/**
 * In-memory stand-in for the tables `evidence.server.ts`'s exception path
 * touches (`evidence_items`, `evidence_requirements`, `evidence_events`,
 * `ticket_activity`), used only in tests via `mock.module`.
 *
 * Narrow on purpose: it only supports the query shapes `acceptWithException`
 * and `refreshRequirementStatus` actually issue, not a general Supabase
 * stand-in. It is an approximation of Postgres, not proof Postgres enforces
 * anything.
 */
type Row = Record<string, unknown>;

export function createFakeEvidenceStore() {
  const state = {
    evidenceItems: [] as Row[],
    evidenceRequirements: [] as Row[],
    evidenceEvents: [] as Row[],
    ticketActivity: [] as Row[],
    auditLog: [] as Row[],
    nextId: 1,
  };

  function tableRows(table: string): Row[] {
    if (table === "evidence_items") return state.evidenceItems;
    if (table === "evidence_requirements") return state.evidenceRequirements;
    if (table === "evidence_events") return state.evidenceEvents;
    if (table === "ticket_activity") return state.ticketActivity;
    // writeAudit() lands here too, via the same mocked client — not the
    // subject of this test, just needs somewhere to write.
    if (table === "audit_log") return state.auditLog;
    throw new Error(`Unexpected table in test: ${table}`);
  }

  function builder(table: string) {
    type F = { col: string; op: "eq"; value: unknown };
    const filters: F[] = [];
    const match = (r: Row) => filters.every((f) => r[f.col] === f.value);
    let pendingUpdate: Row | null = null;

    function selected() {
      return tableRows(table).filter(match);
    }

    const api = {
      insert: (payload: Row) => {
        const row: Row = {
          id: `row-${state.nextId++}`,
          created_at: new Date().toISOString(),
          ...payload,
        };
        tableRows(table).push(row);
        const result = { data: row, error: null };
        const chain = {
          select: () => chain,
          single: () => Promise.resolve(result),
          then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
        };
        return chain;
      },
      update: (patch: Row) => {
        pendingUpdate = patch;
        return api;
      },
      select: (_cols?: string) => api,
      eq: (col: string, value: unknown) => {
        filters.push({ col, op: "eq", value });
        if (pendingUpdate) {
          const patch = pendingUpdate;
          pendingUpdate = null;
          let updated: Row | null = null;
          const rows = tableRows(table);
          for (let i = 0; i < rows.length; i++) {
            if (match(rows[i]!)) {
              updated = { ...rows[i]!, ...patch };
              rows[i] = updated;
            }
          }
          const result = { data: updated, error: null };
          const chain = {
            select: () => chain,
            single: () => Promise.resolve(result),
            then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
          };
          return chain as unknown as typeof api;
        }
        return api;
      },
      order: () => api,
      maybeSingle: () => Promise.resolve({ data: selected()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: selected()[0] ?? null, error: null }),
      then: (res: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: selected(), error: null }).then(res),
    };
    return api;
  }

  return {
    supabaseAdmin: { from: (table: string) => builder(table) },
    state,
    ticketActivity: () => state.ticketActivity,
    evidenceRequirements: () => state.evidenceRequirements,
    evidenceItems: () => state.evidenceItems,
    reset: () => {
      state.evidenceItems = [];
      state.evidenceRequirements = [];
      state.evidenceEvents = [];
      state.ticketActivity = [];
      state.auditLog = [];
      state.nextId = 1;
    },
  };
}
