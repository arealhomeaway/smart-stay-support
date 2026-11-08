import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { COORDINATOR_ROLE_LABELS, ROUTING_NOTE_BANNED } from "@/lib/coverage-model";

/**
 * Isolated PostgreSQL check of the staged "route by the time" change
 * (docs/pending/routing-by-time/). Today's helper functions are loaded
 * verbatim from live-capture/; only tables are stubbed. The schedule is the
 * live saved schedule. Nothing touches the real database.
 */
const DIR = "docs/pending/routing-by-time";
const read = (p: string) => readFileSync(p, "utf8");
const live = (n: string) => read(`${DIR}/live-capture/public.${n}.sql`).trimEnd() + ";\n";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Role holders (stand-ins, no names).
const A1 = U(1), A2 = U(2), A3 = U(3), B1 = U(4), B2 = U(5), SUP = U(6), DIR_OPS = U(7), ONCALL = U(8), COVER = U(9);

const LIVE_HELPERS = ["seat_override_at", "seat_on_duty", "seat_eligible_now", "seat_holder_at", "staff_assignable", "oncall_user_for_night", "functional_role_holders"];
const LUNCH = read(`${DIR}/01_lunch_times.sql`);
const LUNCH_UNDO = read(`${DIR}/01_undo_lunch_times.sql`);
const NOTES = read(`${DIR}/02_lunch_notes.sql`);
const NOTES_UNDO = read(`${DIR}/02_undo_lunch_notes.sql`);
const ROUTING = read(`${DIR}/03_coordinator_routing.sql`);
const ROUTING_UNDO = read(`${DIR}/03_undo_coordinator_routing.sql`);

const OLD_NOTES: Record<string, string> = {
  ge_day: "On-duty Property Operations or Evening Guest Experience role covers new P1 and time-sensitive P2 work",
  ge_evening: "On-duty daytime or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work",
  po_day: "On-duty Guest Experience or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work",
  po_evening: "On-duty Guest Experience or Weekday Day Property Operations role covers new P1 and time-sensitive P2 work",
};

// The live saved schedule (coverage_shifts, Nov 8, 2026): [role, weekdays, start, end].
const SHIFTS: [string, number[], number, number][] = [
  ["ge_day", [0, 1, 4, 5, 6], 480, 1020],
  ["ge_evening", [0, 1, 2, 3, 6], 780, 1320],
  ["ge_parttime", [2, 3], 480, 780],
  ["ge_parttime", [4, 5], 1020, 1320],
  ["ops_supervisor", [1, 2, 3, 4, 5], 480, 1020],
  ["po_day", [1, 2, 3, 4, 5], 480, 1020],
  ["po_evening", [1, 2, 3, 4, 5], 780, 1320],
];

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.coverage_config(id boolean PRIMARY KEY DEFAULT true, timezone text, after_hours_start_minute int, after_hours_end_minute int);
CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, team text, functional_role_code text, pending_approval boolean DEFAULT false, active boolean DEFAULT true, sort_order int);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, name text, team text, backup_role_code text, current_seat_holder uuid, active boolean DEFAULT true, available boolean DEFAULT true, lunch_coverage text);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE TABLE public.coverage_shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text NOT NULL, weekday smallint NOT NULL, start_minute int NOT NULL, end_minute int NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.coverage_overrides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_code text, kind text, user_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.oncall_roster(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, starts_on date, ends_on date, created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb);
CREATE TABLE public.tickets(id serial PRIMARY KEY, status text DEFAULT 'open', priority text DEFAULT 'p3', work_type_id uuid, functional_role_code text,
  current_action_owner uuid, assigned_to uuid, assignment_source text, assignment_note text, archived_at timestamptz, is_demo boolean DEFAULT false,
  created_at timestamptz DEFAULT now());
