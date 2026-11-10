// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/breezeway-bridge/01_breezeway_bridge.sql
 * (register T15, C4, C5, C6; Emily, Nov 10). Tables are stubbed with the live column names.
 * Fake Breezeway tasks only. Nothing touches the real database or Breezeway.
 */
const DIR = "docs/pending/breezeway-bridge";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const COORD = "00000000-0000-4000-8000-0000000000c1";
const HOME = "00000000-0000-4000-8000-000000000101";
const NEW_HOUSE_HOME = "00000000-0000-4000-8000-000000000102";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech');
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${COORD}','tech');
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION public.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT private.has_role(_u, _r) $$;
CREATE FUNCTION public.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u) $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
INSERT INTO public.profiles VALUES ('${ADMIN}', 'Admin person', 'admin@example.com');
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  description text, updated_by uuid, updated_at timestamptz DEFAULT now());
INSERT INTO public.feature_flags(key, label, enabled) VALUES ('breezeway_bridge','Breezeway bridge', false),
  ('breezeway_outbound','Breezeway outbound', true);
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.integration_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system text NOT NULL, direction text NOT NULL,
  operation text NOT NULL, external_id text, entity_type text, entity_id uuid, status text NOT NULL DEFAULT 'pending',
  error_message text, request_payload jsonb, previous_value jsonb, resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, nickname text, address_line1 text, is_demo boolean NOT NULL DEFAULT false,
  breezeway_mapping_state text);
INSERT INTO public.properties VALUES ('${HOME}', 'Maple', NULL, '1 Maple St', false, 'verified'),
  ('${NEW_HOUSE_HOME}', 'New House Setup Oak', NULL, '2 Oak St', false, 'verified');
CREATE TABLE public.breezeway_work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), breezeway_task_id bigint NOT NULL UNIQUE,
  property_id uuid, breezeway_home_id text NOT NULL, name text, description text, department text, priority text, status text,
  stage text, linked_ticket_id uuid, needs_attention boolean NOT NULL DEFAULT false, breezeway_created_at timestamptz,
  breezeway_updated_at timestamptz, finished_at timestamptz, last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.breezeway_work_orders(breezeway_task_id, property_id, breezeway_home_id, name, department, status, stage)
  VALUES (1001, '${HOME}', '768854', 'An older mirrored row', 'maintenance', 'Created', 'new');
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_type text, title text, description text,
  property_id uuid, priority text, suggested_priority text, status text, source_channel text, initiator_type text,
  external_source text, external_id text, external_url text, external_synced_at timestamptz, breezeway_task_id bigint,
  reported_at timestamptz, department_code text, is_demo boolean NOT NULL DEFAULT false, assigned_to uuid,
  response_due_at timestamptz, action_due_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX tickets_external_unique ON public.tickets (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE TABLE public.routine_controls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, event_key text,
  property_id uuid, title text, status text, team text, due_at timestamptz, is_demo boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX routine_controls_event_key_idx ON public.routine_controls (kind, event_key);
CREATE TABLE public.work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, property_id uuid,
  is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.breezeway_outbound_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_type text NOT NULL,
  breezeway_home_id text NOT NULL, request_key text NOT NULL, title text NOT NULL);
CREATE TABLE public.breezeway_webhook_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), received_at timestamptz DEFAULT now(),
  outcome text, is_fixture boolean NOT NULL DEFAULT false, retryable boolean NOT NULL DEFAULT false, recovered_at timestamptz);
