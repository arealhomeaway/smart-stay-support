/**
 * In-memory stand-in for the single table the mailbox intake code writes to
 * (`integration_events`). Implements only the builder surface that
 * mailbox.server.ts calls: insert (array) / select+eq+in+order+limit /
 * update+eq+in.
 *
 * It enforces the same uniqueness the prepared migration adds — one row per
 * (system, operation, external_id) — so the concurrency test exercises the
 * real 23505 code path rather than a test-only shortcut. This is an
 * approximation of Postgres, not Postgres: it proves the application reacts
 * correctly to a conflict, not that Postgres will serialise two real
 * concurrent transactions (that needs the index actually applied).
 */

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "in" | "notNull"; value: unknown };

function matches(row: Row, f: Filter) {
  if (f.op === "eq") return row[f.col] === f.value;
  if (f.op === "notNull") return row[f.col] !== null && row[f.col] !== undefined;
  return Array.isArray(f.value) && f.value.includes(row[f.col]);
}

export function createFakeIntegrationEvents() {
  const state = { rows: [] as Row[], nextId: 1, uniqueEnforced: true };
  const touchedTables = new Set<string>();

  function insertMany(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload];
    if (state.uniqueEnforced) {
      for (const r of rows) {
        const clash = state.rows.some(
          (e) =>
            e["system"] === r["system"] &&
            e["operation"] === r["operation"] &&
            e["external_id"] === r["external_id"],
        );
        if (clash) return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
    }
    const stamped = rows.map((r) => ({
      id: String(state.nextId++),
      created_at: new Date().toISOString(),
      entity_id: null,
      entity_type: null,
      error_message: null,
      ...r,
    }));
    state.rows.push(...stamped);
    return { data: stamped, error: null };
  }

  function builder(table: string) {
    touchedTables.add(table);
    const filters: Filter[] = [];
    let order: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;
    let patch: Row | null = null;

    function selected() {
      let out = state.rows.filter((r) => filters.every((f) => matches(r, f)));
      if (order) {
        const { col, ascending } = order;
        out = [...out].sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          if (av === bv) return 0;
          return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
        });
      }
      if (limitN != null) out = out.slice(0, limitN);
      return out;
    }

    const api: Record<string, unknown> = {
      insert: (payload: Row | Row[]) => Promise.resolve(insertMany(payload)),
      select: () => api,
      update: (p: Row) => {
        patch = p;
        return api;
      },
      eq: (col: string, value: unknown) => {
        filters.push({ col, op: "eq", value });
        return finish(col, value);
      },
      in: (col: string, value: unknown) => {
        filters.push({ col, op: "in", value });
        return finish(col, value);
      },
      // Only `.not(col, "is", null)` is used by the intake code.
      not: (col: string, _op: string, _value: unknown) => {
        filters.push({ col, op: "notNull", value: null });
        return api;
      },
      maybeSingle: () => Promise.resolve({ data: selected()[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: selected()[0] ?? null, error: null }),
      order: (col: string, opts?: { ascending?: boolean }) => {
        order = { col, ascending: opts?.ascending ?? true };
        return api;
      },
      limit: (n: number) => {
        limitN = n;
        return Promise.resolve({ data: selected(), error: null });
      },
    };

    // Filters can be the last call in an update chain, so every filter returns
    // a thenable: awaiting applies the patch, chaining keeps filtering.
    function finish(_col: string, _value: unknown) {
      if (!patch) return api;
      const chainable = {
        ...api,
        then: (resolve: (v: { data: null; error: null }) => unknown) => {
          const hit = new Set(selected().map((r) => r["id"]));
          state.rows = state.rows.map((r) => (hit.has(r["id"]) ? { ...r, ...patch } : r));
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return chainable;
    }

    return api;
  }

  return {
    db: { from: (table: string) => builder(table) } as never,
    rows: () => state.rows,
    reset: () => {
      state.rows = [];
      state.nextId = 1;
      state.uniqueEnforced = true;
      touchedTables.clear();
    },
    /** Simulates the database BEFORE the unique index is approved and applied. */
    withoutUniqueIndex: () => {
      state.uniqueEnforced = false;
    },
    touchedTables,
  };
}