INSERT INTO public.coverage_config VALUES (true, 'America/Chicago', 1320, 480);
`;

const ROLES: [string, string, string, string | null, string | null][] = [
  ["ge_day", "Guest Experience & Reservations Coordinator — Day/Weekend", "guest_experience", "ge_evening", A1],
  ["ge_evening", "Guest Experience & Reservations Coordinator — Evening", "guest_experience", "ge_day", A2],
  ["ge_parttime", "Guest Experience & Reservations Coordinator — Part-time", "guest_experience", "ge_day", A3],
  ["po_day", "Property Operations Coordinator — Weekday Day", "property_operations", "po_evening", B1],
  ["po_evening", "Property Operations Coordinator — Evening/Weekend", "property_operations", "po_day", B2],
  ["ops_supervisor", "Operations Supervisor", "leadership", null, SUP],
  ["director_ops", "Director of Operations", "leadership", null, DIR_OPS],
];

async function fresh(withRouting = true) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (const n of LIVE_HELPERS) await db.exec(live(n));
  await db.exec(live("auto_assign_ticket"));
  await db.exec(live("direct_booking_on_shift"));
  for (const [code, name, team, backup, holder] of ROLES)
    await db.query("INSERT INTO public.functional_roles(code, name, team, backup_role_code, current_seat_holder, lunch_coverage) VALUES ($1,$2,$3,$4,$5,$6)",
      [code, name, team, backup, holder, OLD_NOTES[code] ?? null]);
  for (const u of [A1, A2, A3, B1, B2, ONCALL, COVER]) await db.query("INSERT INTO public.user_roles VALUES ($1,'tech')", [u]);
  for (const u of [SUP, DIR_OPS]) await db.query("INSERT INTO public.user_roles VALUES ($1,'manager')", [u]);
  for (const [code, days, s, e] of SHIFTS)
    for (const d of days)
      await db.query("INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)", [code, d, s, e]);
  const pattern: Record<string, string> = {};
  for (let d = 0; d < 7; d++) pattern[String(d)] = ONCALL;
  await db.query("INSERT INTO public.app_settings VALUES ('oncall_weekday_pattern', $1)", [JSON.stringify(pattern)]);
  await db.exec(`INSERT INTO public.work_types(name, team, functional_role_code, sort_order) VALUES
    ('Current or past guest request','guest_experience','ge_day',1),
    ('Immediate maintenance','property_operations','po_day',2),
    ('Escalated owner issue','leadership','director_ops',3);
    INSERT INTO public.work_types(name, team, functional_role_code, pending_approval, sort_order) VALUES ('Waiting for an owner decision','guest_experience','ge_day',true,4);`);
  if (withRouting) {
    await db.exec(LUNCH);
    await db.exec(ROUTING);
  }
  return db;
}

const at = (day: string, hm: string) => `2026-11-${day} ${hm} America/Chicago`;
// Nov 2026 (Central, standard time): Sun 8, Mon 9, Tue 10, Wed 11, Thu 12, Fri 13, Sat 14.
const MON = "09", TUE = "10", THU = "12", SAT = "14";

type Pick = { user_id: string | null; role_code: string | null; note: string; path: string };
const pick = async (db: PGlite, team: "guest_experience" | "property_operations", when: string) =>
  (await db.query<Pick>("SELECT * FROM public.coordinator_for($1, $2::timestamptz)", [team, when])).rows[0]!;
const alerts = async (db: PGlite, when: string) =>
  (await db.query<{ u: string }>("SELECT u FROM public.direct_booking_on_shift($1::timestamptz) u ORDER BY 1", [when])).rows.map((r) => r.u);
const give = (db: PGlite, user: string, priority: string, opts: { status?: string; source?: string; created?: string } = {}) =>
  db.query("INSERT INTO public.tickets(status, priority, current_action_owner, assigned_to, assignment_source, created_at) VALUES ($1,$2,$3,$3,$4,coalesce($5::timestamptz, now()))",
    [opts.status ?? "open", priority, user, opts.source ?? null, opts.created ?? null]);
const off = (db: PGlite, role: string, when: string) =>
  db.query("INSERT INTO public.coverage_overrides(role_code, kind, starts_at, ends_at) VALUES ($1,'off',$2::timestamptz - interval '4 hours',$2::timestamptz + interval '4 hours')", [role, when]);
const cover = (db: PGlite, role: string, user: string, when: string) =>
  db.query("INSERT INTO public.coverage_overrides(role_code, kind, user_id, starts_at, ends_at) VALUES ($1,'cover',$2,$3::timestamptz - interval '4 hours',$3::timestamptz + interval '4 hours')", [role, user, when]);

let db: PGlite;
async function reset() {
  await db.exec(`TRUNCATE public.coverage_overrides, public.tickets, public.oncall_roster;
    UPDATE public.functional_roles SET available = true, active = true;`);
  for (const [code, , , , holder] of ROLES)
    await db.query("UPDATE public.functional_roles SET current_seat_holder = $2 WHERE code = $1", [code, holder]);
}

describe("lunch hours saved as real times (part 1)", () => {
  beforeAll(async () => { db = await fresh(); });

  it("fills each role's approved lunch, on its approved days only", async () => {
    const rows = (await db.query<{ role_code: string; weekday: number; lunch_start_minute: number | null; lunch_end_minute: number | null }>(
      "SELECT role_code, weekday, lunch_start_minute, lunch_end_minute FROM public.coverage_shifts ORDER BY role_code, weekday")).rows;
    const want: Record<string, [number[], number, number] | null> = {
      ge_day: [[0, 1, 4, 5, 6], 780, 840],
      ge_evening: [[0, 1, 2, 3, 6], 960, 1020],
      po_day: [[1, 2, 3, 4, 5], 780, 840],
      po_evening: [[1, 2, 3, 4, 5], 900, 960],
      ge_parttime: null,
      ops_supervisor: null,
    };
    for (const r of rows) {
      const w = want[r.role_code];
      if (w && w[0].includes(r.weekday)) expect([r.role_code, r.lunch_start_minute, r.lunch_end_minute]).toEqual([r.role_code, w[1], w[2]]);
      else expect([r.role_code, r.lunch_start_minute, r.lunch_end_minute]).toEqual([r.role_code, null, null]);
    }
    expect(rows.length).toBe(29);
  });

  it("refuses a lunch that ends before it starts, and the undo removes the columns", async () => {
    await expect(db.exec("UPDATE public.coverage_shifts SET lunch_start_minute = 900, lunch_end_minute = 800 WHERE role_code = 'po_day'")).rejects.toThrow();
    const d2 = await fresh(false);
    await d2.exec(LUNCH);
    await d2.exec(LUNCH_UNDO);
    const cols = (await d2.query<{ c: string }>("SELECT column_name c FROM information_schema.columns WHERE table_name = 'coverage_shifts' AND column_name LIKE 'lunch%'")).rows;
    expect(cols).toEqual([]);
  });
});

describe("lunch notes (part 2)", () => {
  it("changes only the four coordinator lunch notes, to say cover takes all new work, and the undo puts them back", async () => {
    const d = await fresh(false);
    const snap = async () => (await d.query<{ code: string; lunch_coverage: string | null }>("SELECT code, lunch_coverage FROM public.functional_roles ORDER BY code")).rows;
    const before = await snap();
    await d.exec(NOTES);
    const after = await snap();
    for (const r of after) {
      if (OLD_NOTES[r.code]) {
        expect(r.lunch_coverage).toContain("takes all new work");
        expect(r.lunch_coverage).not.toMatch(/P1|P2|urgent|time-sensitive|seat/i);
      } else expect(r).toEqual(before.find((b) => b.code === r.code)!);
    }
    await d.exec(NOTES_UNDO);
    expect(await snap()).toEqual(before);
  });
});

describe("coordinator_for: one person by the time (part 3)", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(reset);

  it("sends work to the coordinator on that team who is on shift", async () => {
    const a = await pick(db, "guest_experience", at(TUE, "09:00"));
    expect([a.user_id, a.role_code, a.path]).toEqual([A3, "ge_parttime", "team"]);
    expect(a.note).toBe("Sent to the Guest Experience part time coordinator on shift.");
    const b = await pick(db, "property_operations", at(TUE, "09:00"));
    expect([b.user_id, b.role_code]).toEqual([B1, "po_day"]);
    expect(b.note).toBe("Sent to the Property Operations weekday day coordinator on shift.");
  });

  it("with several on shift, the lightest load wins (Right now 5, Today 3, Routine 1)", async () => {
    await give(db, A1, "p1"); // 5
    await give(db, A2, "p2"); // 3
    await give(db, A2, "p3"); // 1 -> 4
    const r = await pick(db, "guest_experience", at(MON, "14:30"));
    expect(r.user_id).toBe(A2);
    expect(r.note).toContain("They had the least open work.");
    await give(db, A2, "p3"); // 5 -> tie with A1 at 5, A1 never given work automatically
    await give(db, A2, "p3", { source: "automatic" }); // 6
    expect((await pick(db, "guest_experience", at(MON, "14:30"))).user_id).toBe(A1);
  });

  it("a tie goes to whoever was given work longest ago, and never-given goes first", async () => {
    await give(db, A1, "p3", { source: "automatic", created: "2026-11-01 09:00 America/Chicago" });
    await give(db, A2, "p3", { source: "automatic", created: "2026-11-05 09:00 America/Chicago" });
    expect((await pick(db, "guest_experience", at(MON, "14:30"))).user_id).toBe(A1);
    await db.exec("TRUNCATE public.tickets");
    await give(db, A1, "p3", { source: "automatic" });
    await give(db, A2, "p3"); // given by hand, never automatically
    expect((await pick(db, "guest_experience", at(MON, "14:30"))).user_id).toBe(A2);
  });

  it("Waiting does not count towards load; closed, resolved, archived and demo work never count", async () => {
    await give(db, A1, "p1", { status: "waiting" });
    await give(db, A1, "p1", { status: "closed" });
    await give(db, A1, "p1", { status: "resolved" });
    await db.exec(`INSERT INTO public.tickets(status, priority, current_action_owner, archived_at) VALUES ('open','p1','${A1}', now())`);
    await db.exec(`INSERT INTO public.tickets(status, priority, current_action_owner, is_demo) VALUES ('open','p1','${A1}', true)`);
    await give(db, A2, "p3");
    const loads = (await db.query<{ user_id: string; load: number }>("SELECT user_id, load FROM public.coordinators_on_shift($1::timestamptz) ORDER BY role_code", [at(MON, "14:30")])).rows;
    expect(loads).toEqual([{ user_id: A1, load: 0 }, { user_id: A2, load: 1 }]);
    expect((await pick(db, "guest_experience", at(MON, "14:30"))).user_id).toBe(A1);
  });

  it("nobody on the team is on shift: the lightest coordinator working on the other team", async () => {
    await off(db, "ge_parttime", at(TUE, "09:00"));
    const r = await pick(db, "guest_experience", at(TUE, "09:00"));
    expect([r.user_id, r.role_code, r.path]).toEqual([B1, "po_day", "other_team"]);
    expect(r.note).toBe("No one on Guest Experience was on shift, so it went to the Property Operations weekday day coordinator, who is working.");
  });

  it("weekend: Property Operations work goes to the Guest Experience coordinators on shift", async () => {
    await give(db, A1, "p2");
    const r = await pick(db, "property_operations", at(SAT, "14:00"));
    expect([r.user_id, r.role_code, r.path]).toEqual([A2, "ge_evening", "other_team"]);
    expect(r.note).toBe("No one on Property Operations was on shift, so it went to the Guest Experience evening coordinator, who is working.");
    expect((await pick(db, "guest_experience", at(SAT, "14:00"))).user_id).toBe(A2);
  });

  it("lunch: cover comes from the same team first, even with more open work", async () => {
    for (let i = 0; i < 4; i++) await give(db, A2, "p1");
    const r = await pick(db, "guest_experience", at(MON, "13:30"));
    expect([r.user_id, r.path]).toEqual([A2, "team"]);
    expect(r.note).toBe("The Guest Experience day and weekend coordinator is at lunch, so it was sent to the Guest Experience evening coordinator on shift.");
  });

  it("lunch: with no one free on the same team, any coordinator on shift", async () => {
    const r = await pick(db, "guest_experience", at(THU, "13:30"));
    expect([r.user_id, r.role_code, r.path]).toEqual([B2, "po_evening", "other_team"]);
    expect(r.note).toBe("Everyone on Guest Experience who is on shift is at lunch, so it went to the Property Operations evening and weekend coordinator, who is working.");
  });

  it("lunch: the only person working still gets it, same team first among people at lunch", async () => {
    await off(db, "ge_day", at(SAT, "16:30"));
    const r = await pick(db, "property_operations", at(SAT, "16:30"));
    expect([r.user_id, r.path]).toEqual([A2, "lunch_only"]);
    expect(r.note).toBe("Sent to the Guest Experience evening coordinator on shift. They are at lunch, but no other coordinator is working.");
    await reset();
    await off(db, "po_evening", at(THU, "13:30"));
    expect((await pick(db, "guest_experience", at(THU, "13:30"))).user_id).toBe(A1);
    expect((await pick(db, "property_operations", at(THU, "13:30"))).user_id).toBe(B1);
  });

  it("approved time off takes the person off shift", async () => {
    await off(db, "po_day", at(MON, "09:00"));
    const r = await pick(db, "property_operations", at(MON, "09:00"));
    expect([r.user_id, r.role_code]).toEqual([A1, "ge_day"]);
  });

  it("a cover puts the covering person on shift", async () => {
    await cover(db, "ge_day", COVER, at(MON, "09:00"));
    const r = await pick(db, "guest_experience", at(MON, "09:00"));
    expect([r.user_id, r.role_code]).toEqual([COVER, "ge_day"]);
    expect(r.note).toBe("Sent to the person covering for the Guest Experience day and weekend coordinator on shift.");
  });

  it("the temporarily unavailable switch still applies", async () => {
    await db.exec("UPDATE public.functional_roles SET available = false WHERE code = 'po_day'");
    expect((await pick(db, "property_operations", at(MON, "09:00"))).user_id).toBe(A1);
  });

  it("a role with no holder is never on shift", async () => {
    await db.exec("UPDATE public.functional_roles SET current_seat_holder = NULL WHERE code = 'ge_day'");
    expect((await pick(db, "guest_experience", at(MON, "09:00"))).user_id).toBe(B1);
  });

  it("no coordinator working overnight: the person on call tonight (today's pattern)", async () => {
    const r = await pick(db, "guest_experience", at(MON, "23:00"));
    expect([r.user_id, r.path]).toEqual([ONCALL, "on_call"]);
    expect(r.note).toBe("No coordinator was on shift overnight, so it went to the person on call tonight. Urgency is unchanged.");
    // A single-night roster entry still wins over the weekday pattern.
    await db.query("INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, '2026-11-09', '2026-11-09')", [COVER]);
    expect((await pick(db, "property_operations", at(TUE, "03:00"))).user_id).toBe(COVER);
  });

  it("no coordinator and no one on call: the Operations Supervisor; daytime with nobody working goes straight there", async () => {
    await db.exec("UPDATE public.app_settings SET value = '{}' WHERE key = 'oncall_weekday_pattern'");
    const night = await pick(db, "guest_experience", at(MON, "23:00"));
    expect([night.user_id, night.path]).toEqual([SUP, "supervisor"]);
    expect(night.note).toContain("no one is on call tonight, so it went to the Operations Supervisor.");
    for (const role of ["ge_day", "ge_evening", "ge_parttime", "po_day", "po_evening"]) await off(db, role, at(MON, "10:00"));
    const day = await pick(db, "property_operations", at(MON, "10:00"));
    expect([day.user_id, day.path]).toEqual([SUP, "supervisor"]);
    expect(day.note).toBe("No coordinator was on shift, so it went to the Operations Supervisor.");
    await db.exec("UPDATE public.functional_roles SET current_seat_holder = NULL WHERE code = 'ops_supervisor'");
    const none = await pick(db, "property_operations", at(MON, "10:00"));
    expect([none.user_id, none.path]).toEqual([null, "nobody"]);
  });

  it("has no side effects: it runs inside a read only transaction and changes no rows", async () => {
    await give(db, A1, "p2");
    const count = async () => (await db.query<{ n: number }>("SELECT (SELECT count(*) FROM public.tickets) + (SELECT count(*) FROM public.coverage_overrides) n")).rows[0]!.n;
    const before = await count();
    await db.exec("BEGIN READ ONLY");
    await db.query("SELECT * FROM public.coordinator_for('guest_experience', $1::timestamptz)", [at(MON, "13:30")]);
    await db.query("SELECT * FROM public.routing_dry_run(ARRAY[$1::timestamptz, $2::timestamptz])", [at(MON, "09:00"), at(SAT, "14:00")]);
    await db.query("SELECT * FROM public.direct_booking_on_shift($1::timestamptz)", [at(MON, "09:00")]);
    await db.exec("COMMIT");
    expect(await count()).toBe(before);
    const vol = (await db.query<{ proname: string; provolatile: string }>(
      "SELECT proname, provolatile FROM pg_proc WHERE proname IN ('coordinators_on_shift','coordinator_for','ticket_route_at','routing_dry_run','direct_booking_on_shift') ORDER BY proname")).rows;
    expect(vol.every((v) => v.provolatile === "s")).toBe(true);
    expect(vol.length).toBe(5);
  });

  it("notes are plain words: never seat, triage, weighted load, code names or urgency codes", async () => {
    const notes = new Set<string>();
    for (const day of ["08", "09", "10", "11", "12", "13", "14"])
      for (let h = 0; h < 24; h++)
        for (const team of ["guest_experience", "property_operations"] as const)
          notes.add((await pick(db, team, at(day, `${String(h).padStart(2, "0")}:30`))).note);
    await off(db, "ge_parttime", at(TUE, "09:00"));
    await cover(db, "po_day", COVER, at(TUE, "09:00"));
    notes.add((await pick(db, "guest_experience", at(TUE, "09:00"))).note);
    for (const r of (await db.query<{ note: string }>("SELECT note FROM public.routing_dry_run(ARRAY[$1::timestamptz,$2::timestamptz,$3::timestamptz])", [at(MON, "09:00"), at(MON, "23:00"), at(THU, "12:30")])).rows) notes.add(r.note);
    expect(notes.size).toBeGreaterThan(5);
    for (const n of notes) for (const bad of ROUTING_NOTE_BANNED) expect({ n, bad: bad.test(n) }).toEqual({ n, bad: false });
  });

  it("the database role names match the app's plain role names", async () => {
    for (const [code, label] of Object.entries(COORDINATOR_ROLE_LABELS))
      expect((await db.query<{ l: string }>("SELECT public.coordinator_role_label($1) l", [code])).rows[0]!.l).toBe(label);
  });

  it("only the server can run the routing functions", async () => {
    for (const fn of ["coordinators_on_shift(timestamptz)", "coordinator_for(text, timestamptz)", "ticket_route_at(text, uuid, timestamptz)", "routing_dry_run(timestamptz[])", "auto_assign_ticket()", "direct_booking_on_shift(timestamptz)"])
      for (const role of ["anon", "authenticated"])
        expect({ fn, role, ok: (await db.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') ok`)).rows[0]!.ok }).toEqual({ fn, role, ok: false });
  });
});

