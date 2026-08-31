/**
 * Minimal in-memory stand-in for the tables breezeway-outbound.server.ts
 * touches, used only in tests via `mock.module("@/integrations/supabase/client.server", ...)`.
 *
 * Enforces the same constraints the real migration adds on
 * `breezeway_outbound_tasks` — unique(request_key), unique(breezeway_task_id)
 * WHERE NOT NULL, and unique(ticket_id)/(onboarding_task_id) WHERE
 * status='creating' — so a concurrency/idempotency test here exercises the
 * real conflict-handling code path in createOutboundTask, not a test-only
 * shortcut. This is an in-memory approximation, not Postgres: it proves the
 * application code reacts correctly to a 23505 conflict; it does not prove
 * Postgres itself serializes the race identically under real concurrent
 * transactions (that would need a disposable Postgres instance).
 */

type Row = Record<string, unknown>;

function matches(row: Row, filters: [string, unknown][]) {
  return filters.every(([col, val]) => row[col] === val);
}

export type OutboundDbSeed = {
  tickets?: Row[];
  onboardingTasks?: Row[];
  properties?: Row[];
  featureFlags?: Row[];
};

export function createFakeOutboundDb(seed: OutboundDbSeed) {
  const state = {
    tickets: seed.tickets ?? [],
    onboardingTasks: seed.onboardingTasks ?? [],
    properties: seed.properties ?? [],
    featureFlags: seed.featureFlags ?? [],
    outbound: [] as Row[],
    nextId: 1,
  };

  function reset(nextSeed: OutboundDbSeed) {
    state.tickets = nextSeed.tickets ?? [];
    state.onboardingTasks = nextSeed.onboardingTasks ?? [];
    state.properties = nextSeed.properties ?? [];
    state.featureFlags = nextSeed.featureFlags ?? [];
    state.outbound = [];
    state.nextId = 1;
  }

  function checkOutboundConflict(payload: Row): { code: string; message: string } | null {
    if (state.outbound.some((r) => r["request_key"] === payload["request_key"])) {
      return { code: "23505", message: "duplicate key value violates unique constraint" };
    }
    if (
      payload["breezeway_task_id"] != null &&
      state.outbound.some((r) => r["breezeway_task_id"] === payload["breezeway_task_id"])
    ) {
      return { code: "23505", message: "duplicate key value violates unique constraint" };
    }
    if (payload["status"] === "creating") {
      if (
        payload["ticket_id"] != null &&
        state.outbound.some((r) => r["ticket_id"] === payload["ticket_id"] && r["status"] === "creating")
      ) {
        return { code: "23505", message: "duplicate key value violates unique constraint" };
      }
      if (
        payload["onboarding_task_id"] != null &&
        state.outbound.some(
          (r) => r["onboarding_task_id"] === payload["onboarding_task_id"] && r["status"] === "creating",
        )
      ) {
        return { code: "23505", message: "duplicate key value violates unique constraint" };
      }
    }
    return null;
  }

  function tableFor(name: string): Row[] {
    if (name === "tickets") return state.tickets;
    if (name === "onboarding_tasks") return state.onboardingTasks;
    if (name === "properties") return state.properties;
    if (name === "feature_flags") return state.featureFlags;
    if (name === "breezeway_outbound_tasks") return state.outbound;
    throw new Error(`fakeOutboundDb: unexpected table "${name}"`);
  }

  function builder(table: string) {
    const filters: [string, unknown][] = [];
    let mode: "select" | "insert" | "update" = "select";
    let insertPayload: Row | null = null;
    let updatePatch: Row | null = null;
    let single = false;

    const rows = () => tableFor(table).filter((r) => matches(r, filters));

    const api = {
      select: (_cols?: string) => api,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return api;
      },
      insert: (payload: Row) => {
        mode = "insert";
        insertPayload = payload;
        return api;
      },
      update: (patch: Row) => {
        mode = "update";
        updatePatch = patch;
        return api;
      },
      single: () => {
        single = true;
        return run();
      },
      maybeSingle: () => {
        single = true;
        return run();
      },
      order: () => api,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        run().then(resolve, reject),
    };

    async function run(): Promise<{ data: unknown; error: Row | null }> {
      if (mode === "insert" && insertPayload) {
        if (table === "breezeway_outbound_tasks") {
          const conflict = checkOutboundConflict(insertPayload);
          if (conflict) return { data: null, error: conflict };
        }
        const row: Row = {
          id: `id-${state.nextId++}`,
          created_at: new Date().toISOString(),
          error_message: null,
          breezeway_task_id: null,
          last_synced_at: null,
          last_webhook_at: null,
          ...insertPayload,
        };
        tableFor(table).push(row);
        return { data: single ? row : [row], error: null };
      }
      if (mode === "update" && updatePatch) {
        const list = tableFor(table);
        let updated: Row | null = null;
        for (let i = 0; i < list.length; i += 1) {
          if (matches(list[i]!, filters)) {
            list[i] = { ...list[i]!, ...updatePatch };
            updated = list[i]!;
          }
        }
        return { data: single ? updated : updated ? [updated] : [], error: null };
      }
      const found = rows();
      return { data: single ? (found[0] ?? null) : found, error: null };
    }

    return api;
  }

  return {
    supabaseAdmin: { from: (table: string) => builder(table) },
    outboundRows: () => state.outbound,
    pushOutboundRow: (row: Row) => state.outbound.push(row),
    reset,
  };
}
