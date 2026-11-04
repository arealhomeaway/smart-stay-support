import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { oncallForNight, patternFromSetting, type SRoster } from "../team-schedule";

/**
 * Isolated PostgreSQL check of docs/pending/team-coverage-pass-a2/01: on call is
 * a weekday pattern plus dated changes, and the trigger, the grid and the
 * calendar pick the same person. Nothing touches the real database.
 */
const DIR = "docs/pending/team-coverage-pass-a2";
const read = (p: string) => readFileSync(p, "utf8");
const passA = read("src/lib/__tests__/auto-assign-overrides-sql.test.ts");
const HELPERS = passA.split("const LIVE_HELPERS = `")[1]!.split("`;")[0]!;
const LIVE = read(`${DIR}/live-capture/public.auto_assign_ticket.sql`);
const NEW = read(`${DIR}/01_oncall_weekday_pattern.sql`);
const UNDO = read(`${DIR}/01_undo_oncall_weekday_pattern.sql`);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const micah = U(11), emily = U(12), james = U(13), holder = U(1), sup = U(3);
let db: PGlite;

const localDate = async () => (await db.query<{ d: string }>(`SELECT to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') d`)).rows[0]!.d;
const sqlNight = async (d: string) => (await db.query<{ u: string | null }>("SELECT public.oncall_user_for_night($1::date) u", [d])).rows[0]!.u;
const roster = async () =>
  (await db.query<SRoster>(`SELECT id::text, user_id::text, to_char(starts_on,'YYYY-MM-DD') starts_on, to_char(ends_on,'YYYY-MM-DD') ends_on, NULL label, created_at::text FROM public.oncall_roster`)).rows;
const pattern = async () => patternFromSetting((await db.query<{ v: unknown }>("SELECT value v FROM public.app_settings WHERE key='oncall_weekday_pattern'")).rows[0]?.v);

async function overnight(on: boolean) {
  const now = (await db.query<{ m: number }>(`SELECT (EXTRACT(hour FROM now() AT TIME ZONE 'America/Chicago')*60 + EXTRACT(minute FROM now() AT TIME ZONE 'America/Chicago'))::int m`)).rows[0]!.m;
  const start = on ? now : (now + 120) % 1440;
  const end = on ? (now + 60) % 1440 : (now + 180) % 1440;
  await db.query("UPDATE public.coverage_config SET after_hours_start_minute=$1, after_hours_end_minute=$2", [start, end]);
}
const route = async (role: string | null = "ge_day") =>
  (await db.query<{ assigned_to: string | null }>("INSERT INTO public.tickets(functional_role_code) VALUES ($1) RETURNING assigned_to", [role])).rows[0]!.assigned_to;

