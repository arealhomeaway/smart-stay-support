/**
 * Minimal in-memory stand-in for the one table the Breezeway webhook code
 * touches (`breezeway_webhook_events`), used only in tests via
 * `mock.module("@/integrations/supabase/client.server", ...)`.
 *
 * Implements just enough of the supabase-js query builder surface that
 * breezeway-webhook.server.ts and breezeway-webhook-recovery.server.ts
 * actually call: insert / select+eq+is+lt+order+limit(+maybeSingle) /
 * update+eq / delete+eq. It also enforces the same unique constraint the
 * prepared migration adds — one `processed` row per (task_id,
 * task_updated_at, is_fixture) — so the concurrency test exercises the real
 * code path, not a test-only shortcut.
 *
 * This is an in-memory approximation, not Postgres. It proves the
 * application code reacts correctly to a 23505 conflict and to an arbitrary
 * insert failure (via `failNextInsert`); it does NOT prove Postgres itself
 * will enforce the unique index as intended under real concurrent
 * transactions — that requires a real Postgres instance (see
 * TEST_RESULTS.txt / the PR notes for what remains unverified).
 */

type Row = Record<string, unknown>;

type Filter = { col: string; op: "eq" | "is" | "lt"; value: unknown };

function applyFilter(row: Row, f: Filter): boolean {
  const v = row[f.col];
  if (f.op === "eq") return v === f.value;
  if (f.op === "is") return f.value === null ? v == null : v === f.value;
  if (f.op === "lt") return typeof v === "number" && typeof f.value === "number" && v < f.value;
  return true;
}

export function createFakeBreezewayEventsStore() {
  const state = {
    rows: [] as Row[],
    nextId: 1,
    insertFailures: [] as { code?: string; message: string }[],
  };
  /** Every table name any query touched, for asserting "no writes elsewhere". */
  const touchedTables = new Set<string>();

  function insert(payload: Row) {
    const forced = state.insertFailures.shift();
    if (forced) {
      return { data: null, error: forced };
    }
    if (payload["outcome"] === "processed") {
      // Mirrors the migration's unique index exactly: (task_id,
      // task_updated_at, is_fixture) WHERE outcome = 'processed'. is_fixture
      // is part of the key so a fixture-mode row can never collide with a
      // real one that happens to share the same task id and timestamp.
      const dupe = state.rows.find(
        (r) =>
          r["outcome"] === "processed" &&
          r["task_id"] === payload["task_id"] &&
          r["task_updated_at"] === payload["task_updated_at"] &&
          r["is_fixture"] === payload["is_fixture"],
      );
      if (dupe) {
        return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
    }
    const row: Row = {
      id: String(state.nextId++),
      received_at: new Date().toISOString(),
      retryable: false,
      retry_count: 0,
      recovered_at: null,
      ...payload,
    };
    state.rows.push(row);
    return { data: [row], error: null };
  }

  function builder(table: string) {
    touchedTables.add(table);
    const filters: Filter[] = [];
    let order: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;
    let mode: "select" | "delete" | null = null;

    function selected(): Row[] {
      let result = state.rows.filter((r) => filters.every((f) => applyFilter(r, f)));
      if (order) {
        const { col, ascending } = order;
        result = [...result].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av == null && bv == null) return 0;
          if (av == null) return ascending ? -1 : 1;
          if (bv == null) return ascending ? 1 : -1;
          if (av === bv) return 0;
          const cmp = av < bv ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);
      return result;
    }

    const api = {
      insert: (payload: Row) => Promise.resolve(insert(payload)),
      select: (_cols?: string) => {
        mode = "select";
        return api;
      },
      delete: () => {
        mode = "delete";
        return api;
      },
      update: (patch: Row) => ({
        eq: (col: string, value: unknown) => {
          state.rows = state.rows.map((r) => (r[col] === value ? { ...r, ...patch } : r));
          return Promise.resolve({ data: null, error: null });
        },
      }),
      eq: (col: string, value: unknown) => {
        filters.push({ col, op: "eq", value });
        return api;
      },
      is: (col: string, value: unknown) => {
        filters.push({ col, op: "is", value });
        return api;
      },
      lt: (col: string, value: unknown) => {
        filters.push({ col, op: "lt", value });
        return api;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        order = { col, ascending: opts?.ascending ?? true };
        return api;
      },
      limit: (n: number) => {
        limitN = n;
        return api;
      },
      maybeSingle: () => {
        const result = selected();
        return Promise.resolve({ data: result[0] ?? null, error: null });
      },
      then: (
        resolve: (v: { data: Row[] | null; error: null }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        const result = selected();
        if (mode === "delete") {
          const ids = new Set(result.map((r) => r["id"]));
          state.rows = state.rows.filter((r) => !ids.has(r["id"]));
        }
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    supabaseAdmin: { from: (table: string) => builder(table) },
    rows: () => state.rows,
    touchedTables,
    /**
     * Makes the next `n` insert() calls fail with the given error instead of
     * running the normal conflict check / success path, to exercise
     * recordEvent's "unexpected persistence failure" branch. Defaults to a
     * generic non-23505 error (e.g. simulating the table being unreachable).
     */
    failNextInsert: (
      n = 1,
      error: { code?: string; message: string } = { code: "53300", message: "simulated failure" },
    ) => {
      for (let i = 0; i < n; i += 1) state.insertFailures.push(error);
    },
    reset: () => {
      state.rows = [];
      state.nextId = 1;
      state.insertFailures = [];
      touchedTables.clear();
    },
  };
}

export type FakeBreezewayEventsStore = ReturnType<typeof createFakeBreezewayEventsStore>;