`;

let db: PGlite;
const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
const all = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
const as = async (uid: string | null) => {
  await db.exec("DELETE FROM public.me");
  if (uid) await db.exec(`INSERT INTO public.me VALUES ('${uid}')`);
};
const err = async (sql: string) => {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};
const flag = async (key: string) => (await one(`SELECT enabled FROM public.feature_flags WHERE key=$1`, [key]))?.enabled;
const line = async () => (await one(`SELECT private.breezeway_bridge_start_line() AS l`)).l;
const turn = async (on: boolean) => (await one(`SELECT public.set_breezeway_bridge(${on}) AS r`)).r;

/** One mirror write, as the webhook, recovery, sweep or a manual refresh makes it. */
async function mirror(t: {
  id: number;
  home?: string | null;
  bwHome?: string;
  dept?: string;
  status?: string;
  stage?: string;
  issue?: boolean | null;
  created?: string;
  updated?: string;
  finished?: string | null;
  tags?: string[] | null;
  priority?: string;
  name?: string;
}) {
  await db.query(
    `INSERT INTO public.breezeway_work_orders (breezeway_task_id, property_id, breezeway_home_id, name, description, department,
       priority, status, stage, breezeway_created_at, breezeway_updated_at, finished_at, reported_issue, tags, report_url)
     VALUES ($1,$2,$3,$4,'From the field',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (breezeway_task_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, stage = EXCLUDED.stage,
       breezeway_updated_at = EXCLUDED.breezeway_updated_at, finished_at = EXCLUDED.finished_at, tags = EXCLUDED.tags`,
    [
      t.id,
      t.home === undefined ? HOME : t.home,
      t.bwHome ?? "768854",
      t.name ?? `Task ${t.id}`,
      t.dept ?? "maintenance",
      t.priority ?? "normal",
      t.status ?? "Created",
      t.stage ?? "new",
      t.created ?? null,
      t.updated ?? t.created ?? null,
      t.finished ?? null,
      t.issue ?? null,
      t.tags ?? null,
      t.issue ? `https://portal.breezeway.io/task/report/${t.id}` : null,
    ],
  );
}
const soon = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const ticketsFor = (id: number) => all(`SELECT * FROM public.tickets WHERE external_source='breezeway' AND external_id=$1`, [String(id)]);
const records = (id: number) => all(`SELECT outcome, reason, kind, breezeway_home_id FROM public.breezeway_bridge_records WHERE breezeway_task_id=$1`, [id]);