describe("the ticket trigger uses the one rule; other paths are unchanged", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(reset);

  const wt = async (name: string) => (await db.query<{ id: string }>("SELECT id FROM public.work_types WHERE name = $1", [name])).rows[0]!.id;
  const insert = async (workType: string | null, role: string | null = null) => {
    await db.exec("CREATE TRIGGER t BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket()");
    try {
      return (await db.query<{ assigned_to: string | null; current_action_owner: string | null; assignment_source: string | null; assignment_note: string | null; functional_role_code: string | null }>(
        "INSERT INTO public.tickets(work_type_id, functional_role_code) VALUES ($1, $2) RETURNING assigned_to, current_action_owner, assignment_source, assignment_note, functional_role_code",
        [workType ? await wt(workType) : null, role])).rows[0]!;
    } finally {
      await db.exec("DROP TRIGGER t ON public.tickets");
    }
  };

  it("coordinator work types go to coordinator_for at this moment, and the ticket's team never changes", async () => {
    for (const [name, team] of [["Current or past guest request", "guest_experience"], ["Immediate maintenance", "property_operations"]] as const) {
      const expected = (await db.query<Pick>("SELECT * FROM public.coordinator_for($1, now())", [team])).rows[0]!;
      const t = await insert(name);
      expect([t.assigned_to, t.current_action_owner, t.assignment_note]).toEqual([expected.user_id, expected.user_id, expected.note]);
      expect(t.assignment_source).toBe(expected.user_id ? "automatic" : null);
      expect(t.functional_role_code).toBeNull();
    }
    const kept = await insert(null, "po_day");
    expect(kept.functional_role_code).toBe("po_day");
  });

  it("Director of Operations work types, no work type and undecided work types keep today's person", async () => {
    const cases: [string | null, string | null][] = [["Escalated owner issue", null], [null, null], ["Waiting for an owner decision", null], [null, "director_ops"]];
    const now: { assigned_to: string | null; source: string | null }[] = [];
    for (const [w, r] of cases) { const t = await insert(w, r); now.push({ assigned_to: t.assigned_to, source: t.assignment_source }); }
    await db.exec(live("auto_assign_ticket"));
    const before: { assigned_to: string | null; source: string | null }[] = [];
    for (const [w, r] of cases) { const t = await insert(w, r); before.push({ assigned_to: t.assigned_to, source: t.assignment_source }); }
    await db.exec(ROUTING);
    expect(now).toEqual(before);
  });

  it("the same paths keep today's person when the on call person, the Director or the Supervisor are missing", async () => {
    await db.exec("UPDATE public.functional_roles SET current_seat_holder = NULL WHERE code IN ('director_ops')");
    const a = await insert("Escalated owner issue");
    await db.exec(live("auto_assign_ticket"));
    const b = await insert("Escalated owner issue");
    await db.exec(ROUTING);
    expect(a.assigned_to).toBe(b.assigned_to);
    await db.exec("UPDATE public.functional_roles SET current_seat_holder = NULL WHERE code IN ('ops_supervisor')");
    const c = await insert(null);
    await db.exec(live("auto_assign_ticket"));
    const d = await insert(null);
    await db.exec(ROUTING);
    expect(c.assigned_to).toBe(d.assigned_to);
  });

  it("the dry run lists every active work type at every time asked", async () => {
    const rows = (await db.query<{ work_type: string }>("SELECT work_type FROM public.routing_dry_run(ARRAY[$1::timestamptz,$2::timestamptz,$3::timestamptz])", [at(MON, "09:00"), at(MON, "23:00"), at(SAT, "14:00")])).rows;
    expect(rows.length).toBe(4 * 3);
    const mon9 = (await db.query<{ work_type: string; user_id: string | null }>("SELECT work_type, user_id FROM public.routing_dry_run(ARRAY[$1::timestamptz])", [at(MON, "09:00")])).rows;
    expect(mon9.find((r) => r.work_type === "Current or past guest request")!.user_id).toBe(A1);
    expect(mon9.find((r) => r.work_type === "Immediate maintenance")!.user_id).toBe(B1);
    expect(mon9.find((r) => r.work_type === "Escalated owner issue")!.user_id).toBe(DIR_OPS);
    expect(mon9.find((r) => r.work_type === "Waiting for an owner decision")!.user_id).toBeNull();
  });
});

