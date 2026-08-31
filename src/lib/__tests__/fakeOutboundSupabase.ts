/**
 * In-memory stand-in for the tables the Breezeway outbound code touches
 * (`feature_flags`, `tickets`, `onboarding_tasks`, `properties`,
 * `breezeway_outbound_tasks`), used only in tests via `mock.module`.
 *
 * It reproduces the constraints that actually matter for duplicate safety:
 *   - unique `request_key`
 *   - unique `breezeway_task_id` when not null
 *   - ONE open row per source record, where "open" is status
 *     `creating` OR `needs_review` — exactly the partial indexes in the
 *     migration, so an uncertain record still holds the lock.
 * It is an approximation of Postgres, not proof Postgres enforces them.
 */
type Row = Record<string, unknown>;

const OPEN = new Set(["creating", "needs_review"]);

export function createFakeOutboundStore() {
  const state = {
    flags: [] as Row[],
    tickets: [] as Row[],
    onboarding: [] as Row[],
    properties: [] as Row[],
    outbound: [] as Row[],
    nextId: 1,
    failNextOutboundUpdate: 0,
  };

  function tableRows(table: string): Row[] {
    if (table === "feature_flags") return state.flags;
    if (table === "tickets") return state.tickets;
    if (table === "onboarding_tasks") return state.onboarding;
    if (table === "properties") return state.properties;
    if (table === "breezeway_outbound_tasks") return state.outbound;
    throw new Error(`Unexpected table in test: ${table}`);
  }

  function insertOutbound(payload: Row) {
    const dupeKey = state.outbound.find((r) => r["request_key"] === payload["request_key"]);
    if (dupeKey) return { data: null, error: { code: "23505", message: "duplicate request_key" } };
    for (const col of ["ticket_id", "onboarding_task_id"] as const) {
      if (payload[col] == null) continue;
      const open = state.outbound.find(
        (r) => r[col] === payload[col] && OPEN.has(String(r["status"])),
      );
      if (open) return { data: null, error: { code: "23505", message: "one in-flight only" } };
    }
    const row: Row = {
      id: `row-${state.nextId++}`,
      created_at: new Date().toISOString(),
      breezeway_task_id: null,
      error_message: null,
      review_note: null,
      reviewed_at: null,
      last_synced_at: null,
      last_webhook_at: null,
      ...payload,
    };
    state.outbound.push(row);
    return { data: row, error: null };
  }

  function updateOutbound(patch: Row, matches: (r: Row) => boolean) {
    if (state.failNextOutboundUpdate > 0) {
      state.failNextOutboundUpdate -= 1;
      return { data: null, error: { code: "53300", message: "simulated update failure" } };
    }
    if (patch["breezeway_task_id"] != null) {
      const clash = state.outbound.find(
        (r) => r["breezeway_task_id"] === patch["breezeway_task_id"] && !matches(r),
      );
      if (clash) return { data: null, error: { code: "23505", message: "duplicate task id" } };
    }
    let updated: Row | null = null;
    state.outbound = state.outbound.map((r) => {
      if (!matches(r)) return r;
      updated = { ...r, ...patch };
      return updated;
    });
    return { data: updated, error: null };
  }

  function builder(table: string) {
    type F = { col: string; op: "eq" | "in"; value: unknown };
    const filters: F[] = [];
    const match = (r: Row) =>
      filters.every((f) =>
        f.op === "eq"
          ? r[f.col] === f.value
          : Array.isArray(f.value) && (f.value as unknown[]).includes(r[f.col]),
      );
    let order: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;
    let pendingUpdate: Row | null = null;

    function selected() {
      let rows = tableRows(table).filter(match);
      if (order) {
        const { col, ascending } = order;
        rows = [...rows].sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
        });
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      return rows;
    }

    const api = {
      insert: (payload: Row) => {
        const result = table === "breezeway_outbound_tasks" ? insertOutbound(payload) : { data: payload, error: null };
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
        if (pendingUpdate && table === "breezeway_outbound_tasks") {
          const patch = pendingUpdate;
          pendingUpdate = null;
          const result = updateOutbound(patch, match);
          const chain = {
            select: () => chain,
            single: () => Promise.resolve(result),
            then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
          };
          return chain as unknown as typeof api;
        }
        return api;
      },
      in: (col: string, value: unknown[]) => {
        filters.push({ col, op: "in", value });
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
    outbound: () => state.outbound,
    setFlag: (enabled: boolean) => {
      state.flags = [{ key: "breezeway_outbound", enabled }];
    },
    seedPilotTicket: (id: string) => {
      state.tickets.push({
        id,
        title: "Leaking tap",
        description: "Guest reported a drip",
        priority: "p3",
        property_id: "prop-1",
        is_demo: false,
        archived_at: null,
      });
      if (!state.properties.some((p) => p["id"] === "prop-1")) {
        state.properties.push({
          id: "prop-1",
          name: "9211 Fitzgerald Dr",
          breezeway_property_id: "1473933",
        });
      }
    },
    /** The onboarding-task source type, on the same pilot property. */
    seedPilotOnboardingTask: (id: string) => {
      state.onboarding.push({
        id,
        title: "Install lockbox",
        detail: "Front door, code in the brief",
        property_id: "prop-1",
        is_demo: false,
        archived_at: null,
      });
      if (!state.properties.some((p) => p["id"] === "prop-1")) {
        state.properties.push({
          id: "prop-1",
          name: "9211 Fitzgerald Dr",
          breezeway_property_id: "1473933",
        });
      }
    },
    failNextUpdate: (n = 1) => {
      state.failNextOutboundUpdate = n;
    },
    reset: () => {
      state.flags = [];
      state.tickets = [];
      state.onboarding = [];
      state.properties = [];
      state.outbound = [];
      state.nextId = 1;
      state.failNextOutboundUpdate = 0;
    },
  };
}