describe("On-call weekday pattern (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HELPERS);
    await db.exec(`CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_by uuid, updated_at timestamptz DEFAULT now());
      INSERT INTO public.coverage_config(timezone) VALUES ('America/Chicago');
      INSERT INTO public.functional_roles(code, name, backup_role_code, current_seat_holder) VALUES
        ('ge_day','Guest Experience day',NULL,'${holder}'), ('ops_supervisor','Operations Supervisor',NULL,'${sup}');
      INSERT INTO public.user_roles VALUES ('${holder}','tech'),('${sup}','manager'),('${micah}','manager'),('${emily}','admin'),('${james}','manager');`);
    // The live roster week: Sun to Sat = Micah, Micah, Emily, James, Micah, Emily, James (Nov 1 to 7, 2026).
    const who = [micah, micah, emily, james, micah, emily, james];
    for (let i = 0; i < 7; i++)
      await db.query("INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, $2::date, $2::date)", [who[i], `2026-11-0${i + 1}`]);
    await db.exec(LIVE + ";");
    await db.exec("CREATE TRIGGER t BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket()");
    await db.exec(NEW);
  });

  it("seeds the pattern from the current roster, never overwriting a saved one", async () => {
    expect(await pattern()).toEqual([micah, micah, emily, james, micah, emily, james]);
    await db.exec(NEW); // rerun keeps the saved pattern
    expect(await pattern()).toEqual([micah, micah, emily, james, micah, emily, james]);
  });

  it("never runs out: every night for a year after the last roster row has someone", async () => {
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 10, 8 + i)).toISOString().slice(0, 10);
      expect(await sqlNight(d)).not.toBeNull();
    }
  });

  it("trigger, grid and calendar agree on every night, with date changes winning", async () => {
    await db.query("INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, '2026-11-10', '2026-11-10')", [james]);
    const r = await roster();
    const p = await pattern();
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 9, 28 + i)).toISOString().slice(0, 10);
      expect(await sqlNight(d)).toBe(oncallForNight(r, d, p).userId);
    }
    expect(await sqlNight("2026-11-10")).toBe(james); // Tuesday pattern is Emily
  });

  it("changing the pattern keeps date changes", async () => {
    await db.query(`UPDATE public.app_settings SET value = jsonb_build_object('0',$1::text,'1',$1::text,'2',$1::text,'3',$1::text,'4',$1::text,'5',$1::text,'6',$1::text) WHERE key='oncall_weekday_pattern'`, [emily]);
    expect(await sqlNight("2026-11-10")).toBe(james);
    expect(await sqlNight("2026-11-11")).toBe(emily);
  });

  it("overnight tickets route to the person the grid shows, including pattern nights", async () => {
    await overnight(true);
    const today = await localDate();
    await db.query("DELETE FROM public.oncall_roster WHERE starts_on >= $1::date - 1", [today]);
    const nightOf = (await db.query<{ d: string }>(
      "SELECT to_char(CASE WHEN EXTRACT(hour FROM now() AT TIME ZONE 'America/Chicago')*60 + EXTRACT(minute FROM now() AT TIME ZONE 'America/Chicago') < (SELECT after_hours_end_minute FROM public.coverage_config) THEN (now() AT TIME ZONE 'America/Chicago')::date - 1 ELSE (now() AT TIME ZONE 'America/Chicago')::date END, 'YYYY-MM-DD') d")).rows[0]!.d;
    expect(await route()).toBe(oncallForNight(await roster(), nightOf, await pattern()).userId);
    await db.query("INSERT INTO public.oncall_roster(user_id, starts_on, ends_on) VALUES ($1, $2::date, $2::date)", [micah, nightOf]);
    expect(await route()).toBe(micah);
  });

  it("hidden grid rows still route: daytime seat and Supervisor last resort unchanged", async () => {
    await overnight(false);
    for (let d = 0; d < 7; d++)
      await db.query("INSERT INTO public.coverage_shifts(role_code, weekday, start_minute, end_minute) VALUES ('ge_day',$1,0,1440)", [d]);
    expect(await route("ge_day")).toBe(holder);
    expect(await route(null)).toBe(sup);
  });

  it("an empty scheduled coverage seat (ge_, po_) is off duty, so its work goes to the Supervisor", async () => {
    await overnight(false);
    await db.exec("DELETE FROM public.coverage_shifts WHERE role_code IN ('ge_day','po_day')");
    for (const code of ["ge_day", "po_day"]) {
      await db.exec("INSERT INTO public.functional_roles(code, name, current_seat_holder) VALUES ('" + code + "','S',$$" + holder + "$$) ON CONFLICT (code) DO UPDATE SET current_seat_holder = EXCLUDED.current_seat_holder");
      const d = (await db.query<{ d: boolean }>("SELECT public.seat_on_duty('" + code + "') d")).rows[0]!.d;
      expect(d).toBe(false);
    }
    expect(await route("ge_day")).toBe(sup);
  });

  it("every other empty seat (Directors, Active Owner follow-up, onboarding, Supervisor) keeps today's always-on rule", async () => {
    await overnight(false);
    await db.exec(NEW);
    for (const code of ["director_ops", "active_owner_followup", "ceo", "finance_lead", "accounting", "onboarding_manager", "ops_supervisor"]) {
      await db.exec("INSERT INTO public.functional_roles(code, name, current_seat_holder) VALUES ('" + code + "','S',$$" + holder + "$$) ON CONFLICT (code) DO NOTHING");
      await db.exec("DELETE FROM public.coverage_shifts WHERE role_code = '" + code + "'");
      const q = "SELECT public.seat_on_duty('" + code + "') d";
      const after = (await db.query<{ d: boolean }>(q)).rows[0]!.d;
      await db.exec(read(`${DIR}/live-capture/public.seat_on_duty.sql`));
      const before = (await db.query<{ d: boolean }>(q)).rows[0]!.d;
      await db.exec(NEW);
      expect(after).toBe(true);
      expect(after).toBe(before);
    }
  });

  it("only the on-call lookup line changed, and undo restores the exact Pass A definition", async () => {
    const body = (s: string) => s.slice(s.indexOf("CREATE OR REPLACE FUNCTION public.auto_assign_ticket"), s.indexOf("$function$;", s.indexOf("CREATE OR REPLACE FUNCTION public.auto_assign_ticket")));
    const a = body(NEW).split("\n"), b = LIVE.split("\n");
    const removed = b.filter((l) => !a.includes(l) && l.trim() !== "$function$;" && l.trim() !== ""), added = a.filter((l) => !b.includes(l));
    expect(removed.every((l) => /oncall_roster|v_oncall|BETWEEN r\.starts_on|ORDER BY \(r\.ends_on|LIMIT 1;|WHERE \(CASE WHEN v_minutes/.test(l))).toBe(true);
    expect(added.every((l) => /oncall_user_for_night|CASE WHEN v_minutes/.test(l))).toBe(true);
    const def = async () => (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.auto_assign_ticket'::regproc) d")).rows[0]!.d;
    await db.exec(UNDO);
    const undone = await def();
    await db.exec(LIVE + ";");
    expect(undone).toBe(await def());
    expect((await db.query("SELECT 1 FROM pg_proc WHERE proname='oncall_user_for_night'")).rows).toHaveLength(0);
    const sod = async () => (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.seat_on_duty'::regproc) d")).rows[0]!.d;
    const afterUndo = await sod();
    await db.exec(read(`${DIR}/live-capture/public.seat_on_duty.sql`));
    expect(afterUndo).toBe(await sod());
  });

  it("no anonymous or PUBLIC execute", async () => {
    await db.exec(NEW);
    const r = (await db.query<{ a: boolean; t: boolean; p: boolean }>(
      `SELECT has_function_privilege('anon','public.oncall_user_for_night(date)','EXECUTE') a,
              has_function_privilege('authenticated','public.oncall_user_for_night(date)','EXECUTE') t,
              has_function_privilege('anon','public.auto_assign_ticket()','EXECUTE') p`)).rows[0]!;
    expect(r).toEqual({ a: false, t: true, p: false });
  });
});