async function bridgeOn() {
  await as(ADMIN);
  await turn(true);
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01_breezeway_bridge.sql`, "utf8"));
});

describe("T15 the bridge switch is real (E1 pattern)", () => {
  it("starts off with no start line and Resolve work orders off", async () => {
    expect(await flag("breezeway_bridge")).toBe(false);
    expect(await flag("internal_work_orders")).toBe(false);
    expect(await line()).toBeNull();
  });

  it("the switch cannot be flipped directly and the start line cannot be moved directly", async () => {
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key = 'breezeway_bridge'`)).toContain(
      "can only be turned on or off with its own switch",
    );
    expect(await err(`INSERT INTO public.app_settings(key, value) VALUES ('breezeway_bridge_start_line', '{"at":"2020-01-01T00:00:00Z"}')`)).toContain(
      "only moves when the bridge is turned on",
    );
    expect(await flag("breezeway_bridge")).toBe(false);
  });

  it("only an Admin turns it on or reads its state", async () => {
    await as(COORD);
    expect(await err(`SELECT public.set_breezeway_bridge(true)`)).toContain("Only an Admin");
    expect(await err(`SELECT public.breezeway_bridge_status()`)).toContain("Only an Admin");
    expect(await flag("breezeway_bridge")).toBe(false);
  });

  it("Turn on sets the start line and records who and when", async () => {
    await as(ADMIN);
    const before = Date.now();
    const r = await turn(true);
    expect(r).toMatchObject({ enabled: true, changed: true });
    expect(await flag("breezeway_bridge")).toBe(true);
    expect(new Date(await line()).getTime()).toBeGreaterThan(before - 1000);
    const audit = await one(`SELECT status, resolved_by, resolved_at FROM public.integration_events WHERE operation='bridge_switch'`);
    expect(audit.status).toBe("on");
    expect(audit.resolved_by).toBe(ADMIN);
    expect(audit.resolved_at).not.toBeNull();
  });

  it("Turn off stops creation, keeps the start line and records it", async () => {
    await bridgeOn();
    const l = await line();
    await turn(false);
    expect(await flag("breezeway_bridge")).toBe(false);
    expect((await all(`SELECT status FROM public.integration_events WHERE operation='bridge_switch' ORDER BY created_at`)).map((r) => r.status)).toEqual(["on", "off"]);
    expect(String(await line())).toBe(String(l));
  });

  it("the start line only moves forward when turned on", async () => {
    await as(ADMIN);
    await db.exec(`SELECT set_config('resolve.breezeway_bridge_switch','on',false);
      INSERT INTO public.app_settings(key, value) VALUES ('breezeway_bridge_start_line', '{"at":"2026-01-01T00:00:00Z"}');
      SELECT set_config('resolve.breezeway_bridge_switch','',false);`);
    await turn(true);
    expect(new Date(await line()).getTime()).toBeGreaterThan(Date.parse("2026-01-01T00:00:00Z"));
    await turn(false);
    await db.exec(`SELECT set_config('resolve.breezeway_bridge_switch','on',false);
      UPDATE public.app_settings SET value='{"at":"2099-01-01T00:00:00Z"}' WHERE key='breezeway_bridge_start_line';
      SELECT set_config('resolve.breezeway_bridge_switch','',false);`);
    await turn(true);
    expect(new Date(await line()).toISOString()).toBe("2099-01-01T00:00:00.000Z");
  });

  it("asking for the state it is already in changes nothing", async () => {
    await as(ADMIN);
    expect(await turn(false)).toMatchObject({ enabled: false, changed: false });
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation='bridge_switch'`)).n).toBe(0);
    expect(await line()).toBeNull();
  });
});

describe("T15 reported issues become one ordinary ticket", () => {
  it("a reported issue after the start line makes one unowned ticket with clocks, the home and the Breezeway link", async () => {
    await bridgeOn();
    await mirror({ id: 5001, issue: true, created: soon(1), name: "Bathtub leak" });
    const [t] = await ticketsFor(5001);
    expect(t.title).toBe("Bathtub leak");
    expect(t.description).toBe("From the field");
    expect(t.property_id).toBe(HOME);
    expect(t.source_channel).toBe("breezeway");
    expect(t.status).toBe("open");
    expect(t.priority).toBe("p3");
    expect(t.assigned_to).toBeNull();
    expect(t.external_url).toBe("https://portal.breezeway.io/task/report/5001");
    // Routine clocks: 120 minutes to acknowledge, 480 minutes to start.
    const resp = (Date.parse(t.response_due_at) - Date.parse(t.created_at)) / 60_000;
    const act = (Date.parse(t.action_due_at) - Date.parse(t.created_at)) / 60_000;
    expect(Math.round(resp)).toBe(120);
    expect(Math.round(act)).toBe(480);
    const wo = await one(`SELECT linked_ticket_id, bridge_keep FROM public.breezeway_work_orders WHERE breezeway_task_id=5001`);
    expect(wo).toEqual({ linked_ticket_id: t.id, bridge_keep: true });
    expect(await records(5001)).toEqual([{ outcome: "created", reason: "", kind: "reported_issue", breezeway_home_id: "768854" }]);
  });

  it("a second update of the same task creates nothing", async () => {
    await bridgeOn();
    await mirror({ id: 5002, issue: true, created: soon(1) });
    await mirror({ id: 5002, issue: true, created: soon(1), updated: soon(5), status: "In Progress", stage: "in_progress" });
    await mirror({ id: 5002, issue: true, created: soon(1), updated: soon(9), status: "Finished", stage: "finished" });
    expect((await ticketsFor(5002)).length).toBe(1);
    expect((await records(5002)).filter((r) => r.outcome === "created").length).toBe(1);
  });

  it("the issue's priority comes through: urgent is Right now, high is Today", async () => {
    await bridgeOn();
    await mirror({ id: 5003, issue: true, created: soon(1), priority: "urgent" });
    await mirror({ id: 5004, issue: true, created: soon(1), priority: "high" });
    expect((await ticketsFor(5003))[0].priority).toBe("p1");
    expect((await ticketsFor(5004))[0].priority).toBe("p2");
  });

  it("an older issue is skipped with the reason before the bridge started, even when first seen now", async () => {
    await bridgeOn();
    await mirror({ id: 5005, issue: true, created: ago(2) });
    expect((await ticketsFor(5005)).length).toBe(0);
    expect(await records(5005)).toEqual([
      { outcome: "skipped", reason: "before the bridge started", kind: "reported_issue", breezeway_home_id: "768854" },
    ]);
  });

  it("an issue on a home that is not a verified Resolve home is skipped and the home is recorded", async () => {
    await bridgeOn();
    await mirror({ id: 5006, issue: true, created: soon(1), home: null, bwHome: "99999" });
    expect((await ticketsFor(5006)).length).toBe(0);
    expect(await records(5006)).toEqual([
      { outcome: "skipped", reason: "not a verified Resolve home", kind: "reported_issue", breezeway_home_id: "99999" },
    ]);
  });

  it("a task that already has a ticket (a manual escalation) gets no second one", async () => {
    await bridgeOn();
    await db.exec(`INSERT INTO public.tickets(title, external_source, external_id) VALUES ('Escalated', 'breezeway', '5007')`);
    await mirror({ id: 5007, issue: true, created: soon(1) });
    expect((await ticketsFor(5007)).length).toBe(1);
  });
});

describe("T15 finished maintenance gets one review for Team B", () => {
  it("one Maintenance Review due 24 hours after the finish time, kept by the sweep", async () => {
    await bridgeOn();
    const finished = soon(2);
    await mirror({ id: 6001, status: "Finished", stage: "finished", finished, created: ago(3), updated: soon(3), name: "Lawn Care" });
    const rows = await all(
      `SELECT r.* FROM public.routine_controls r JOIN public.breezeway_work_orders w ON r.event_key = 'bz_maint:' || w.id WHERE w.breezeway_task_id=6001`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ kind: "maintenance_review", status: "due", team: "property_operations", property_id: HOME, title: "Lawn Care" });
    expect(new Date(rows[0].due_at).getTime() - Date.parse(finished)).toBe(24 * 3_600_000);
    expect((await one(`SELECT bridge_keep FROM public.breezeway_work_orders WHERE breezeway_task_id=6001`)).bridge_keep).toBe(true);
  });

  it("Approved and Closed later on the same work order create nothing more", async () => {
    await bridgeOn();
    const finished = soon(2);
    await mirror({ id: 6002, status: "Finished", stage: "finished", finished, created: ago(3), updated: soon(3) });
    await mirror({ id: 6002, status: "Approved", stage: "finished", finished, created: ago(3), updated: soon(6) });
    await mirror({ id: 6002, status: "Closed", stage: "finished", finished, created: ago(3), updated: soon(9) });
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(1);
  });

  it("New House is skipped: by the Breezeway home tag, by a task tag, or by the home's name", async () => {
    await bridgeOn();
    await db.exec(`INSERT INTO public.breezeway_home_tags(home_id, tags) VALUES ('555', ARRAY['New House'])`);
    await mirror({ id: 6003, bwHome: "555", status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    await mirror({ id: 6004, tags: ["new house"], status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    await mirror({ id: 6005, home: NEW_HOUSE_HOME, status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(0);
    for (const id of [6003, 6004, 6005]) {
      expect((await records(id)).map((r) => r.reason)).toEqual(["New House home"]);
    }
  });

  it("other companies' homes are skipped and the home is recorded", async () => {
    await bridgeOn();
    await mirror({ id: 6006, home: null, bwHome: "424242", status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(0);
    expect(await records(6006)).toEqual([
      { outcome: "skipped", reason: "not a verified Resolve home", kind: "maintenance_review", breezeway_home_id: "424242" },
    ]);
  });

  it("no review for cleaning or inspection", async () => {
    await bridgeOn();
    await mirror({ id: 6007, dept: "housekeeping", status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    await mirror({ id: 6008, dept: "inspection", status: "Finished", stage: "finished", finished: soon(2), updated: soon(3) });
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM public.breezeway_bridge_records`)).n).toBe(0);
  });

  it("work finished before the start line is skipped, even when Resolve first sees it now", async () => {
    await bridgeOn();
    await mirror({ id: 6009, status: "Finished", stage: "finished", finished: soon(1), updated: ago(1) });
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(0);
    expect((await records(6009)).map((r) => r.reason)).toEqual(["before the bridge started"]);
  });
});

