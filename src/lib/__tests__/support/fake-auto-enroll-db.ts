// @ts-nocheck: in-memory fake database for the automatic Active Owner enrollment tests.
type Row = Record<string, unknown>;

export function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: "insert" | "update"; row: Row }[] = [];
  let seq = 0;
  function builder(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let mode: "select" | "update" = "select";
    let patch: Row = {};
    let limit = Infinity;
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, limit);
    const run = () => {
      if (mode === "update") {
        const hit = rows();
        for (const r of hit) { Object.assign(r, patch); writes.push({ table, op: "update", row: { ...r } }); }
        return { data: hit, error: null };
      }
      return { data: rows(), error: null };
    };
    const api = {
      select: () => api,
      eq: (c, v) => (filters.push((r) => r[c] === v), api),
      neq: (c, v) => (filters.push((r) => r[c] !== v), api),
      is: (c, v) => (filters.push((r) => (r[c] ?? null) === v), api),
      in: (c, vs) => (filters.push((r) => vs.includes(r[c])), api),
      not: (c, op, list) => {
        const vals = String(list).replace(/[()]/g, "").split(",");
        filters.push((r) => !vals.includes(String(r[c])));
        return api;
      },
      or: (expr) => {
        if (String(expr).includes("owner_type.eq.")) filters.push((r) => r.owner_type === "Active Owner" || (r.modules ?? []).includes("active_owner"));
        return api;
      },
      order: () => api,
      limit: (n) => ((limit = n), api),
      maybeSingle: async () => { const r = run(); return { data: r.data[0] ?? null, error: null }; },
      single: async () => { const r = run(); return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: "none" } }; },
      update: (p) => ((mode = "update"), (patch = p), api),
      insert: async (row) => {
        tables[table] = tables[table] ?? [];
        if (table === "active_owner_setup_items" && tables[table].some((r) => r.status === "open" && r.property_id === row.property_id && r.kind === row.kind))
          return { data: null, error: { code: "23505", message: "duplicate" } };
        const saved = { id: `${table}-${++seq}`, status: "open", attempts: 0, created_at: "2026-11-23T00:00:00Z", ...row };
        tables[table].push(saved);
        writes.push({ table, op: "insert", row: saved });
        return { data: saved, error: null };
      },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return api;
  }
  return { db: { from: (t) => builder(t), rpc: async () => ({ data: null, error: null }) }, writes };
}

export const HOME = "11111111-1111-4111-8111-111111111111";
export const OWNER = "22222222-2222-4222-8222-222222222222";
export const PM = "pm-user";
export const DIRECTOR = "director-user";
export const ADMIN = "admin-user";

export function baseTables(over: Partial<{ ownerType: string | null; modules: string[]; email: string | null; closing: string | null; isDemo: boolean; name: string }> = {}) {
  return {
    properties: [{ id: HOME, name: over.name ?? "100 Main St", owner_record_id: OWNER, planned_closing_on: null, actual_closing_on: null, is_demo: over.isDemo ?? false, archived_at: null, ownerrez_property_id: null }],
    onboarding_projects: [{ id: "proj", property_id: HOME, status: "active", owner_type: over.ownerType === undefined ? "Active Owner" : over.ownerType, modules: over.modules ?? ["utilities"], planned_closing_on: over.closing === undefined ? "2026-12-15" : over.closing, is_demo: over.isDemo ?? false, created_at: "2026-11-01" }],
    property_owners: [{ id: OWNER, name: "Pat Owner", email: over.email === undefined ? "Pat@Example.com" : over.email, active: true }],
    owner_program_properties: [],
    owner_programs: [],
    active_owner_setup_items: [],
    onboarding_project_events: [],
    audit_log: [],
    profiles: [
      { id: PM, full_name: "Project Manager One", email: "pm@arealhomeaway.com" },
      { id: DIRECTOR, full_name: "Director One", email: "director@arealhomeaway.com" },
      { id: ADMIN, full_name: "Admin One", email: "admin@arealhomeaway.com" },
    ],
  };
}

/**
 * Stand-in for the existing one-step enrollment: reuses the owner's program (never a second one),
 * links the home, needs a closing date to go live, and adds a login only with an email.
 */
export function fakeDeps(tables, opts: { authority?: (id: string) => boolean; failWith?: string | null } = {}) {
  const calls = { enroll: [] as Row[], route: 0 };
  let ids = 0;
  const deps = {
    enroll: async (actor, input) => {
      calls.enroll.push({ actorId: actor.id, ownClient: actor.client !== null, ...input });
      if (opts.failWith) return { complete: false, programId: null, accountId: null, accountCreated: false, welcomeHeld: false, onboardingAdded: 0, operatingAdded: 0, steps: [{ key: "enrollment", status: "failed", detail: opts.failWith }] };
      let program = tables.owner_programs.find((p) => p.owner_record_id === input.ownerRecordId && !p.archived_at);
      if (!program) { program = { id: `program-${tables.owner_programs.length + 1}`, owner_record_id: input.ownerRecordId, status: "draft", archived_at: null, owner_user_id: null, is_demo: false }; tables.owner_programs.push(program); }
      let link = tables.owner_program_properties.find((l) => l.property_id === input.propertyId && l.owner_programs === program);
      if (!link) { link = { property_id: input.propertyId, inclusion_status: "included", owner_programs: program }; tables.owner_program_properties.push(link); }
      if (input.email) program.owner_user_id = "owner-login";
      if (!input.closingDate) {
        return { complete: false, programId: program.id, accountId: program.owner_user_id, accountCreated: Boolean(input.email), welcomeHeld: false, onboardingAdded: 0, operatingAdded: 0,
          steps: [{ key: "account", status: input.email ? "done" : "skipped" }, { key: "enrollment", status: "done" }, { key: "closing", status: "failed", detail: "A closing date is required." }] };
      }
      program.status = "active";
      return { complete: true, programId: program.id, accountId: program.owner_user_id, accountCreated: Boolean(input.email), welcomeHeld: false, onboardingAdded: 30, operatingAdded: 0,
        steps: [{ key: "account", status: input.email ? "done" : "skipped" }, { key: "welcome", status: input.email ? "done" : "skipped" }] };
    },
    mayEnrollAsSelf: async (_c, id) => (opts.authority ?? ((u) => u === DIRECTOR || u === ADMIN))(id),
    ownerRezOwner: async () => null,
    resolveOwnerRecord: async (input) => {
      const name = input.typed?.name;
      if (!name) return null;
      tables.property_owners.push({ id: "new-owner", name, email: input.typed?.email ?? null, active: true });
      return "new-owner";
    },
    route: async () => { calls.route++; return { assignee: PM, reason: "onboarding_pm", noProjectManager: false }; },
    seatHolder: async (code) => (code === "director_onboarding" ? DIRECTOR : null),
    newId: () => `request-${++ids}`,
    now: () => new Date("2026-11-23T15:00:00Z"),
  };
  return { deps, calls };
}