describe("Direct Booking alerts use the same on-shift rule", () => {
  beforeAll(async () => { db = await fresh(); });
  beforeEach(reset);

  it("alerts every Guest Experience coordinator on shift", async () => {
    expect(await alerts(db, at(MON, "14:30"))).toEqual([A1, A2].sort());
  });

  it("skips anyone at lunch while others are on shift", async () => {
    expect(await alerts(db, at(MON, "13:30"))).toEqual([A2]);
  });

  it("nobody on Guest Experience on shift: the coordinators working on any team", async () => {
    await off(db, "ge_parttime", at(TUE, "09:00"));
    expect(await alerts(db, at(TUE, "09:00"))).toEqual([B1]);
    // Guest Experience all at lunch: cover from whoever is free.
    expect(await alerts(db, at(THU, "13:30"))).toEqual([B2]);
  });

  it("only people at lunch are working: they still get it, Guest Experience first", async () => {
    await off(db, "ge_day", at(SAT, "16:30"));
    expect(await alerts(db, at(SAT, "16:30"))).toEqual([A2]);
  });

  it("no coordinator working: the Operations Supervisor and the Director of Operations", async () => {
    expect(await alerts(db, at(MON, "23:00"))).toEqual([SUP, DIR_OPS].sort());
  });

  it("respects time off, cover and the unavailable switch", async () => {
    await cover(db, "ge_day", COVER, at(MON, "14:30"));
    expect(await alerts(db, at(MON, "14:30"))).toEqual([A2, COVER].sort());
    await reset();
    await db.exec("UPDATE public.functional_roles SET available = false WHERE code = 'ge_evening'");
    expect(await alerts(db, at(MON, "14:30"))).toEqual([A1]);
    await reset();
    await off(db, "ge_day", at(MON, "14:30"));
    expect(await alerts(db, at(MON, "14:30"))).toEqual([A2]);
  });

  it("today's list ignored time off and cover, and alerted nobody when no one was on shift (what changes)", async () => {
    const d = await fresh(false);
    await off(d, "ge_day", at(MON, "14:30"));
    expect(await alerts(d, at(MON, "14:30"))).toEqual([A1, A2].sort());
    expect(await alerts(d, at(MON, "23:00"))).toEqual([]);
  });
});