describe("T15 switch off refuses everything", () => {
  it("while off nothing is created and nothing is recorded", async () => {
    await mirror({ id: 7001, issue: true, created: soon(1) });
    await mirror({ id: 7002, status: "Finished", stage: "finished", finished: soon(1), updated: soon(2) });
    expect((await one(`SELECT count(*)::int n FROM public.tickets`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM public.routine_controls`)).n).toBe(0);
    expect((await one(`SELECT count(*)::int n FROM public.breezeway_bridge_records`)).n).toBe(0);
  });

  it("turning it off stops creation", async () => {
    await bridgeOn();
    await turn(false);
    await mirror({ id: 7003, issue: true, created: soon(1) });
    expect((await ticketsFor(7003)).length).toBe(0);
  });

  it("a failed creation never breaks the mirror write and is recorded for Integrations", async () => {
    await bridgeOn();
    await db.exec(`ALTER TABLE public.routine_controls ADD CONSTRAINT practice_block CHECK (title <> 'Blocked')`);
    await mirror({ id: 7004, name: "Blocked", status: "Finished", stage: "finished", finished: soon(1), updated: soon(2) });
    expect((await one(`SELECT name FROM public.breezeway_work_orders WHERE breezeway_task_id=7004`)).name).toBe("Blocked");
    expect((await records(7004)).map((r) => r.outcome)).toEqual(["failed"]);
    expect((await one(`SELECT count(*)::int n FROM public.integration_events WHERE operation='bridge_create' AND status='failed'`)).n).toBe(1);
  });
});

describe("C4 no internal work orders while the switch is off", () => {
  it("a Resolve work order and a Breezeway task are refused; demo practice rows still work", async () => {
    expect(await err(`INSERT INTO public.work_orders(title, is_demo) VALUES ('Fix', false)`)).toContain("made in Breezeway");
    expect(await err(`INSERT INTO public.breezeway_outbound_tasks(source_type, breezeway_home_id, request_key, title) VALUES ('ticket','1','k','t')`)).toContain(
      "Nothing is sent to Breezeway",
    );
    expect(await err(`INSERT INTO public.work_orders(title, is_demo) VALUES ('Demo', true)`)).toBeNull();
  });

  it("with the switch on, both work as before", async () => {
    await db.exec(`UPDATE public.feature_flags SET enabled = true WHERE key = 'internal_work_orders'`);
    expect(await err(`INSERT INTO public.work_orders(title, is_demo) VALUES ('Fix', false)`)).toBeNull();
    expect(await err(`INSERT INTO public.breezeway_outbound_tasks(source_type, breezeway_home_id, request_key, title) VALUES ('ticket','1','k','t')`)).toBeNull();
  });
});

describe("Integrations status and undo", () => {
  it("shows the true state: on, start line, sweep, counts and skips by reason", async () => {
    await bridgeOn();
    await mirror({ id: 8001, issue: true, created: soon(1) });
    await mirror({ id: 8002, issue: true, created: ago(2) });
    await db.exec(`INSERT INTO public.breezeway_webhook_events(outcome, retryable) VALUES ('verify_failed', true), ('processed', false)`);
    const s = (await one(`SELECT public.breezeway_bridge_status() AS s`)).s;
    expect(s.enabled).toBe(true);
    expect(s.start_line).not.toBeNull();
    expect(s.sweep_last).toBeNull();
    expect(s.tickets_created).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.skipped_by_reason).toEqual({ "before the bridge started": 1 });
    expect(s.failed_lookups).toBe(1);
    expect(s.last_processed_at).not.toBeNull();
    expect(s.last_switch.status).toBe("on");
  });

  it("older mirror rows keep working with the new fields empty, and undo removes only what this step added", async () => {
    const old = await one(`SELECT tags, reported_issue, report_url, bridge_keep FROM public.breezeway_work_orders WHERE breezeway_task_id=1001`);
    expect(old).toEqual({ tags: null, reported_issue: null, report_url: null, bridge_keep: false });
    await db.exec(readFileSync(`${DIR}/undo/01_breezeway_bridge.sql`, "utf8"));
    expect((await one(`SELECT count(*)::int n FROM public.breezeway_work_orders`)).n).toBe(1);
    expect(await flag("internal_work_orders")).toBeUndefined();
    expect(await err(`INSERT INTO public.work_orders(title) VALUES ('Fix')`)).toBeNull();
    expect(await err(`UPDATE public.feature_flags SET enabled = true WHERE key = 'breezeway_bridge'`)).toBeNull();
  });
});