describe("undo", () => {
  it("restores today's trigger function and alert list exactly and removes the new functions", async () => {
    const d = await fresh();
    await d.exec(ROUTING_UNDO);
    const def = async (x: PGlite, sig: string) => (await x.query<{ d: string }>(`SELECT pg_get_functiondef('public.${sig}'::regprocedure) d`)).rows[0]!.d;
    const ref = await fresh(false);
    expect(await def(d, "auto_assign_ticket()")).toBe(await def(ref, "auto_assign_ticket()"));
    expect(await def(d, "direct_booking_on_shift(timestamptz)")).toBe(await def(ref, "direct_booking_on_shift(timestamptz)"));
    const left = (await d.query<{ proname: string }>("SELECT proname FROM pg_proc WHERE proname IN ('coordinators_on_shift','coordinator_for','ticket_route_at','routing_dry_run','coordinator_role_label','coordinator_team_label')")).rows;
    expect(left).toEqual([]);
  });

  it("the live captures are the exact definitions the undo restores", () => {
    const undo = ROUTING_UNDO;
    expect(undo).toContain(read(`${DIR}/live-capture/public.auto_assign_ticket.sql`).trimEnd() + ";");
    expect(undo).toContain(read(`${DIR}/live-capture/public.direct_booking_on_shift.sql`).trimEnd() + ";");
  });
});
